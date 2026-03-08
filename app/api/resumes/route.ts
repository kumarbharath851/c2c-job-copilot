/**
 * POST /api/resumes      — Upload and parse a master resume
 * GET  /api/resumes      — List user resumes
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { dbPut, dbQuery } from '@/lib/dynamo/client';
import type { Resume, ParsedResume } from '@/lib/types/resume';

const getUserId = (req: NextRequest): string | null => req.headers.get('x-user-id');

// Lightweight plain-text resume parser (no AI — pure regex-based section detection)
function parseResumeText(text: string): ParsedResume {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  // Best-effort contact parsing (first few lines)
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/\+?[\d\s().-]{10,15}/);
  const linkedInMatch = text.match(/linkedin\.com\/in\/([\w-]+)/i);

  // Skills: look for a "skills" section
  const skillsSectionIdx = lines.findIndex(l => /^skills?[\s:]/i.test(l));
  const skills: string[] = [];
  if (skillsSectionIdx >= 0) {
    for (let i = skillsSectionIdx + 1; i < Math.min(skillsSectionIdx + 10, lines.length); i++) {
      const line = lines[i];
      if (/^(experience?|education|projects?|certif)/i.test(line)) break;
      skills.push(...line.split(/[,|•·]/g).map(s => s.trim()).filter(s => s.length > 1 && s.length < 40));
    }
  }

  // Summary
  const summaryIdx = lines.findIndex(l => /^(summary|profile|objective|about)/i.test(l));
  const summary = summaryIdx >= 0 ? lines.slice(summaryIdx + 1, summaryIdx + 4).join(' ') : undefined;

  return {
    contact: {
      name: lines[0] || 'Unknown',
      email: emailMatch?.[0],
      phone: phoneMatch?.[0]?.trim(),
      linkedin: linkedInMatch ? `https://linkedin.com/in/${linkedInMatch[1]}` : undefined,
    },
    summary,
    skills,
    experience: [],     // Full experience parsing would require richer heuristics or AI
    education: [],
    certifications: [],
    projects: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|docx|txt)$/i)) {
      return NextResponse.json({ error: 'Only PDF, DOCX, and TXT files are supported' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 10MB' }, { status: 400 });
    }

    // Read text content (real implementation would use pdf-parse or mammoth)
    const arrayBuffer = await file.arrayBuffer();
    const rawText = new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);

    const resumeId = `res-${uuidv4().split('-')[0]}`;
    const now = new Date().toISOString();
    const s3Key = `resumes/${userId}/${resumeId}/${file.name}`;

    const parsed = parseResumeText(rawText);

    // Determine existing master flag
    const existingResumes = await dbQuery<Resume>(`USER#${userId}`, { skPrefix: 'RESUME#' });
    const isMaster = existingResumes.length === 0;

    const resume: Resume & { PK: string; SK: string } = {
      PK: `USER#${userId}`,
      SK: `RESUME#${resumeId}`,
      resumeId,
      userId,
      fileName: file.name,
      s3Key,
      fileType: file.name.endsWith('.pdf') ? 'pdf' : file.name.endsWith('.docx') ? 'docx' : 'txt',
      fileSizeBytes: file.size,
      isMaster,
      parsed,
      rawText: rawText.slice(0, 50000),
      uploadedAt: now,
      updatedAt: now,
    };

    await dbPut(resume);

    // TODO: Upload actual file bytes to S3 (requires S3 client setup)

    return NextResponse.json(
      {
        resumeId,
        fileName: file.name,
        isMaster,
        skillsFound: parsed.skills.length,
        experienceEntries: parsed.experience.length,
        parsedContact: parsed.contact,
        message: 'Resume uploaded and parsed successfully.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('[resumes] POST Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const resumes = await dbQuery<Resume>(`USER#${userId}`, { skPrefix: 'RESUME#' });

    return NextResponse.json({
      resumes: resumes.map(r => ({
        resumeId: r.resumeId,
        fileName: r.fileName,
        isMaster: r.isMaster,
        skillsFound: r.parsed.skills.length,
        uploadedAt: r.uploadedAt,
        contact: r.parsed.contact,
      })),
      total: resumes.length,
    });
  } catch (err) {
    console.error('[resumes] GET Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
