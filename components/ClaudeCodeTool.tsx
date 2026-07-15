'use client';
import { useEffect, useRef, useState } from 'react';
import StreamingMarkdown from '@/components/StreamingMarkdown';
import { useLocale } from '@/components/useLocale';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantChatSummary {
  id: number;
  title: string;
  cwd: string;
  status: 'idle' | 'running';
  created_at: string;
  updated_at: string;
}

interface AssistantChatDetail extends AssistantChatSummary {
  messages: AssistantMessage[];
}

export default function ClaudeCodeTool() {
  const { t } = useLocale();
  const [input, setInput] = useState(() => t('claudeDefaultPrompt'));
  const [cwd, setCwd] = useState('default');
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [history, setHistory] = useState<AssistantChatSummary[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const currentChatIdRef = useRef<number | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    refreshHistory();
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  function setActiveChatId(chatId: number | null) {
    currentChatIdRef.current = chatId;
    setCurrentChatId(chatId);
  }

  async function localizedError(response: Response) {
    const safe = await readSafeApiError(response, t('apiErrorGeneric'));
    return t(apiErrorTranslationKey(safe.code, 'apiErrorGeneric'));
  }

  async function refreshHistory() {
    try {
      const response = await fetch('/api/claude-code');
      if (!response.ok) throw new Error(await localizedError(response));
      setHistory(await response.json() as AssistantChatSummary[]);
    } catch {
      setError(t('claudeLoadHistoryFailed'));
    }
  }

  async function loadChat(chatId: number) {
    if (running || loadingChat) return;
    setLoadingChat(true);
    setError('');
    try {
      const response = await fetch(`/api/claude-code/${chatId}`);
      if (!response.ok) throw new Error(await localizedError(response));
      const chat = await response.json() as AssistantChatDetail;
      setActiveChatId(Number(chat.id));
      setCwd(chat.cwd || 'default');
      setMessages(Array.isArray(chat.messages) ? chat.messages : []);
      setInput('');
    } catch {
      setError(t('claudeLoadChatFailed'));
    } finally {
      setLoadingChat(false);
    }
  }

  function newChat() {
    if (running) return;
    setActiveChatId(null);
    setCwd('default');
    setMessages([]);
    setInput('');
    setError('');
  }

  async function deleteChat(chat: AssistantChatSummary) {
    if (running || deletingChatId) return;
    if (!window.confirm(`${t('claudeDeleteConfirm')} ${chat.title}`)) return;

    setDeletingChatId(chat.id);
    setError('');
    try {
      const response = await fetch(`/api/claude-code/${chat.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await localizedError(response));
      setHistory(items => items.filter(item => item.id !== chat.id));
      if (currentChatIdRef.current === chat.id) newChat();
    } catch {
      setError(t('claudeDeleteFailed'));
    } finally {
      setDeletingChatId(null);
    }
  }

  async function send() {
    const prompt = input.trim();
    if (!prompt || running) return;

    const chatIdBeforeRequest = currentChatIdRef.current;
    const previousMessages = messages;
    const userMessage: AssistantMessage = { role: 'user', content: prompt };
    const pendingMessages: AssistantMessage[] = [
      ...previousMessages,
      userMessage,
      { role: 'assistant', content: '' },
    ];
    setMessages(pendingMessages);
    setInput('');
    setError('');
    setRunning(true);
    let fullText = '';

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch('/api/claude-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: currentChatIdRef.current ?? undefined,
          message: prompt,
          cwd,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setMessages(previousMessages);
        setInput(prompt);
        setError(await localizedError(response));
        return;
      }

      const responseChatId = Number(response.headers.get('X-Claude-Chat-ID'));
      if (Number.isInteger(responseChatId) && responseChatId > 0) {
        setActiveChatId(responseChatId);
      }
      const reader = response.body?.getReader();
      if (!reader) {
        if (chatIdBeforeRequest === null) setActiveChatId(null);
        setMessages(previousMessages);
        setInput(prompt);
        setError(t('claudeStreamUnavailable'));
        return;
      }

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setMessages([
          ...previousMessages,
          userMessage,
          { role: 'assistant', content: fullText },
        ]);
      }
      fullText += decoder.decode();
      setMessages([
        ...previousMessages,
        userMessage,
        { role: 'assistant', content: fullText },
      ]);
      await refreshHistory();
    } catch (caught: unknown) {
      const errorLike = caught as { name?: string };
      if (chatIdBeforeRequest === null) setActiveChatId(null);
      setMessages(previousMessages);
      setInput(prompt);
      setError(errorLike?.name === 'AbortError' ? t('claudeStopped') : t('claudeCallFailed'));
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('claudeAssistantEyebrow')}</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">{t('claudeAssistantTitle')}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{t('claudeAssistantDesc')}</p>
        </div>
        <button
          type="button"
          onClick={newChat}
          disabled={running}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-40"
        >
          {t('claudeNewChat')}
        </button>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <h2 className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{t('claudeHistory')}</h2>
          <div className="mt-1 max-h-[620px] space-y-1 overflow-y-auto">
            {history.length === 0 && (
              <p className="px-2 py-4 text-sm text-slate-500">{t('claudeNoHistory')}</p>
            )}
            {history.map(chat => (
              <div
                key={chat.id}
                className={`group flex items-start gap-1 rounded-xl border p-1 ${currentChatId === chat.id ? 'border-sky-200 bg-sky-50' : 'border-transparent hover:bg-slate-50'}`}
              >
                <button
                  type="button"
                  onClick={() => loadChat(chat.id)}
                  disabled={running || loadingChat}
                  className="min-w-0 flex-1 px-2 py-2 text-left disabled:opacity-50"
                >
                  <span className="block truncate text-sm font-medium text-slate-800">{chat.title}</span>
                  <span className="mt-1 block truncate text-xs text-slate-400">{chat.cwd}</span>
                </button>
                <button
                  type="button"
                  aria-label={`${t('claudeDelete')} ${chat.title}`}
                  title={t('claudeDelete')}
                  onClick={() => deleteChat(chat)}
                  disabled={running || deletingChatId === chat.id}
                  className="rounded-lg px-2 py-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <label className="flex min-w-0 items-center gap-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              <span>{t('claudeWorkspace')}</span>
              <input
                value={cwd}
                onChange={event => setCwd(event.target.value)}
                className="min-w-0 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-normal normal-case tracking-normal text-slate-800 outline-none focus:border-slate-400 disabled:bg-slate-50"
                placeholder="default"
                disabled={running || currentChatId !== null}
              />
            </label>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${running ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {running ? t('claudeRunning') : t('claudeIdle')}
            </span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50/60 p-4 sm:p-6">
            {messages.length === 0 && (
              <div className="flex min-h-80 items-center justify-center text-sm text-slate-400">{t('claudeEmptyReply')}</div>
            )}
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[88%] rounded-2xl px-4 py-3 shadow-sm ${message.role === 'user' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white text-slate-950'}`}>
                  <div className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${message.role === 'user' ? 'text-slate-300' : 'text-slate-400'}`}>
                    {message.role === 'user' ? t('claudeYou') : t('claudeAssistant')}
                  </div>
                  {message.role === 'assistant' ? (
                    message.content
                      ? <StreamingMarkdown content={message.content} streaming={running && index === messages.length - 1} />
                      : <span className="text-sm text-slate-400">{t('claudeRunning')}</span>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>

          <div className="border-t border-slate-100 bg-white p-4">
            <label className="block">
              <span className="sr-only">{t('claudeMessage')}</span>
              <textarea
                value={input}
                onChange={event => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400"
                disabled={running}
                aria-label={t('claudeMessage')}
              />
            </label>
            <div className="mt-3 flex justify-end gap-2">
              {running && (
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700"
                >
                  {t('claudeStop')}
                </button>
              )}
              <button
                type="button"
                onClick={send}
                disabled={running || !input.trim()}
                className="rounded-xl bg-slate-950 px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {running ? t('claudeRunning') : t('claudeSend')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
