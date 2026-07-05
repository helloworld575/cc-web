export const DEFAULT_CLAUDE_API_HOST = 'https://www.right.codes/claude';
export const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-8';
export const DEFAULT_CLAUDE_MAX_TOKENS = 32000;

export interface TextChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

type ClaudeMessageRole = 'user' | 'assistant';

interface ClaudeTextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

interface ClaudeTextMessage {
  role: ClaudeMessageRole;
  content: ClaudeTextBlock[];
}

export function getClaudeApiHost(configured = process.env.CLAUDE_API_HOST) {
  return (configured || DEFAULT_CLAUDE_API_HOST).replace(/\/+$/, '');
}

export function getClaudeMessagesUrl(configured = process.env.CLAUDE_API_HOST) {
  const baseUrl = getClaudeApiHost(configured);
  if (baseUrl.endsWith('/v1/messages')) return baseUrl;
  if (baseUrl.endsWith('/v1')) return `${baseUrl}/messages`;
  return `${baseUrl}/v1/messages`;
}

export function getClaudeModel() {
  return process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
}

export function getClaudeMaxTokens(fallback = DEFAULT_CLAUDE_MAX_TOKENS) {
  const parsed = Number(process.env.CLAUDE_MAX_TOKENS || fallback);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function buildClaudeHeaders(apiKey: string) {
  return {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
}

export function buildClaudeTextMessages(messages: TextChatMessage[]): ClaudeTextMessage[] {
  const chatMessages = messages.filter(
    (message): message is TextChatMessage & { role: ClaudeMessageRole } => message.role !== 'system',
  );
  const lastUserIndex = chatMessages.map(message => message.role).lastIndexOf('user');

  return chatMessages.map((message, index) => {
    const block: ClaudeTextBlock = {
      type: 'text',
      text: message.content,
    };
    if (message.role === 'user' && index === lastUserIndex) {
      block.cache_control = { type: 'ephemeral' };
    }
    return {
      role: message.role,
      content: [block],
    };
  });
}

export function buildClaudeMessagesPayload(options: {
  model?: string;
  maxTokens?: number;
  messages: TextChatMessage[];
  system?: string;
  stream?: boolean;
}) {
  const payload: Record<string, unknown> = {
    model: options.model || getClaudeModel(),
    max_tokens: options.maxTokens || getClaudeMaxTokens(),
    stream: options.stream ?? true,
    messages: buildClaudeTextMessages(options.messages),
  };

  if (options.system) payload.system = options.system;
  return payload;
}

export function extractClaudeResponseText(data: any) {
  const content = data?.content;
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(block => {
      if (typeof block === 'string') return block;
      if (block?.type === 'text' && typeof block.text === 'string') return block.text;
      if (typeof block?.text === 'string') return block.text;
      return '';
    })
    .join('');
}

export function extractClaudeStreamText(event: any) {
  if (event?.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return typeof event.delta.text === 'string' ? event.delta.text : '';
  }
  return '';
}

export function isClaudeStreamDone(event: any) {
  return event?.type === 'message_stop';
}
