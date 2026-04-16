'use client';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '@/components/useLocale';

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

interface ChatSession {
  id: number;
  provider_id: number;
  title: string;
  updated_at: string;
}

export default function AIChatTool() {
  const { t } = useLocale();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState('');
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch('/api/ai-providers')
      .then(r => r.ok ? r.json() : [])
      .then((list: Provider[]) => {
        setProviders(list);
        const def = list.find(p => p.is_default);
        if (def) setSelectedProvider(def.id);
        else if (list.length > 0) setSelectedProvider(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadChatSessions() {
    const res = await fetch('/api/ai-chat/history');
    if (res.ok) setChatSessions(await res.json());
  }

  function newChat() {
    setMessages([]);
    setCurrentChatId(null);
    setError('');
  }

  async function saveChat(msgs: ChatMessage[]) {
    if (msgs.length === 0 || !selectedProvider) return;
    const title = msgs[0]?.content.slice(0, 50) || 'New Chat';
    if (currentChatId) {
      await fetch(`/api/ai-chat/${currentChatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, messages: msgs }),
      });
    } else {
      const res = await fetch('/api/ai-chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider_id: selectedProvider, title, messages: msgs }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentChatId(data.id);
      }
    }
  }

  async function send() {
    if (!input.trim() || !selectedProvider || streaming) return;
    setError('');

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setStreaming(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    try {
      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: selectedProvider,
          messages: newMessages,
          chat_id: currentChatId,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `HTTP ${res.status}`);
        setMessages(newMessages); // remove the empty assistant msg
        setStreaming(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                fullText += parsed.text;
                setMessages([...newMessages, { role: 'assistant', content: fullText }]);
              }
            } catch {}
          }
        }
      }

      const finalMessages = [...newMessages, { role: 'assistant' as const, content: fullText }];
      setMessages(finalMessages);
      await saveChat(finalMessages);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        setError(e.message || 'Failed to send message');
        setMessages(newMessages);
      }
    }
    abortRef.current = null;
    setStreaming(false);
  }

  function stopStreaming() {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
    setInput(ta.value);
  }

  if (providers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="mb-2">{t('aiChatNoProvider')}</p>
        <a href="/admin/ai-config" className="text-blue-500 hover:underline text-sm">{t('aiChatGoConfig')}</a>
      </div>
    );
  }

  const currentProviderName = providers.find(p => p.id === selectedProvider)?.name || '';

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select
          value={selectedProvider ?? ''}
          onChange={e => { setSelectedProvider(Number(e.target.value)); newChat(); }}
          className="border rounded px-2 py-1 text-sm flex-shrink-0"
        >
          {providers.map(p => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.model})
            </option>
          ))}
        </select>
        <button onClick={newChat} className="border rounded px-2 py-1 text-sm hover:bg-gray-50 flex-shrink-0">
          {t('aiChatNew')}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto border rounded-lg px-4 py-3 mb-3 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-12">
            <p className="text-lg mb-1">{t('aiChatWelcome')}</p>
            <p className="text-sm">{t('aiChatWelcomeDesc')}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-black text-white'
                : 'bg-white border shadow-sm'
            }`}>
              {msg.role === 'assistant' ? (
                <article className="prose prose-sm max-w-none prose-p:my-1 prose-pre:my-1">
                  <ReactMarkdown>{msg.content || '...'}</ReactMarkdown>
                </article>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="text-red-500 text-xs mb-2 px-1">{error}</div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={autoResize}
          onKeyDown={handleKeyDown}
          placeholder={t('aiChatPlaceholder')}
          rows={1}
          className="flex-1 border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-gray-400"
          disabled={streaming}
        />
        {streaming ? (
          <button onClick={stopStreaming}
            className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm flex-shrink-0 hover:bg-red-600">
            {t('aiChatStop')}
          </button>
        ) : (
          <button onClick={send}
            disabled={!input.trim() || !selectedProvider}
            className="bg-black text-white px-4 py-2 rounded-lg text-sm flex-shrink-0 disabled:opacity-40 hover:bg-gray-800">
            {t('aiChatSend')}
          </button>
        )}
      </div>
    </div>
  );
}
