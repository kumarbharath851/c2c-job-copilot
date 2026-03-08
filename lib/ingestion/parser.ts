/**
 * Job Description Parser
 *
 * Parses raw JD text into structured Job fields.
 * Uses regex + pattern matching for deterministic fields.
 * Passes to Bedrock only for skill extraction (optional).
 */

import type { ParsedSkill, WorkMode, EmploymentType } from '@/lib/types/job';
import crypto from 'crypto';

export interface ParsedJobDescription {
  title?: string;
  company?: string;
  location?: string;
  workMode: WorkMode;
  employmentType: EmploymentType;
  contractDuration?: string;
  rateMin?: number;
  rateMax?: number;
  requiredSkills: ParsedSkill[];
  preferredSkills: ParsedSkill[];
  visaWording?: string;
  fingerprint: string;
}

// ── Known skills dictionary (expandable) ───────────────────────────────────

const SKILL_PATTERNS: Array<{ name: string; aliases: RegExp; category: ParsedSkill['category'] }> = [
  { name: 'Apache Spark',    aliases: /\bspark\b/i,                         category: 'framework' },
  { name: 'PySpark',         aliases: /\bpyspark\b/i,                       category: 'framework' },
  { name: 'Python',          aliases: /\bpython\b/i,                        category: 'language' },
  { name: 'SQL',             aliases: /\bsql\b/i,                           category: 'language' },
  { name: 'Scala',           aliases: /\bscala\b/i,                         category: 'language' },
  { name: 'Java',            aliases: /\bjava\b(?!script)/i,                category: 'language' },
  { name: 'Databricks',      aliases: /\bdatabricks\b/i,                    category: 'platform' },
  { name: 'Snowflake',       aliases: /\bsnowflake\b/i,                     category: 'platform' },
  { name: 'dbt',             aliases: /\bdbt\b/i,                           category: 'tool' },
  { name: 'Apache Airflow',  aliases: /\bairflow\b/i,                       category: 'tool' },
  { name: 'Apache Kafka',    aliases: /\bkafka\b/i,                         category: 'framework' },
  { name: 'Apache Flink',    aliases: /\bflink\b/i,                         category: 'framework' },
  { name: 'Apache Iceberg',  aliases: /\biceberg\b/i,                       category: 'framework' },
  { name: 'Delta Lake',      aliases: /\bdelta\s*lake\b|\bdelta\b/i,        category: 'framework' },
  { name: 'AWS',             aliases: /\baws\b/i,                           category: 'cloud' },
  { name: 'AWS Glue',        aliases: /\baws\s+glue\b|\bglue\b/i,          category: 'cloud' },
  { name: 'Amazon Redshift', aliases: /\bredshift\b/i,                      category: 'database' },
  { name: 'Amazon S3',       aliases: /\bs3\b/i,                            category: 'cloud' },
  { name: 'AWS Lambda',      aliases: /\blambda\b/i,                        category: 'cloud' },
  { name: 'Google BigQuery', aliases: /\bbigquery\b/i,                      category: 'platform' },
  { name: 'GCP',             aliases: /\bgcp\b|google\s+cloud/i,            category: 'cloud' },
  { name: 'Azure',           aliases: /\bazure\b/i,                         category: 'cloud' },
  { name: 'Azure Databricks',aliases: /\bazure\s+databricks\b/i,           category: 'platform' },
  { name: 'Hadoop',          aliases: /\bhadoop\b/i,                        category: 'framework' },
  { name: 'Hive',            aliases: /\bhive\b/i,                          category: 'tool' },
  { name: 'PostgreSQL',      aliases: /\bpostgres(?:ql)?\b/i,               category: 'database' },
  { name: 'MySQL',           aliases: /\bmysql\b/i,                         category: 'database' },
  { name: 'MongoDB',         aliases: /\bmongodb\b/i,                       category: 'database' },
  { name: 'Elasticsearch',   aliases: /\belasticsearch\b|\belastic\b/i,     category: 'database' },
  { name: 'Terraform',       aliases: /\bterraform\b/i,                     category: 'tool' },
  { name: 'Docker',          aliases: /\bdocker\b/i,                        category: 'tool' },
  { name: 'Kubernetes',      aliases: /\bkubernetes\b|\bk8s\b/i,            category: 'tool' },
  { name: 'Git',             aliases: /\bgit\b/i,                           category: 'tool' },
  { name: 'CI/CD',           aliases: /\bci\/cd\b|\bcicd\b/i,              category: 'tool' },
  { name: 'Apache Nifi',     aliases: /\bnifi\b/i,                          category: 'tool' },
  { name: 'Astronomer',      aliases: /\bastronomer\b/i,                    category: 'platform' },
  { name: 'Great Expectations', aliases: /\bgreat\s+expectations\b/i,      category: 'tool' },
];

// ── Rate extraction ────────────────────────────────────────────────────────

