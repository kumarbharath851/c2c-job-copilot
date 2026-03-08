/**
 * AWS Bedrock client for Claude invocations
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const CLAUDE_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

// Mock mode when no AWS credentials are present (local dev / mock DB environment)
const USE_MOCK = !process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE;

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InvokeOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

/**
 * Build mock AI responses for local development.
 * Discriminates by maxTokens:
 *   512  → outreach  (plain-text recruiter message)
 *  1024  → scoring   (JSON job score)
 *  4096  → tailoring (JSON diff sections)
 */
function buildMockResponse(options: InvokeOptions): string {
  const { maxTokens = 4096 } = options;

  // Outreach message
  if (maxTokens <= 512) {
    return `Hi [Recruiter Name],

I came across the [Job Title] role and I'm very interested. With 5+ years of experience in data engineering—building scalable pipelines on Spark, Airflow, and AWS—I believe I can add immediate value to your team.

I'm available for contract/C2C engagements and would love to connect. Would you have 15 minutes this week?

Best regards,
[Your Name]`;
  }

  // Job scoring JSON
  if (maxTokens <= 1024) {
    return JSON.stringify({
      overall: 76,
      mustHaveMatch: 82,
      preferredMatch: 65,
      missingRequirements: ['Kubernetes', 'dbt'],
      c2cConfidence: 88,
      recommendation: 'Apply',
      explanation: 'Strong match on core data engineering skills. Missing dbt and Kubernetes but these are preferred, not required.',
    });
  }

  // Resume tailoring JSON (default — maxTokens 4096)
  return JSON.stringify({
    sections: [
      {
        sectionName: 'summary',
        changeType: 'strengthen_summary',
        original: 'Experienced data engineer with expertise in building pipelines and working with large datasets.',
        tailored: 'Results-driven Data Engineer with 5+ years building mission-critical ETL pipelines on Spark, Airflow, and AWS Redshift. Proven track record of delivering 10x performance improvements and reducing pipeline latency by 40%.',
        explanation: 'Added quantifiable impact metrics and aligned keywords with the job description (Spark, Airflow, AWS Redshift) to improve ATS match score.',
      },
      {
        sectionName: 'skills',
        changeType: 'reorder',
        original: ['Python', 'SQL', 'Java', 'Airflow', 'Spark', 'AWS'],
        tailored: ['Apache Spark', 'Python', 'SQL', 'Apache Airflow', 'AWS Redshift', 'AWS Glue'],
        explanation: 'Reordered and expanded skill labels to match exact terminology used in the job description, maximizing keyword density.',
      },
      {
        sectionName: 'experience_bullets',
        changeType: 'rephrase',
        original: 'Worked on data pipelines to move data from various sources.',
        tailored: 'Architected and maintained 15+ production-grade Spark ETL pipelines ingesting 500GB/day from JDBC, Kafka, and S3 sources into a Redshift data warehouse.',
        explanation: 'Replaced vague language with concrete scope (15+ pipelines, 500GB/day) and specific technologies matching the job requirements.',
      },
    ],
    missingSkillsWarning: ['dbt', 'Kubernetes'],
    overallGuidance: 'Your profile is a strong match for this role. Focus on quantifying your pipeline scale and data volumes in your experience bullets. Add dbt and Kubernetes to your skills only if you have genuine hands-on experience with them.',
  });
}

export async function invokeClaude(
  messages: BedrockMessage[],
  options: InvokeOptions = {}
): Promise<string> {
  // Return deterministic mock when no AWS credentials are configured
  if (USE_MOCK) {
    return buildMockResponse(options);
  }

  const { maxTokens = 4096, temperature = 0.3, systemPrompt } = options;

  const body: Record<string, unknown> = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  const command = new InvokeModelCommand({
    modelId: CLAUDE_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(body),
  });

  const response = await bedrockClient.send(command);
  const parsed = JSON.parse(new TextDecoder().decode(response.body));
  return parsed.content?.[0]?.text || '';
}
