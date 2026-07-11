'use client';
import { startTransition, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocale } from '@/components/useLocale';
import StreamingMarkdown from '@/components/StreamingMarkdown';
import { apiErrorTranslationKey, readSafeApiError } from '@/lib/client-api-error';
import type { InvocableSkillSummary } from '@/lib/skill-taxonomy';

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

interface ChatSummary {
  id: number;
  provider_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface ChatDetail extends ChatSummary {
  messages: ChatMessage[];
}

export default function AIChatTool() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [skills, setSkills] = useState<InvocableSkillSummary[]>([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [history, setHistory] = useState<ChatSummary[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [streamStage, setStreamStage] = useState<'ready' | 'dispatch' | 'thinking' | 'rendering'>('ready');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const currentChatIdRef = useRef<number | null>(null);

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

    fetch('/api/skills')
      .then(res => (res.ok ? res.json() : []))
      .then((list: InvocableSkillSummary[]) => setSkills(list))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedProvider) return;
    refreshHistory(selectedProvider);
  }, [selectedProvider]);

  useEffect(() => {
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  function resetComposerHeight() {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function setActiveChatId(chatId: number | null) {
    currentChatIdRef.current = chatId;
    setCurrentChatId(chatId);
  }

  async function localizedError(response: Response) {
    const safe = await readSafeApiError(response, t('apiErrorGeneric'));
    return t(apiErrorTranslationKey(safe.code, 'apiErrorGeneric'));
  }

  async function refreshHistory(providerId = selectedProvider) {
    if (!providerId) return;

    try {
      const response = await fetch(`/api/ai-chat?provider_id=${providerId}`);
      if (!response.ok) throw new Error(await localizedError(response));
      setHistory(await response.json());
    } catch {
      setError(t('aiChatLoadHistoryFailed'));
    }
  }

  async function loadChat(chatId: number) {
    if (streaming) return;

    setLoadingHistory(true);
    setError('');
    try {
      const response = await fetch(`/api/ai-chat/${chatId}`);
      if (!response.ok) throw new Error(await localizedError(response));
      const chat = await response.json() as ChatDetail;
      const providerId = Number(chat.provider_id);
      setActiveChatId(Number(chat.id));
      if (selectedProvider !== providerId) {
        setSelectedProvider(providerId);
      }
      setMessages(chat.messages);
      resetComposerHeight();
    } catch {
      setError(t('aiChatLoadFailed'));
    } finally {
      setLoadingHistory(false);
    }
  }

  function newChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setError('');
    setStreaming(false);
    setStreamStage('ready');
    abortRef.current = null;
    resetComposerHeight();
  }

  async function deleteChat(chat: ChatSummary) {
    if (streaming || deletingChatId) return;
    if (!window.confirm(`${t('aiChatDeleteConfirm')} ${chat.title}`)) return;

    setDeletingChatId(chat.id);
    setError('');
    try {
      const response = await fetch(`/api/ai-chat/${chat.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error(await localizedError(response));

      const chatId = Number(chat.id);
      setHistory(items => items.filter(item => Number(item.id) !== chatId));
      if (currentChatIdRef.current === chatId) {
        newChat();
      }
    } catch {
      setError(t('aiChatDeleteFailed'));
    } finally {
      setDeletingChatId(null);
    }
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
    let fullText = '';

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: currentChatId,
          provider_id: selectedProvider,
          skill: selectedSkill || undefined,
          messages: outboundMessages,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        setError(await localizedError(response));
        setMessages(outboundMessages);
        setStreamStage('ready');
        setStreaming(false);
        return;
      }

      setStreamStage('thinking');

      const reader = response.body?.getReader();
      if (!reader) {
        setError(t('aiChatStreamUnavailable'));
        setMessages(outboundMessages);
        setStreamStage('ready');
        setStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (typeof parsed.chat_id === 'number') {
            setActiveChatId(parsed.chat_id);
          }
          if (typeof parsed.error === 'string' && parsed.error.trim()) {
            const code = typeof parsed.code === 'string' ? parsed.code : null;
            throw new Error(t(apiErrorTranslationKey(code, 'apiErrorGeneric')));
          }
          if (!parsed.text) continue;

          fullText += parsed.text;
          setStreamStage('rendering');
          startTransition(() => {
            setMessages([
              ...outboundMessages,
              { role: 'assistant', content: fullText },
            ]);
          });
        }
      }

      setMessages([
        ...outboundMessages,
        { role: 'assistant', content: fullText },
      ]);
      refreshHistory(selectedProvider);
    } catch (caught: unknown) {
      const errorLike = caught as { name?: string; message?: string };
      const nextMessages = fullText
        ? [...outboundMessages, { role: 'assistant' as const, content: fullText }]
        : outboundMessages;
      if (errorLike?.name !== 'AbortError') {
        setError(errorLike?.message || t('aiChatSendFailed'));
        setMessages(nextMessages);
      } else if (!fullText) {
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
        <p className="text-sm text-slate-500">
          {t('aiChatConfigHint')}
        </p>
      </div>
    );
  }

  const activeProvider = providers.find(provider => provider.id === selectedProvider);
  const activeSkill = skills.find(skill => skill.lookup.invoke === selectedSkill || skill.id === selectedSkill);
  const stageLabel = {
    ready: t('aiChatReady'),
    dispatch: t('aiChatDispatching'),
    thinking: t('aiChatThinking'),
    rendering: t('aiChatRendering'),
  }[streamStage];
  const shellClassName = isFullscreen
    ? 'fixed inset-0 z-[9999] grid h-dvh min-h-0 gap-4 overflow-hidden bg-slate-100 p-3 sm:p-4 lg:grid-cols-[300px_minmax(0,1fr)]'
    : 'grid gap-4 lg:h-[calc(100vh-8rem)] lg:min-h-[680px] lg:grid-cols-[300px_minmax(0,1fr)]';
  const asideClassName = isFullscreen
    ? 'glass-panel min-h-0 overflow-y-auto rounded-[28px] px-5 py-5'
    : 'glass-panel min-h-0 rounded-[28px] px-5 py-5 lg:overflow-y-auto';
  const chatPanelClassName = isFullscreen
    ? 'glass-panel flex min-h-0 flex-col overflow-hidden rounded-[32px] px-4 py-4 sm:px-5 sm:py-5'
    : 'glass-panel flex min-h-[720px] flex-col overflow-hidden rounded-[32px] px-4 py-4 sm:px-5 sm:py-5 lg:min-h-0';

  const chatShell = (
    <div data-testid="ai-chat-shell" data-fullscreen={isFullscreen ? 'true' : 'false'} className={shellClassName}>
      <aside className={asideClassName}>
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('aiChatStudio')}</p>
          <h2 className="mt-2 font-display text-3xl text-slate-900">{t('aiChat')}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {t('aiChatStudioDesc')}
          </p>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('aiChatProvider')}</span>
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

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t('aiChatSkill')}</span>
            <select
              data-testid="ai-chat-skill"
              value={selectedSkill}
              onChange={event => setSelectedSkill(event.target.value)}
              disabled={streaming}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-sky-300 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{t('aiChatNoSkill')}</option>
              {skills.map(skill => (
                <option key={skill.id} value={skill.lookup.invoke}>
                  {skill.name} ({skill.output})
                </option>
              ))}
            </select>
            {activeSkill && (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                {activeSkill.description}
              </p>
            )}
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
                [t('aiChatAsk'), t('aiChatAskDesc')],
                [t('aiChatStream'), t('aiChatStreamDesc')],
                [t('aiChatRefine'), t('aiChatRefineDesc')],
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

          <div className="rounded-2xl border border-slate-200 bg-white/90 p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                {t('aiChatHistory')}
              </p>
              <button
                type="button"
                onClick={() => refreshHistory()}
                disabled={streaming || loadingHistory}
                className="text-xs font-medium text-sky-700 disabled:text-slate-300"
              >
                {t('aiChatRefresh')}
              </button>
            </div>

            {history.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
                {t('aiChatNoHistory')}
              </p>
            ) : (
              <div data-testid="ai-chat-history" className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {history.map(chat => (
                  <div
                    key={chat.id}
                    className={`flex items-stretch gap-2 rounded-xl transition ${
                      currentChatId === chat.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                    } ${streaming ? 'opacity-50' : ''}`}
                  >
                    <button
                      type="button"
                      aria-label={`${t('aiChatOpen')} ${chat.title}`}
                      onClick={() => loadChat(chat.id)}
                      disabled={streaming}
                      className="min-w-0 flex-1 rounded-xl px-3 py-3 text-left disabled:cursor-not-allowed"
                    >
                      <span className="block truncate text-sm font-medium">{chat.title}</span>
                      <span className={`mt-1 block text-xs ${
                        currentChatId === chat.id ? 'text-white/55' : 'text-slate-400'
                      }`}>
                        {new Date(chat.updated_at).toLocaleString()}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`${t('aiChatDelete')} ${chat.title}`}
                      title={t('aiChatDelete')}
                      onClick={() => deleteChat(chat)}
                      disabled={streaming || deletingChatId === chat.id}
                      className={`my-2 mr-2 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        currentChatId === chat.id
                          ? 'bg-white/10 text-white/70 hover:bg-red-500 hover:text-white'
                          : 'bg-white text-slate-400 hover:bg-red-50 hover:text-red-600'
                      }`}
                    >
                      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v5" />
                        <path d="M14 11v5" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className={chatPanelClassName}>
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3 rounded-[24px] border border-white/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(241,245,249,0.88))] px-4 py-4 shadow-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">{t('aiChatSession')}</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">
              {messages.length === 0 ? t('aiChatWelcome') : `${messages.length} ${t('aiChatMessages')}`}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {messages.length === 0 ? t('aiChatWelcomeDesc') : t('aiChatStreamingDesc')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
              <span className="status-dot" />
              {streaming ? t('aiChatLiveResponse') : t('aiChatIdle')}
            </div>
            <button
              type="button"
              aria-label={isFullscreen ? t('aiChatExitFullscreen') : t('aiChatEnterFullscreen')}
              title={isFullscreen ? t('aiChatExitFullscreen') : t('aiChatEnterFullscreen')}
              onClick={() => setIsFullscreen(value => !value)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:text-slate-900 hover:shadow-md"
            >
              {isFullscreen ? (
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v5H3" />
                  <path d="M16 3v5h5" />
                  <path d="M8 21v-5H3" />
                  <path d="M16 21v-5h5" />
                </svg>
              ) : (
                <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9V3h6" />
                  <path d="M21 9V3h-6" />
                  <path d="M3 15v6h6" />
                  <path d="M21 15v6h-6" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.88))] p-3 shadow-inner">
          <div className="pointer-events-none absolute inset-x-6 top-0 h-16 bg-gradient-to-b from-white/75 via-white/35 to-transparent" />
          <div data-testid="ai-chat-scroll" className="relative flex h-full min-h-0 flex-col gap-4 overflow-y-auto scroll-smooth px-1 py-1">
            <div data-testid="ai-chat-messages" className="flex flex-col gap-4">
            {messages.length === 0 && (
              <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
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
                    className={`max-w-[96%] rounded-[24px] px-4 py-3 shadow-sm ${
                      isAssistant
                        ? 'border border-white/80 bg-white/95 text-slate-900 sm:max-w-[92%]'
                        : 'bg-slate-900 text-white sm:max-w-[82%]'
                    }`}
                  >
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em]">
                      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${
                        isAssistant ? 'bg-sky-100 text-sky-700' : 'bg-white/15 text-white'
                      }`}>
                        {isAssistant ? t('aiChatAssistant') : t('aiChatUser')}
                      </span>
                      <span className={isAssistant ? 'text-slate-400' : 'text-white/65'}>
                        {isAssistant && isStreamingMessage
                          ? stageLabel
                          : isAssistant ? t('aiChatAssistant') : t('aiChatUser')}
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
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-3 shrink-0 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-4 shrink-0 rounded-[28px] border border-white/70 bg-white/95 p-3 shadow-sm">
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
            <span>{input.length} {t('aiChatCharacters')}</span>
          </div>
        </div>
      </section>
    </div>
  );

  return isFullscreen && portalHost
    ? createPortal(chatShell, portalHost)
    : chatShell;
}