function extractRate(text: string): { min?: number; max?: number } {
  // Match patterns like $90-110/hr, $90/hr, $90 - $110 per hour
  const rangeMatch = text.match(/\$\s*(\d+)\s*[-–]\s*\$?\s*(\d+)\s*(?:\/|\s+per\s+)\s*(?:hr|hour)/i);
  if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };

  const singleMatch = text.match(/\$\s*(\d+)\s*(?:\/|\s+per\s+)\s*(?:hr|hour)/i);
  if (singleMatch) return { min: parseInt(singleMatch[1]) };

  return {};
}

// ── Contract duration extraction ───────────────────────────────────────────

function extractDuration(text: string): string | undefined {
  const match = text.match(
    /(\d+)\s*(?:\+\s*)?(?:month|months|mo|year|years|yr)\s*(?:contract|engagement|assignment)?/i
  );
  if (match) return match[0].trim();
  if (/long[\s-]term/i.test(text)) return 'Long-term';
  if (/short[\s-]term/i.test(text)) return 'Short-term';
  return undefined;
}

// ── Work mode detection ────────────────────────────────────────────────────

function detectWorkMode(text: string): WorkMode {
  if (/\bhybrid\b/i.test(text)) return 'hybrid';
  if (/\bon[\s-]?site\b|\bonsite\b|in[\s-]?person|in[\s-]?office/i.test(text)) return 'onsite';
  if (/\bremote\b|\bwork\s+from\s+home\b|\bwfh\b/i.test(text)) return 'remote';
  return 'remote'; // Default assumption for DE contracts
}

// ── Employment type detection ──────────────────────────────────────────────

function detectEmploymentType(text: string): EmploymentType {
  if (/contract[\s-]?to[\s-]?(?:hire|perm(?:anent)?)/i.test(text)) return 'contract_to_hire';
  if (/\bcontract\b|\bcontractor\b|\bc2c\b|corp[\s-]?to[\s-]?corp/i.test(text)) return 'contract';
  if (/full[\s-]?time\s+employee|permanent\s+position|direct\s+hire/i.test(text)) return 'fulltime';
  return 'contract';
}

// ── Visa wording extraction ────────────────────────────────────────────────

function extractVisaWording(text: string): string | undefined {
  // Extract the paragraph/sentence containing visa or C2C wording
  const sentences = text.split(/[.\n]/);
  const relevant = sentences.filter(s =>
    /visa|c2c|corp[\s-]?to[\s-]?corp|w[\s-]?2|1099|sponsorship|work\s+auth/i.test(s)
  );
  return relevant.length > 0 ? relevant.slice(0, 3).join('. ').trim() : undefined;
}

// ── Skill extraction ───────────────────────────────────────────────────────

function extractSkills(text: string): { required: ParsedSkill[]; preferred: ParsedSkill[] } {
  const required: ParsedSkill[] = [];
  const preferred: ParsedSkill[] = [];

  // Find "required" and "preferred" sections
  const requiredSection = text.match(
    /(?:required|must\s+have|must[\s-]have)[^]*?(?=preferred|nice[\s-]to[\s-]have|bonus|responsibilities|$)/is
  )?.[0] || text;

  const preferredSection = text.match(
    /(?:preferred|nice[\s-]to[\s-]have|bonus)[^]*?(?=required|responsibilities|about\s+us|$)/is
  )?.[0] || '';

  const seenRequired = new Set<string>();
  const seenPreferred = new Set<string>();

  for (const skill of SKILL_PATTERNS) {
    if (skill.aliases.test(requiredSection) && !seenRequired.has(skill.name)) {
      required.push({ name: skill.name, category: skill.category });
      seenRequired.add(skill.name);
    }
    if (skill.aliases.test(preferredSection) && !seenPreferred.has(skill.name)) {
      if (!seenRequired.has(skill.name)) {
        preferred.push({ name: skill.name, category: skill.category });
        seenPreferred.add(skill.name);
      }
    }
  }

  return { required, preferred };
}

// ── Fingerprint for deduplication ─────────────────────────────────────────

export function buildFingerprint(
  title: string,
  company: string,
  location: string,
  descriptionSnippet: string
): string {
  const normalized = [
    title.toLowerCase().trim(),
    company.toLowerCase().trim(),
    location.toLowerCase().trim(),
    descriptionSnippet.slice(0, 500).toLowerCase().replace(/\s+/g, ' ').trim(),
  ].join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// ── Main parse function ────────────────────────────────────────────────────

export function parseJobDescription(rawText: string, sourceUrl: string): ParsedJobDescription {
  const { min: rateMin, max: rateMax } = extractRate(rawText);
  const { required: requiredSkills, preferred: preferredSkills } = extractSkills(rawText);

  // Extract title from first line (best guess)
  const firstLine = rawText.split('\n').find(l => l.trim().length > 5)?.trim();

  return {
    title: firstLine?.slice(0, 100),
    workMode: detectWorkMode(rawText),
    employmentType: detectEmploymentType(rawText),
    contractDuration: extractDuration(rawText),
    rateMin,
    rateMax,
    requiredSkills,
    preferredSkills,
    visaWording: extractVisaWording(rawText),
    fingerprint: buildFingerprint(
      firstLine || '',
      '',
      '',
      rawText
    ),
  };
}
