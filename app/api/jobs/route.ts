/**
 * POST /api/jobs/ingest  — Ingest a job from URL or raw text
 * GET  /api/jobs         — List jobs with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { IngestJobSchema, JobFiltersSchema } from '@/lib/schemas';
import { classifyC2C } from '@/lib/c2c/classifier';
import { parseJobDescription, buildFingerprint } from '@/lib/ingestion/parser';
import { dbPut, dbQuery, TABLE_NAME } from '@/lib/dynamo/client';
import type { Job } from '@/lib/types/job';

const getUserId = (request: NextRequest): string | null =>
  request.headers.get('x-user-id');

// ── POST /api/jobs/ingest ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = IngestJobSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error.message }, { status: 400 });
    }

    const { url, rawText, title, company, location } = validation.data;
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let resolvedText = rawText || '';

    // Fetch URL content if URL provided (basic text fetch — not scraping)
    if (url && !rawText) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'C2CJobCopilot/1.0 (job-ingest-bot)' },
          signal: AbortSignal.timeout(10000),
        });
        if (res.ok) {
          resolvedText = await res.text();
          // Strip HTML tags for basic text extraction
          resolvedText = resolvedText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        }
      } catch {
        return NextResponse.json(
          { error: 'Could not fetch the URL. Please paste the job description text instead.' },
          { status: 422 }
        );
      }
    }

    if (!resolvedText || resolvedText.length < 50) {
      return NextResponse.json({ error: 'Job description text is too short to parse.' }, { status: 400 });
    }

    // Parse JD
    const parsed = parseJobDescription(resolvedText, url || '');
    const c2cResult = classifyC2C(resolvedText);

    // Deduplication check
    const fingerprint = buildFingerprint(
      title || parsed.title || '',
      company || '',
      location || parsed.location || '',
      resolvedText
    );

    const existing = await dbQuery<Job>(`USER#${userId}`, {
      skPrefix: 'JOB#',
    });
    const duplicate = existing.find(j => j.fingerprint === fingerprint);

    const jobId = `job-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();

    const job: Job & { PK: string; SK: string } = {
      PK: `USER#${userId}`,
      SK: `JOB#${jobId}`,
      jobId,
      userId,
      title: title || parsed.title || 'Data Engineer',
      company: company || 'Unknown Company',
      location: location || parsed.location || 'Remote',
      workMode: parsed.workMode,
      employmentType: parsed.employmentType,
      contractDuration: parsed.contractDuration,
      rateMin: parsed.rateMin,
      rateMax: parsed.rateMax,
      c2cStatus: c2cResult.status,
      c2cConfidence: c2cResult.confidence,
      c2cSignals: c2cResult.signals,
      visaWording: parsed.visaWording,
      requiredSkills: parsed.requiredSkills,
      preferredSkills: parsed.preferredSkills,
      sourceUrl: url || '',
      sourceName: url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname : 'manual',
      rawDescription: resolvedText.slice(0, 10000), // cap storage
      fingerprint,
      isDuplicate: !!duplicate,
      duplicateOf: duplicate?.jobId,
      status: 'new',
      ingestedAt: now,
      updatedAt: now,
    };

    await dbPut(job);

    return NextResponse.json(
      {
        jobId,
        status: 'ingested',
        c2cStatus: c2cResult.status,
        c2cConfidence: c2cResult.confidence,
        isDuplicate: !!duplicate,
        duplicateOf: duplicate?.jobId,
        title: job.title,
        company: job.company,
        requiredSkillsFound: parsed.requiredSkills.length,
        preferredSkillsFound: parsed.preferredSkills.length,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[jobs/ingest] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ── GET /api/jobs ──────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = JobFiltersSchema.parse(Object.fromEntries(searchParams));
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let jobs = await dbQuery<Job>(`USER#${userId}`, { skPrefix: 'JOB#' });

    // Apply filters
    if (filters.c2c !== 'any') {
      jobs = jobs.filter(j => j.c2cStatus === filters.c2c);
    }
    if (filters.workMode !== 'any') {
      jobs = jobs.filter(j => j.workMode === filters.workMode);
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(kw) ||
        j.company.toLowerCase().includes(kw) ||
        j.rawDescription.toLowerCase().includes(kw)
      );
    }
    if (filters.skills) {
      const skillList = filters.skills.split(',').map(s => s.trim().toLowerCase());
      jobs = jobs.filter(j =>
        skillList.some(skill =>
          j.requiredSkills.some(s => s.name.toLowerCase().includes(skill)) ||
          j.preferredSkills.some(s => s.name.toLowerCase().includes(skill))
        )
      );
    }
    if (filters.minRate) {
      jobs = jobs.filter(j => (j.rateMax || j.rateMin || 0) >= filters.minRate!);
    }

    // Sort
    if (filters.sort === 'matchScore') {
      jobs.sort((a, b) => (b.score?.overall || 0) - (a.score?.overall || 0));
    } else if (filters.sort === 'rate') {
      jobs.sort((a, b) => (b.rateMax || b.rateMin || 0) - (a.rateMax || a.rateMin || 0));
    } else {
      jobs.sort((a, b) => (b.ingestedAt > a.ingestedAt ? 1 : -1));
    }

    // Pagination
    let start = 0;
    if (filters.cursor) {
      try {
        const decoded = parseInt(atob(filters.cursor), 10);
        start = Number.isFinite(decoded) && decoded >= 0 ? decoded : 0;
      } catch {
        // Invalid cursor — treat as start of list
      }
    }
    const paginated = jobs.slice(start, start + filters.limit);
    const nextCursor = start + filters.limit < jobs.length
      ? btoa(String(start + filters.limit))
      : null;

    return NextResponse.json({
      jobs: paginated,
      total: jobs.length,
      cursor: nextCursor,
      filters,
    });
  } catch (err) {
    console.error('[jobs] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
