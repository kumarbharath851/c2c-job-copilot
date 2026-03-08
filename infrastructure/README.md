# C2C Job Copilot — Infrastructure

## AWS Architecture Overview

```
                        ┌─────────────────────────────────────────────┐
                        │              Cloudflare Edge                 │
                        │         DNS + CDN + DDoS + HTTPS             │
                        └────────────────────┬────────────────────────┘
                                             │
                        ┌────────────────────▼────────────────────────┐
                        │          AWS Amplify Hosting                 │
                        │    Next.js SSR + Static Assets + CDN         │
                        └────────────────────┬────────────────────────┘
                                             │
                    ┌────────────────────────▼────────────────────────────┐
                    │              Next.js API Routes (Lambda)             │
                    │          /api/jobs  /api/resumes  /api/applications  │
                    │          /api/outreach  /api/alerts  /api/score      │
                    └──────────┬────────────────────────────┬─────────────┘
                               │                            │
              ┌────────────────▼──────────┐   ┌────────────▼──────────────┐
              │      DynamoDB             │   │         S3                │
              │   Single-table design     │   │  Resume files + exports   │
              │   On-demand capacity      │   │  SSE encryption           │
              │   TTL on cache items      │   │  Presigned URLs only      │
              └───────────────────────────┘   └───────────────────────────┘
                               │
              ┌────────────────▼──────────────────────────────────────┐
              │              AWS Bedrock                               │
              │    Claude Sonnet — Resume tailor, scoring, outreach    │
              │    Temperature: 0.2 (tailor), 0.1 (score), 0.5 (msg)  │
              └───────────────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼───────┐  ┌──────────▼──────────┐  ┌──────▼──────────────┐
│ SQS Queues     │  │   EventBridge        │  │  CloudWatch         │
│ ingest-queue   │  │  Scheduled ingestion │  │  Logs + Alarms      │
│ tailor-queue   │  │  Daily digest trigger│  │  X-Ray Tracing      │
└────────────────┘  └─────────────────────┘  └─────────────────────┘
         │
┌────────▼──────────┐
│  Secrets Manager  │
│  DB keys, API keys│
└───────────────────┘
```

---

## DynamoDB Table Design

**Table name:** `c2c-job-copilot`
**Billing:** On-demand (PAY_PER_REQUEST)
**Encryption:** AWS_MANAGED

### Key schema

| Attribute | Type | Description |
|-----------|------|-------------|
| PK | String | Partition key — entity type + userId |
| SK | String | Sort key — entity subtype + entityId |

### Access patterns

| Pattern | PK | SK |
|---------|----|----|
| Get user profile | `USER#<userId>` | `META` |
| List user's jobs | `USER#<userId>` | begins_with `JOB#` |
| List user's resumes | `USER#<userId>` | begins_with `RESUME#` |
| List user's applications | `USER#<userId>` | begins_with `APP#` |
| Get tailored resume | `USER#<userId>` | `TAILORED#<id>` |
| List user's alerts | `USER#<userId>` | begins_with `ALERT#` |

### GSI-1 (optional, for multi-user admin)

| Attribute | Type |
|-----------|------|
| GSI1PK | `JOB_STATUS#<status>` |
| GSI1SK | `INGESTED#<timestamp>` |

---

## S3 Bucket Structure

```
c2c-job-copilot-files/
├── resumes/
│   └── {userId}/
│       └── {resumeId}/
│           └── original.{pdf|docx|txt}
├── exports/
│   └── {userId}/
│       └── {tailoredResumeId}/
│           └── tailored.{pdf|docx}
└── audit/
    └── {userId}/
        └── {auditId}.json     # Full AI prompt+output for audit
```

---

## Amplify Deployment

```bash
# One-time setup
npm install -g @aws-amplify/cli
amplify configure

# Initialize in project root
amplify init

# Add hosting
amplify add hosting
# Select: Hosting with Amplify Console
# Select: Continuous deployment (manual deploy for MVP)

# Deploy
amplify publish
```

### amplify.yml (build settings)

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
      - .next/cache/**/*
