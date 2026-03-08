/**
 * AWS Bedrock client for Claude invocations
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

export const CLAUDE_MODEL_ID = 'anthropic.claude-3-5-sonnet-20241022-v2:0';

export interface BedrockMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface InvokeOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export async function invokeClaude(
  messages: BedrockMessage[],
  options: InvokeOptions = {}
): Promise<string> {
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
