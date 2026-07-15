const SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidSessionId(value) {
  return typeof value === 'string' && SESSION_ID_PATTERN.test(value);
}

export function buildClaudeArgs({ prompt, sessionId, resume, systemPrompt }) {
  if (!isValidSessionId(sessionId)) {
    throw new Error('Invalid Claude session id');
  }

  return [
    '-p',
    prompt,
    '--output-format',
    'text',
    '--append-system-prompt',
    systemPrompt,
    resume ? '--resume' : '--session-id',
    sessionId,
  ];
}
