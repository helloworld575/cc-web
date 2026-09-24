import { describe, expect, it } from 'vitest';
import { DEFAULT_AI_CHAT_SYSTEM_PROMPT } from '@/lib/ai-chat-defaults';

describe('personal workbench agent defaults', () => {
  it('grounds answers in verified facts and does not claim unperformed actions', () => {
    expect(DEFAULT_AI_CHAT_SYSTEM_PROMPT).toContain('rigorous technical assistant');
    expect(DEFAULT_AI_CHAT_SYSTEM_PROMPT).toContain('Separate verified facts from assumptions and unknowns.');
    expect(DEFAULT_AI_CHAT_SYSTEM_PROMPT).toContain('Do not claim actions you did not perform.');
    expect(DEFAULT_AI_CHAT_SYSTEM_PROMPT).toContain('Keep user data and project constraints intact.');
  });
});
