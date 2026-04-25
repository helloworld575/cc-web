'use client';
import { startTransition, useEffect, useRef, useState } from 'react';
import { useLocale } from '@/components/useLocale';
import StreamingMarkdown from '@/components/StreamingMarkdown';

interface Provider {
  id: number;
  name: string;
  api_type: string;
  model: string;
  is_default: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatTool() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [streamStage, setStreamStage] = useState<'ready' | 'dispatch' | 'thinking' | 'rendering'>('ready');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/ai-providers')
      .then(res => (res.ok ? res.json() : []))
      .then((list: Provider[]) => {
        setProviders(list);
        const defaultProvider = list.find(provider => provider.is_default);
        if (defaultProvider) {
          setSelectedProvider(defaultProvider.id);
          return;
        }

        if (list[0]) {
          setSelectedProvider(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streaming]);

  function resetComposerHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function newChat() {
    setMessages([]);
    setInput('');
    setError('');
    setStreaming(false);
    setStreamStage('ready');
    abortRef.current = null;
    resetComposerHeight();
  }

  async function send() {
    if (!input.trim() || !selectedProvider || streaming) return;

    const userMessage: ChatMessage = { role: 'user', content: input.trim() };
    const outboundMessages = [...messages, userMessage];
    setError('');
    setInput('');
    setStreaming(true);
    setStreamStage('dispatch');
    resetComposerHeight();
    setMessages([...outboundMessages, { role: 'assistant', content: '' }]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProvider,
          messages: outboundMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || `HTTP ${response.status}`);
        setMessages(outboundMessages);
        setStreamStage('ready');
        setStreaming(false);
        return;
      }

      setStreamStage('thinking');

      const reader = response.body?.getReader();
      if (!reader) {
        setError('Stream is unavailable.');
        setMessages(outboundMessages);
        setStreamStage('ready');
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const parsed = JSON.parse(line.slice(6));
            if (!parsed.text) continue;

            fullText += parsed.text;
            setStreamStage('rendering');
            startTransition(() => {
              setMessages([
                ...outboundMessages,
                { role: 'assistant', content: fullText },
              ]);
            });
          } catch {
            continue;
          }
        }
      }

