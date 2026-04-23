'use client';
import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocale } from '@/components/useLocale';

interface Props {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  textareaTestId?: string;
  previewTestId?: string;
}

export default function MarkdownEditor({ value, onChange, rows = 24, textareaTestId, previewTestId }: Props) {
  const height = rows * 20;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');
  const { t } = useLocale();

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + '  ' + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 2; });
    }
  }

  return (
    <div className="border rounded overflow-hidden">
      {/* Mobile tab bar */}
      <div className="md:hidden flex border-b text-sm">
        <button onClick={() => setMobileTab('write')}
          className={`flex-1 py-2 font-medium transition-colors ${mobileTab === 'write' ? 'bg-white border-b-2 border-black' : 'bg-gray-50 text-gray-500'}`}>
          {t('write')}
        </button>
        <button onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 font-medium transition-colors ${mobileTab === 'preview' ? 'bg-white border-b-2 border-black' : 'bg-gray-50 text-gray-500'}`}>
          {t('preview')}
        </button>
      </div>

      {/* Mobile: single pane */}
      <div className="md:hidden" style={{ height }}>
        {mobileTab === 'write' ? (
          <textarea
            data-testid={textareaTestId}
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-full w-full resize-none bg-white p-3 font-mono text-sm text-slate-800 focus:outline-none"
            placeholder={t('markdownPlaceholder')}
            spellCheck={false}
          />
        ) : (
          <div data-testid={previewTestId} className="h-full overflow-y-auto p-4 prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{value}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Desktop: split pane */}
      <div className="hidden md:flex" style={{ height }}>
        <textarea
          data-testid={textareaTestId}
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-full w-1/2 resize-none border-r bg-white p-3 font-mono text-sm text-slate-800 focus:outline-none"
          placeholder="Write markdown here..."
          spellCheck={false}
        />
        <div data-testid={previewTestId} className="w-1/2 h-full overflow-y-auto p-4 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
