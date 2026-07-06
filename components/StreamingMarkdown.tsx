'use client';
import { Children, isValidElement, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface StreamingMarkdownProps {
  content: string;
  streaming?: boolean;
  className?: string;
}

function splitDelimitedLine(line: string, delimiter: ',' | '\t') {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

function parseDelimitedTable(text: string, delimiter: ',' | '\t') {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => splitDelimitedLine(line, delimiter));

  if (rows.length < 2 || rows[0].length < 2) return null;

  const width = Math.max(...rows.map(row => row.length));
  return rows.map(row => [...row, ...Array.from({ length: width - row.length }, () => '')]);
}

function DataTable({ rows, testId }: { rows: string[][]; testId: string }) {
  const [header, ...body] = rows;

  return (
    <div data-testid={testId} className="my-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-left text-sm text-slate-900">
        <thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-600">
          <tr>
            {header.map((cell, index) => (
              <th key={`${cell}-${index}`} className="border-b border-slate-200 px-3 py-2 font-semibold">
                {cell || `Column ${index + 1}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-slate-50">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="border-b border-slate-100 px-3 py-2 align-top text-slate-800">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarkdownPre({ children, ...props }: { children?: ReactNode }) {
  const child = Children.toArray(children)[0];

  if (isValidElement<{ className?: string; children?: ReactNode }>(child)) {
    const className = child.props.className || '';
    const raw = String(child.props.children || '').replace(/\n$/, '');
    const language = className.match(/language-(csv|tsv)/)?.[1];
    const delimiter = language === 'tsv' ? '\t' : language === 'csv' ? ',' : null;
    const rows = delimiter ? parseDelimitedTable(raw, delimiter) : null;

    if (rows) {
      return <DataTable rows={rows} testId="markdown-csv-table" />;
    }
  }

  return (
    <pre
      {...props}
      className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-slate-50 shadow-inner"
    >
      {children}
    </pre>
  );
}

export default function StreamingMarkdown({
  content,
  streaming = false,
  className = '',
}: StreamingMarkdownProps) {
  return (
    <article
      className={[
        'markdown-stream prose prose-sm max-w-none text-slate-950',
        'prose-headings:font-semibold prose-headings:text-slate-950',
        'prose-p:my-2 prose-p:leading-7 prose-p:text-slate-950',
        'prose-li:my-1 prose-li:text-slate-900 prose-strong:text-slate-950',
        'prose-blockquote:border-slate-300 prose-blockquote:text-slate-800',
        'prose-code:rounded prose-code:bg-slate-950/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.92em] prose-code:font-semibold prose-code:text-slate-950 prose-code:before:content-none prose-code:after:content-none',
        'prose-a:text-sky-700 prose-a:decoration-sky-300 prose-a:underline-offset-4',
        className,
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: MarkdownPre,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table data-testid="markdown-table" className="min-w-full border-collapse text-left text-sm text-slate-900">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-800">
              {children}
            </td>
          ),
        }}
      >
        {content || ' '}
      </ReactMarkdown>
      {streaming && (
        <span aria-hidden className="stream-caret ml-1 inline-block align-middle" />
      )}
    </article>
  );
}