```

---

## Cloudflare DNS Setup

```
Type   Name              Value
CNAME  c2ccopilot.com    <amplify-id>.amplifyapp.com
CNAME  www               c2ccopilot.com
TXT    _cf-verification  <amplify-verification-txt>
```

Cloudflare settings:
- Proxy status: **Proxied** (orange cloud) — enables CDN + DDoS
- SSL/TLS: **Full (strict)**
- Caching: Page rules for `/api/*` → Cache Level: **Bypass**
- Cache everything else at Edge TTL 2hr

---

## IAM Role for Amplify / Lambda

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem",
        "dynamodb:DeleteItem", "dynamodb:Query", "dynamodb:Scan"
      ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/c2c-job-copilot*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::c2c-job-copilot-files/*"
    },
    {
      "Effect": "Allow",
      "Action": ["bedrock:InvokeModel"],
      "Resource": "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0"
    },
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:*:secret:c2c-copilot/*"
    },
    {
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:us-east-1:*:c2c-*"
    },
    {
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "*"
    }
  ]
}
```

---

## Cost Estimates (MVP — Low Traffic)

| Service | Configuration | Est. Monthly |
|---------|---------------|-------------|
| Amplify Hosting | Pay-per-use, SSR | $1–8 |
| DynamoDB | On-demand, ~100K requests | $2–10 |
| S3 | 10GB storage + 100K requests | $0.50 |
| Bedrock Claude | 500 AI calls/day × $0.003 avg | $45 |
| CloudWatch | Basic logging | $2 |
| Secrets Manager | 5 secrets | $0.25 |
| **Total** | | **~$50–65/month** |

To reduce Bedrock cost:
- Cache scoring results (TTL 24h) in DynamoDB
- Limit tailoring to user-initiated (not auto)
- Use claude-3-haiku for outreach messages (10x cheaper)

---

## Security Checklist

- [ ] DynamoDB encryption at rest: AWS Managed Key
- [ ] S3 bucket: block all public access, presigned URLs only
- [ ] All secrets in Secrets Manager (no .env with real values in git)
- [ ] API routes validate user ownership via JWT userId claim
- [ ] Zod validation on all input boundaries
- [ ] Rate limiting via Edge middleware (middleware.ts)
- [ ] CloudWatch alarms: 5xx > 5/min, Bedrock token usage > threshold
- [ ] AI output never auto-applied without user review (diff-first)
- [ ] Audit log for every AI generation (prompt + output hash + user)
- [ ] GDPR/CCPA: data deletion endpoint at DELETE /api/users/me

---

## Development Milestones

### Milestone 1 — Core MVP (Weeks 1–3)
- [ ] Amplify hosting deployed
- [ ] DynamoDB table + S3 bucket provisioned
- [ ] Job ingestion from URL (POST /api/jobs)
- [ ] C2C classifier working
- [ ] Resume upload + text parsing
- [ ] Match scoring (AI)
- [ ] Application tracker (Kanban)
- [ ] Dashboard with metrics

### Milestone 2 — Resume Tailoring (Weeks 4–5)
- [ ] Resume diff viewer implemented
- [ ] AI tailoring endpoint + polling
- [ ] Outreach message generator
- [ ] Missing skills warning
- [ ] Audit log

### Milestone 3 — Discovery & Alerts (Weeks 6–7)
- [ ] Job filters + search
- [ ] Saved searches / alerts UI
- [ ] Deduplication fingerprint
- [ ] Score badge on all job cards

### Milestone 4 — Polish & Production (Week 8)
- [ ] Cloudflare custom domain
- [ ] Rate limiting + security headers
- [ ] CloudWatch alarms
- [ ] User authentication (NextAuth)
- [ ] GDPR delete endpoint
- [ ] Mobile responsive QA

### V2 Features (Post-Launch)
- [ ] Greenhouse/Lever API integration
- [ ] Email digest (SES)
- [ ] Browser extension (Chrome MV3)
- [ ] Screening question generator
- [ ] Interview prep pack
- [ ] Skill gap analysis widget
