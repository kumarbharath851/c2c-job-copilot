/**
 * POST /api/jobs/discover
 * Fetches Data Engineer jobs from free public job board APIs,
 * runs C2C classification + skill parsing, and stores new listings.
 *
 * Sources:
 *   - RemoteOK  (https://remoteok.com/api — no auth required)
 *   - Arbeitnow (https://arbeitnow.com/api/job-board-api — no auth required)
 *
 * Only Data Engineering roles are kept (filtered by keyword matching).
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { classifyC2C } from '@/lib/c2c/classifier';
import { parseJobDescription, buildFingerprint } from '@/lib/ingestion/parser';
import { dbPut, dbQuery } from '@/lib/dynamo/client';
import type { Job } from '@/lib/types/job';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

interface RawJob {
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  source: string;
}

// ── Data Engineering keyword filter ────────────────────────────────────────

const DE_KEYWORDS = [
  'data engineer',
  'data engineering',
  'etl',
  'elt',
  'data pipeline',
  'spark',
  'databricks',
  'airflow',
  'kafka',
  'data platform',
  'data infrastructure',
  'analytics engineer',
  'dbt',
  'snowflake',
  'data warehouse',
  'lakehouse',
  'data lake',
  'pipeline engineer',
  'big data',
  'pyspark',
  'hadoop',
  'hive',
  'flink',
  'glue',
  'redshift',
  'bigquery',
  'delta lake',
  'iceberg',
  'medallion',
  'dataops',
];

function isDataEngineeringRole(title: string, description: string): boolean {
  const text = `${title} ${description}`.toLowerCase();
  return DE_KEYWORDS.some(kw => text.includes(kw));
}

// ── RemoteOK ───────────────────────────────────────────────────────────────
async function fetchRemoteOK(): Promise<RawJob[]> {
  const res = await fetch(
    'https://remoteok.com/api?tag=data-engineer',
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; C2CJobCopilot/1.0; +https://github.com/c2c-job-copilot)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(12000),
    }
  );
  if (!res.ok) throw new Error(`RemoteOK ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();
  // First element is a legal metadata object — skip it
  return data
    .filter(j => j.id && j.position && j.company)
    .map(j => ({
      title:       j.position   || 'Data Engineer',
      company:     j.company    || 'Unknown',
      location:    j.location   || 'Remote',
      description: [j.position, j.company, j.location, j.description || (j.tags as string[] | undefined)?.join(' ')].filter(Boolean).join('\n'),
      url:         j.url        || `https://remoteok.com/remote-jobs/${j.id}`,
      source:      'RemoteOK',
    }))
    .filter(j => isDataEngineeringRole(j.title, j.description));
}

// ── Arbeitnow ──────────────────────────────────────────────────────────────
async function fetchArbeitnowPage(page: number): Promise<RawJob[]> {
  const res = await fetch(
    `https://arbeitnow.com/api/job-board-api?page=${page}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) throw new Error(`Arbeitnow ${res.status}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: { data?: any[] } = await res.json();
  return (data.data || [])
    .filter((j: { title?: string; company_name?: string }) => j.title && j.company_name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((j: any) => ({
      title:       j.title        || 'Data Engineer',
      company:     j.company_name || 'Unknown',
      location:    j.location     || (j.remote ? 'Remote' : 'On-site'),
      description: [j.title, j.company_name, j.location, j.description].filter(Boolean).join('\n'),
      url:         j.url          || '',
      source:      'Arbeitnow',
    }))
    .filter((j: RawJob) => isDataEngineeringRole(j.title, j.description));
}

async function fetchArbeitnow(): Promise<RawJob[]> {
  // Fetch pages 1 and 2 in parallel for better coverage
  const [page1, page2] = await Promise.allSettled([
    fetchArbeitnowPage(1),
    fetchArbeitnowPage(2),
  ]);
  return [
    ...(page1.status === 'fulfilled' ? page1.value : []),
    ...(page2.status === 'fulfilled' ? page2.value : []),
  ];
}

// ── POST handler ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch from both sources in parallel (don't fail if one is down)
    const [remoteOkResult, arbeitnowResult] = await Promise.allSettled([
      fetchRemoteOK(),
      fetchArbeitnow(),
    ]);

    const allRaw: RawJob[] = [
      ...(remoteOkResult.status  === 'fulfilled' ? remoteOkResult.value  : []),
      ...(arbeitnowResult.status === 'fulfilled' ? arbeitnowResult.value : []),
    ];

    const sourceStatus = {
      remoteok:  remoteOkResult.status  === 'fulfilled'
        ? remoteOkResult.value.length
        : (remoteOkResult.reason instanceof Error ? remoteOkResult.reason.message : 'error'),
      arbeitnow: arbeitnowResult.status === 'fulfilled'
        ? arbeitnowResult.value.length
        : (arbeitnowResult.reason instanceof Error ? arbeitnowResult.reason.message : 'error'),
    };

    // Load existing fingerprints to avoid duplicates
    const existing = await dbQuery<Job>(`USER#${userId}`, { skPrefix: 'JOB#' });
    const seenFingerprints = new Set(existing.map(j => j.fingerprint));

    let added = 0;
    let duplicates = 0;
    const now = new Date().toISOString();

    for (const raw of allRaw) {
      if (!raw.description || raw.description.length < 30) continue;

      const fingerprint = buildFingerprint(raw.title, raw.company, raw.location, raw.description);

      if (seenFingerprints.has(fingerprint)) {
        duplicates++;
        continue;
      }

      const parsed    = parseJobDescription(raw.description, raw.url);
      const c2cResult = classifyC2C(raw.description);

      const jobId = `job-${uuidv4().split('-')[0]}`;

      const job: Job & { PK: string; SK: string } = {
        PK: `USER#${userId}`,
        SK: `JOB#${jobId}`,
        jobId,
        userId,
        title:            raw.title,
        company:          raw.company,
        location:         raw.location,
        workMode:         parsed.workMode,
        employmentType:   parsed.employmentType,
        contractDuration: parsed.contractDuration,
        rateMin:          parsed.rateMin,
        rateMax:          parsed.rateMax,
        c2cStatus:        c2cResult.status,
        c2cConfidence:    c2cResult.confidence,
        c2cSignals:       c2cResult.signals,
        visaWording:      parsed.visaWording,
        requiredSkills:   parsed.requiredSkills,
        preferredSkills:  parsed.preferredSkills,
        sourceUrl:        raw.url,
        sourceName:       raw.source,
        rawDescription:   raw.description.slice(0, 10000),
        fingerprint,
        isDuplicate:      false,
        status:           'new',
        ingestedAt:       now,
        updatedAt:        now,
      };

      await dbPut(job);
      seenFingerprints.add(fingerprint);
      added++;
    }

    return NextResponse.json({
      added,
      duplicates,
      fetched: allRaw.length,
      sources: sourceStatus,
    });
  } catch (err) {
    console.error('[jobs/discover] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
