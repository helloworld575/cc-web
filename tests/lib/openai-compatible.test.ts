import { describe, expect, it } from 'vitest';
import { getOpenAiApiStyle, getOpenAiEndpointUrl } from '@/lib/openai-compatible';

describe('OpenAI-compatible gateway detection', () => {
  it('detects rightapi.ai codex as Responses API and builds the endpoint', () => {
    const provider = { api_url: 'https://www.rightapi.ai/codex' };
    expect(getOpenAiApiStyle(provider)).toBe('responses');
    expect(getOpenAiEndpointUrl(provider)).toBe('https://www.rightapi.ai/codex/v1/responses');
  });

  it('keeps legacy right.codes codex compatibility while not misclassifying ordinary providers', () => {
    expect(getOpenAiApiStyle({ api_url: 'https://www.right.codes/codex' })).toBe('responses');
    expect(getOpenAiApiStyle({ api_url: 'https://api.example.com/codex' })).toBe('chat_completions');
  });
});
