/**
 * POST /api/jobs/discover
 * Fetches Data Engineer jobs from free public job board APIs,
 * runs C2C classification + skill parsing, and stores new listings.
 *
 * Sources:
 *   - RemoteOK  (https://remoteok.com/api — no auth required)
 *   - Arbeitnow (https://arbeitnow.com/api/job-board-api — no auth required)
 *   - Remotive   (https://remotive.com/api/remote-jobs — no auth required)
 *
 * Only Data Engineering roles from the USA (or remote) are kept.
 * Contract vs W2 classification is handled post-ingestion by the C2C classifier.
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
// Covers a wide range of contract Data Engineering role titles / skills.
// Title match is sufficient — role variety titles are in the first group;
// technology keywords in the second group catch JDs that don't say "engineer".

const DE_TITLE_KEYWORDS = [
  // Core role names
  'data engineer',
  'data engineering',
  'analytics engineer',
  'pipeline engineer',
  'platform engineer',
  'data platform',
  'data infrastructure',
  'etl developer',
  'etl engineer',
  'elt engineer',
  'data integration engineer',
  'data integration developer',
  'data ops',
  'dataops',
  'data architect',
  'cloud data',
  'big data engineer',
  'big data developer',
  'streaming engineer',
  'streaming data',
  'real-time data',
  'data modeler',
  'database engineer',
  'bi engineer',
  'bi developer',
  'business intelligence engineer',
  'mlops engineer',
  'ml engineer',
  'machine learning engineer',
  'data reliability engineer',
  'data solutions engineer',
  'data consultant',
];

const DE_TECH_KEYWORDS = [
  'etl',
  'elt',
  'data pipeline',
  'spark',
  'pyspark',
  'databricks',
  'airflow',
  'kafka',
  'flink',
  'hadoop',
  'hive',
  'dbt',
  'snowflake',
  'redshift',
  'bigquery',
  'data warehouse',
  'data lake',
  'lakehouse',
  'delta lake',
  'iceberg',
  'medallion architecture',
  'glue',
];

function isDataEngineeringRole(title: string, description: string): boolean {
  const titleLower = title.toLowerCase();
  // Title match alone is sufficient for role-name keywords
  if (DE_TITLE_KEYWORDS.some(kw => titleLower.includes(kw))) return true;
  // For technology keywords, require both title to be broadly tech AND description to contain the term
  const descLower = description.toLowerCase();
  return DE_TECH_KEYWORDS.some(kw => descLower.includes(kw));
}

// ── USA / Remote location filter ───────────────────────────────────────────

const US_STATE_ABBR = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const US_PATTERNS = [
  'united states',
  'usa',
  'u.s.a',
  'u.s.',
  ' us ',
  ', us',
  'us-',
  'america',
  'remote',
  'anywhere',
  'worldwide',
];

function isUSOrRemote(location: string): boolean {
  if (!location) return false;
  const loc = location.toLowerCase().trim();

  if (US_PATTERNS.some(p => loc.includes(p))) return true;

  for (const abbr of US_STATE_ABBR) {
    const lower = abbr.toLowerCase();
    if (
      loc.endsWith(`, ${lower}`) ||
      loc.startsWith(`${lower},`) ||
      loc === lower ||
      loc.includes(`, ${lower},`) ||
      new RegExp(`\\b${lower}\\b`).test(loc)
    ) return true;
  }

  return false;
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
    .filter(j => isDataEngineeringRole(j.title, j.description) && isUSOrRemote(j.location));
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
    .filter((j: RawJob) => isDataEngineeringRole(j.title, j.description) && isUSOrRemote(j.location));
}

async function fetchArbeitnow(): Promise<RawJob[]> {
  // Fetch pages 1, 2, 3 in parallel for maximum coverage
  const [page1, page2, page3] = await Promise.allSettled([
    fetchArbeitnowPage(1),
    fetchArbeitnowPage(2),
    fetchArbeitnowPage(3),
  ]);
  return [
    ...(page1.status === 'fulfilled' ? page1.value : []),
    ...(page2.status === 'fulfilled' ? page2.value : []),
    ...(page3.status === 'fulfilled' ? page3.value : []),
  ];
}

// ── Remotive ───────────────────────────────────────────────────────────────
async function fetchRemotive(): Promise<RawJob[]> {
  // Fetch software-dev and data categories
  const [devRes, dataRes] = await Promise.allSettled([
    fetch('https://remotive.com/api/remote-jobs?category=software-dev&limit=100', {
      signal: AbortSignal.timeout(12000),
    }),
    fetch('https://remotive.com/api/remote-jobs?category=data&limit=100', {
      signal: AbortSignal.timeout(12000),
    }),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parseRemotive = async (res: Response): Promise<any[]> => {
    if (!res.ok) throw new Error(`Remotive ${res.status}`);
    const data: { jobs?: unknown[] } = await res.json();
    return data.jobs || [];
  };

  const jobs: unknown[] = [];
  if (devRes.status === 'fulfilled') {
    try { jobs.push(...await parseRemotive(devRes.value)); } catch { /* skip */ }
  }
  if (dataRes.status === 'fulfilled') {
    try { jobs.push(...await parseRemotive(dataRes.value)); } catch { /* skip */ }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (jobs as any[])
    .filter((j: { title?: string; company_name?: string }) => j.title && j.company_name)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((j: any) => ({
      title:       j.title        || 'Data Engineer',
      company:     j.company_name || 'Unknown',
      location:    j.candidate_required_location || 'Remote',
      description: [j.title, j.company_name, j.candidate_required_location, j.description].filter(Boolean).join('\n'),
      url:         j.url          || '',
      source:      'Remotive',
    }))
    .filter((j: RawJob) => isDataEngineeringRole(j.title, j.description) && isUSOrRemote(j.location));
}

// ── POST handler ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const userId = getUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch from all 3 sources in parallel (don't fail if one is down)
    const [remoteOkResult, arbeitnowResult, remotiveResult] = await Promise.allSettled([
      fetchRemoteOK(),
      fetchArbeitnow(),
      fetchRemotive(),
    ]);

    const allRaw: RawJob[] = [
      ...(remoteOkResult.status   === 'fulfilled' ? remoteOkResult.value   : []),
      ...(arbeitnowResult.status  === 'fulfilled' ? arbeitnowResult.value  : []),
      ...(remotiveResult.status   === 'fulfilled' ? remotiveResult.value   : []),
    ];

    const sourceStatus = {
      remoteok:  remoteOkResult.status  === 'fulfilled'
        ? remoteOkResult.value.length
        : (remoteOkResult.reason instanceof Error ? remoteOkResult.reason.message : 'error'),
      arbeitnow: arbeitnowResult.status === 'fulfilled'
        ? arbeitnowResult.value.length
        : (arbeitnowResult.reason instanceof Error ? arbeitnowResult.reason.message : 'error'),
      remotive:  remotiveResult.status  === 'fulfilled'
        ? remotiveResult.value.length
        : (remotiveResult.reason instanceof Error ? remotiveResult.reason.message : 'error'),
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
