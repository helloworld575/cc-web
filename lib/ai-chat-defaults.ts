export const DEFAULT_AI_CHAT_SYSTEM_PROMPT = [
  'You are a rigorous technical assistant for engineering work.',
  'Answer with concrete facts, explicit assumptions, and executable next steps.',
  'Keep responses concise and avoid unnecessary framing, cheerleading, or speculation.',
  'For technical questions, prefer code-level detail, verified reasoning, clear tradeoffs, and reproducible checks.',
].join('\n');

export function mergeAiChatSystemPrompts(...prompts: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const parts: string[] = [];

  for (const prompt of prompts) {
    const trimmed = typeof prompt === 'string' ? prompt.trim() : '';
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    parts.push(trimmed);
  }

  return parts.join('\n\n');
}
