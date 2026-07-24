import {
  DEFAULT_CLAUDE_MAX_TOKENS,
  DEFAULT_CLAUDE_MODEL,
  getClaudeApiHost,
  getClaudeMaxTokens,
  getClaudeModel,
} from '@/lib/ai-gateway';

export const ENV_CLAUDE_PROVIDER_ID = -1;
export const ENV_RIGHT_CODE_GPT_PROVIDER_ID = -2;

export type OpenAiApiStyle = 'chat_completions' | 'responses';

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
  api_style?: OpenAiApiStyle;
}

export function getEnvClaudeProvider(): AiProviderConfig | null {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return null;

  return {
    id: ENV_CLAUDE_PROVIDER_ID,
    name: 'Claude Env Default',
    api_type: 'anthropic',
    api_url: getClaudeApiHost(),
    api_key: apiKey,
    model: getClaudeModel() || DEFAULT_CLAUDE_MODEL,
    system_prompt: '',
    max_tokens: getClaudeMaxTokens(DEFAULT_CLAUDE_MAX_TOKENS),
    is_default: 1,
    source: 'env',
  };
}

function readNumberEnv(name: string, fallback: number) {
  const parsed = Number(process.env[name] || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readOpenAiApiStyleEnv(name: string, fallback: OpenAiApiStyle) {
  const configured = process.env[name]?.trim().toLowerCase();
  if (configured === 'responses' || configured === 'response') return 'responses';
  if (configured === 'chat' || configured === 'chat_completions' || configured === 'chat-completions') {
    return 'chat_completions';
  }
  return fallback;
}

export function getEnvRightCodeGptProvider(): AiProviderConfig | null {
  const apiKey = process.env.RIGHT_CODE_GPT_API_KEY || process.env.RIGHT_CODE_API_KEY;
  if (!apiKey) return null;

  return {
    id: ENV_RIGHT_CODE_GPT_PROVIDER_ID,
    name: 'Right Code GPT-5.5 Env',
    api_type: 'openai',
    api_url: (process.env.RIGHT_CODE_GPT_API_URL || process.env.RIGHT_CODE_API_URL || 'https://www.rightapi.ai/codex').replace(/\/+$/, ''),
    api_key: apiKey,
    model: process.env.RIGHT_CODE_GPT_MODEL || 'gpt-5.5',
    system_prompt: '',
    max_tokens: readNumberEnv('RIGHT_CODE_GPT_MAX_TOKENS', 32000),
    is_default: 0,
    source: 'env',
    api_style: readOpenAiApiStyleEnv('RIGHT_CODE_GPT_API_STYLE', 'responses'),
  };
}

export function getEnvProviders(): AiProviderConfig[] {
  const providers = [
    getEnvClaudeProvider(),
    getEnvRightCodeGptProvider(),
  ].filter((provider): provider is AiProviderConfig => Boolean(provider));

  return providers.map((provider, index) => ({
    ...provider,
    is_default: index === 0 ? 1 : 0,
  }));
}

export function getEnvProviderById(id: number) {
  return getEnvProviders().find(provider => provider.id === id) ?? null;
}

export function hasEnvDefaultProvider() {
  return getEnvProviders().some(provider => provider.is_default);
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
