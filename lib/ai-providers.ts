export const ENV_CLAUDE_PROVIDER_ID = -1;

export interface AiProviderConfig {
  id: number;
  name: string;
  api_type: 'openai' | 'anthropic';
  api_url: string;
  api_key: string;
  model: string;
  system_prompt: string;
  max_tokens: number;
  is_default: number;
  source?: 'env' | 'db';
}

export function getEnvClaudeProvider(): AiProviderConfig | null {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;

  return {
    id: ENV_CLAUDE_PROVIDER_ID,
    name: 'Claude Env Default',
    api_type: 'anthropic',
    api_url: (process.env.CLAUDE_API_HOST || 'https://api.anthropic.com').replace(/\/$/, ''),
    api_key: apiKey,
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
    system_prompt: '',
    max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 4096),
    is_default: 1,
    source: 'env',
  };
}

export function maskApiKey(apiKey: string) {
  return apiKey ? `****${apiKey.slice(-4)}` : '';
}

export function toPublicProvider(provider: AiProviderConfig) {
  return {
    ...provider,
    api_key: maskApiKey(provider.api_key),
  };
}
