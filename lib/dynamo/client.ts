/**
 * DynamoDB client and table configuration
 *
 * Single-table design:
 *
 * PK patterns:
 *   USER#{userId}
 *   JOB#{userId}#{jobId}
 *   RESUME#{userId}#{resumeId}
 *   APP#{userId}#{applicationId}
 *   ALERT#{userId}#{alertId}
 *   AUDIT#{userId}#{auditId}
 *
 * SK patterns:
 *   META                     - entity metadata
 *   SCORE#{resumeId}         - score result for a job+resume pair
 *   TAILORED#{jobId}         - tailored resume for a job
 *   NOTE#{noteId}            - application note
 *
 * GSIs:
 *   GSI1: SK + PK  (reverse lookup)
 *   GSI2: userId + status (jobs by status per user)
 *   GSI3: userId + postedAt (jobs by date)
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockDbGet, mockDbPut, mockDbUpdate, mockDbDelete, mockDbQuery } from './mock';

// Use mock DB when AWS credentials are not configured (local dev without AWS setup)
const USE_MOCK = !process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_PROFILE;

const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const TABLE_NAME = process.env.DYNAMODB_TABLE || 'c2c-job-copilot';

// ── Helper wrappers ────────────────────────────────────────────────────────

export async function dbGet<T>(pk: string, sk: string): Promise<T | null> {
  if (USE_MOCK) return mockDbGet<T>(pk, sk);
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  }));
  return (result.Item as T) || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dbPut(item: any): Promise<void> {
  if (USE_MOCK) { mockDbPut(item); return; }
  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: item }));
}

export async function dbUpdate(
  pk: string,
  sk: string,
  updates: Record<string, unknown>
): Promise<void> {
  if (USE_MOCK) { mockDbUpdate(pk, sk, updates); return; }
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const expressions = keys.map((k) => `#${k} = :${k}`);
  const attrNames = Object.fromEntries(keys.map((k) => [`#${k}`, k]));
  const attrValues = Object.fromEntries(keys.map((k) => [`:${k}`, updates[k]]));

  await docClient.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: `SET ${expressions.join(', ')}`,
    ExpressionAttributeNames: attrNames,
    ExpressionAttributeValues: attrValues,
  }));
}

export async function dbDelete(pk: string, sk: string): Promise<void> {
  if (USE_MOCK) { mockDbDelete(pk, sk); return; }
  await docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  }));
}

export async function dbQuery<T>(
  pk: string,
  options?: {
    skPrefix?: string;
    limit?: number;
    indexName?: string;
    filterExpression?: string;
    expressionAttributeValues?: Record<string, unknown>;
    expressionAttributeNames?: Record<string, string>;
  }
): Promise<T[]> {
  if (USE_MOCK) return mockDbQuery<T>(pk, { skPrefix: options?.skPrefix, limit: options?.limit });
  const keyCondition = options?.skPrefix
    ? 'PK = :pk AND begins_with(SK, :skPrefix)'
    : 'PK = :pk';

  const exprValues: Record<string, unknown> = { ':pk': pk };
  if (options?.skPrefix) exprValues[':skPrefix'] = options.skPrefix;
  if (options?.expressionAttributeValues) {
    Object.assign(exprValues, options.expressionAttributeValues);
  }

  const result = await docClient.send(new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: options?.indexName,
    KeyConditionExpression: keyCondition,
    FilterExpression: options?.filterExpression,
    ExpressionAttributeValues: exprValues,
    ExpressionAttributeNames: options?.expressionAttributeNames,
    Limit: options?.limit,
    ScanIndexForward: false,
  }));

  return (result.Items as T[]) || [];
}