      setMessages([
        ...outboundMessages,
        { role: 'assistant', content: fullText },
      ]);
    } catch (caught: unknown) {
      const errorLike = caught as { name?: string; message?: string };
      if (errorLike?.name !== 'AbortError') {
        setError(errorLike?.message || 'Failed to send message.');
        setMessages(outboundMessages);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamStage('ready');
    }
  }

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamStage('ready');
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  }

  function autoResize(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const target = event.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 220)}px`;
    setInput(target.value);
  }

  if (providers.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-slate-500 shadow-sm backdrop-blur">
        <p className="mb-2 text-base font-medium text-slate-700">{t('aiChatNoProvider')}</p>
        <a href="/admin/ai-config" className="text-sm text-sky-700 underline decoration-sky-300 underline-offset-4">
          {t('aiChatGoConfig')}
        </a>
      </div>
    );
  }

  const activeProvider = providers.find(provider => provider.id === selectedProvider);
  const stageLabel = {
    ready: 'Ready',
    dispatch: 'Dispatching',
    thinking: 'Thinking',
    rendering: 'Streaming markdown',
  }[streamStage];

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="glass-panel rounded-[28px] px-5 py-5">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Chat Studio</p>
          <h2 className="mt-2 font-display text-3xl text-slate-900">{t('aiChat')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Live markdown rendering, gentler motion, and a clearer generation state for every response.
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Provider</span>
            <select
              data-testid="ai-chat-provider"
              value={selectedProvider ?? ''}
              onChange={event => {
                setSelectedProvider(Number(event.target.value));
                newChat();
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100"
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} ({provider.model})
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">{activeProvider?.name}</p>
                <p className="text-xs text-slate-500">{activeProvider?.model}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${
                streaming
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
              }`}>
                {stageLabel}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Ask', 'Prompt and queue'],
                ['Stream', 'Render markdown'],
                ['Refine', 'Stop when ready'],
              ].map(([title, description], index) => (
                <div
                  key={title}
                  className="rounded-2xl bg-slate-50 px-3 py-3 text-left animate-slide-up"
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={newChat}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            {t('aiChatNew')}
          </button>
        </div>
      </aside>

      <section className="glass-panel flex min-h-[640px] flex-col rounded-[32px] px-4 py-4 sm:px-5 sm:py-5">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(241,245,249,0.88))] px-4 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Session</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {messages.length === 0 ? t('aiChatWelcome') : `${messages.length} ${t('aiChatMessages')}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {messages.length === 0 ? t('aiChatWelcomeDesc') : t('aiChatStreamingDesc')}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
            <span className="status-dot" />
            {streaming ? t('aiChatLiveResponse') : t('aiChatIdle')}
          </div>
        </div>

        <div className="relative flex-1 overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-3 shadow-inner">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-16 bg-gradient-to-b from-white/75 via-white/35 to-transparent" />
          <div data-testid="ai-chat-messages" className="relative flex h-full flex-col gap-4 overflow-y-auto px-1 py-1">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="orb-shell mb-5">
                  <span className="orb orb-a" />
                  <span className="orb orb-b" />
                  <span className="orb orb-c" />
                </div>
                <p className="font-display text-3xl text-slate-900">{t('aiChatWelcome')}</p>
                <p className="mt-3 max-w-md text-sm leading-7 text-slate-500">{t('aiChatWelcomeDesc')}</p>
              </div>
            )}

            {messages.map((message, index) => {
              const isAssistant = message.role === 'assistant';
              const isStreamingMessage = streaming && index === messages.length - 1 && isAssistant;

              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex ${isAssistant ? 'justify-start' : 'justify-end'} animate-slide-up`}
                  style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                >
                  <div
                    className={`max-w-[92%] rounded-[24px] px-4 py-3 shadow-sm sm:max-w-[82%] ${
                      isAssistant
                        ? 'border border-white/80 bg-white/95 text-slate-800'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                        isAssistant ? 'bg-sky-100 text-sky-700' : 'bg-white/15 text-white'
                      }`}>
                        {isAssistant ? t('aiChatAssistant') : t('aiChatUser')}
                      </span>
                      <span className={isAssistant ? 'text-slate-400' : 'text-white/65'}>
                        {isAssistant && isStreamingMessage ? stageLabel : message.role}
                      </span>
                    </div>

                    {isAssistant ? (
                      message.content ? (
                        <StreamingMarkdown content={message.content} streaming={isStreamingMessage} />
                      ) : (
                        <div className="space-y-2 py-2">
                          <div className="skeleton-line w-24" />
                          <div className="skeleton-line w-full" />
                          <div className="skeleton-line w-4/5" />
                        </div>
                      )
                    ) : (
                      <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-sm">
          <div className="flex items-end gap-3">
            <textarea
              data-testid="ai-chat-input"
              ref={textareaRef}
              value={input}
              onChange={autoResize}
              onKeyDown={handleKeyDown}
              placeholder={t('aiChatPlaceholder')}
              rows={1}
              className="min-h-[56px] flex-1 resize-none rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700 outline-none transition focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-100"
              disabled={streaming}
            />
            {streaming ? (
              <button
                data-testid="ai-chat-stop"
                onClick={stopStreaming}
                className="rounded-[22px] bg-red-500 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-red-600 hover:shadow-lg"
              >
                {t('aiChatStop')}
              </button>
            ) : (
              <button
                data-testid="ai-chat-send"
                onClick={send}
                disabled={!input.trim() || !selectedProvider}
                className="rounded-[22px] bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {t('aiChatSend')}
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 px-1 text-xs text-slate-400">
            <span>{streaming ? t('aiChatMarkdownRendering') : t('aiChatMarkdownSupport')}</span>
            <span>{input.length} chars</span>
          </div>
        </div>
      </section>
    </div>
  );
}
