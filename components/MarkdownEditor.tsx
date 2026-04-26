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
  previewToggleTestId?: string;
  minHeight?: number;
}

export default function MarkdownEditor({ value, onChange, rows = 24, textareaTestId, previewTestId, previewToggleTestId, minHeight }: Props) {
  const height = Math.max(minHeight ?? 0, rows * 20);
  const mobileTextareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [mobileTab, setMobileTab] = useState<'write' | 'preview'>('write');
  const [previewEnabled, setPreviewEnabled] = useState(true);
  const { t } = useLocale();

  function getActiveTextarea() {
    return activeTextareaRef.current ?? desktopTextareaRef.current ?? mobileTextareaRef.current;
  }

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

  function replaceSelection(nextText: string, nextStart: number, nextEnd: number) {
    onChange(nextText);
    requestAnimationFrame(() => {
      const el = getActiveTextarea();
      if (!el) return;
      el.focus();
      el.selectionStart = nextStart;
      el.selectionEnd = nextEnd;
    });
  }

  function wrapSelection(prefix: string, suffix = prefix, placeholder = 'text') {
    const el = getActiveTextarea();
    if (!el) return;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (start === end && value.trim()) {
      start = 0;
      end = value.length;
    }
    const selected = value.slice(start, end) || placeholder;
    const inserted = `${prefix}${selected}${suffix}`;
    replaceSelection(value.slice(0, start) + inserted + value.slice(end), start + prefix.length, start + prefix.length + selected.length);
  }

  function prefixLines(prefix: string) {
    const el = getActiveTextarea();
    if (!el) return;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (start === end && value.trim()) {
      start = 0;
      end = value.length;
    }
    const selected = value.slice(start, end) || 'item';
    const inserted = selected.split('\n').map(line => `${prefix}${line}`).join('\n');
    replaceSelection(value.slice(0, start) + inserted + value.slice(end), start + prefix.length, start + inserted.length);
  }

  function insertLink() {
    const el = getActiveTextarea();
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || 'link';
    const inserted = `[${selected}](https://)`;
    replaceSelection(value.slice(0, start) + inserted + value.slice(end), start + 1, start + 1 + selected.length);
  }

  function togglePreview() {
    setPreviewEnabled(enabled => {
      if (enabled) setMobileTab('write');
      return !enabled;
    });
  }

  return (
    <div className="border rounded overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 px-2 py-2 text-sm">
        <button data-testid="markdown-toolbar-bold" type="button" onClick={() => wrapSelection('**')} className="rounded border bg-white px-2 py-1 font-bold hover:bg-slate-100">B</button>
        <button data-testid="markdown-toolbar-italic" type="button" onClick={() => wrapSelection('*')} className="rounded border bg-white px-2 py-1 italic hover:bg-slate-100">I</button>
        <button data-testid="markdown-toolbar-heading" type="button" onClick={() => prefixLines('### ')} className="rounded border bg-white px-2 py-1 hover:bg-slate-100">H3</button>
        <button data-testid="markdown-toolbar-list" type="button" onClick={() => prefixLines('- ')} className="rounded border bg-white px-2 py-1 hover:bg-slate-100">List</button>
        <button data-testid="markdown-toolbar-check" type="button" onClick={() => prefixLines('- [ ] ')} className="rounded border bg-white px-2 py-1 hover:bg-slate-100">Task</button>
        <button data-testid="markdown-toolbar-quote" type="button" onClick={() => prefixLines('> ')} className="rounded border bg-white px-2 py-1 hover:bg-slate-100">Quote</button>
        <button data-testid="markdown-toolbar-code" type="button" onClick={() => wrapSelection('`')} className="rounded border bg-white px-2 py-1 font-mono hover:bg-slate-100">Code</button>
        <button data-testid="markdown-toolbar-link" type="button" onClick={insertLink} className="rounded border bg-white px-2 py-1 hover:bg-slate-100">Link</button>
        <button
          data-testid={previewToggleTestId}
          type="button"
          onClick={togglePreview}
          className={`ml-auto rounded border px-3 py-1 text-xs font-medium transition ${previewEnabled ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
        >
          {previewEnabled ? t('previewOn') : t('previewOff')}
        </button>
      </div>

      {/* Mobile tab bar */}
      {previewEnabled && <div className="md:hidden flex border-b text-sm">
        <button onClick={() => setMobileTab('write')}
          className={`flex-1 py-2 font-medium transition-colors ${mobileTab === 'write' ? 'bg-white border-b-2 border-black' : 'bg-gray-50 text-gray-500'}`}>
          {t('write')}
        </button>
        <button onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 font-medium transition-colors ${mobileTab === 'preview' ? 'bg-white border-b-2 border-black' : 'bg-gray-50 text-gray-500'}`}>
          {t('preview')}
        </button>
      </div>}

      {/* Mobile: single pane */}
      <div className="md:hidden" style={{ height }}>
        {!previewEnabled || mobileTab === 'write' ? (
          <textarea
            data-testid={textareaTestId ? `${textareaTestId}-mobile` : undefined}
            ref={mobileTextareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={e => { activeTextareaRef.current = e.currentTarget; }}
            onKeyDown={handleKeyDown}
            className="h-full w-full resize-none bg-white p-3 font-mono text-sm text-slate-800 focus:outline-none"
            placeholder={t('markdownPlaceholder')}
            spellCheck={false}
            style={{ minHeight: height }}
          />
        ) : (
          <div data-testid={previewTestId ? `${previewTestId}-mobile` : undefined} className="h-full overflow-y-auto p-4 prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{value}</ReactMarkdown>
          </div>
        )}
      </div>

      {/* Desktop: split pane */}
      <div className="hidden md:flex" style={{ height }}>
        <textarea
          data-testid={textareaTestId}
          ref={desktopTextareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={e => { activeTextareaRef.current = e.currentTarget; }}
          onKeyDown={handleKeyDown}
          className={`${previewEnabled ? 'w-1/2 border-r' : 'w-full'} h-full resize-none bg-white p-3 font-mono text-sm text-slate-800 focus:outline-none`}
          placeholder={t('markdownPlaceholder')}
          spellCheck={false}
          style={{ minHeight: height }}
        />
        {previewEnabled && <div data-testid={previewTestId} className="w-1/2 h-full overflow-y-auto p-4 prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown>{value}</ReactMarkdown>
        </div>}
      </div>
    </div>
  );
}
