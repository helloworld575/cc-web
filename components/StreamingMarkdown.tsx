'use client';
import ReactMarkdown from 'react-markdown';

interface StreamingMarkdownProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

export default function StreamingMarkdown({
  content,
  streaming = false,
  className = '',
}: StreamingMarkdownProps) {
  return (
    <article
      className={[
        'markdown-stream prose prose-sm max-w-none',
        'prose-headings:font-semibold prose-headings:text-slate-900',
        'prose-p:my-2 prose-p:text-slate-700',
        'prose-li:my-1 prose-strong:text-slate-900',
        'prose-code:rounded prose-code:bg-slate-950/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:text-slate-800 prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:overflow-x-auto prose-pre:rounded-2xl prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-950 prose-pre:px-4 prose-pre:py-3 prose-pre:text-slate-100',
        'prose-a:text-sky-700 prose-a:decoration-sky-300 prose-a:underline-offset-4',
        className,
      ].join(' ')}
    >
      <ReactMarkdown>{content || ' '}</ReactMarkdown>
      {streaming && (
        <span aria-hidden className="stream-caret ml-1 inline-block align-middle" />
      )}
    </article>
  );
}
