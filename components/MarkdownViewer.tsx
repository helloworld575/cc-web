'use client';

import { memo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type ToastViewer from '@toast-ui/editor/viewer';
import { extractMarkdownHeadings } from '@/lib/markdown-headings';

function enhanceViewer(host: HTMLElement, content: string) {
  const headings = extractMarkdownHeadings(content);
  host.querySelectorAll<HTMLHeadingElement>('h2, h3').forEach((heading, index) => {
    const metadata = headings[index];
    if (metadata) heading.id = metadata.id;
    heading.classList.add('scroll-mt-24');
  });
  host.querySelectorAll<HTMLImageElement>('img').forEach(image => {
    image.loading = 'lazy';
    image.decoding = 'async';
  });
}

function MarkdownViewer({ content }: { content: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<ToastViewer | null>(null);

  useEffect(() => {
    let disposed = false;

    async function createViewer() {
      const host = hostRef.current;
      if (!host) return;
      const { default: Viewer } = await import('@toast-ui/editor/viewer');
      if (disposed || !hostRef.current) return;

      viewerRef.current = new Viewer({
        el: host,
        initialValue: content,
        extendedAutolinks: true,
        usageStatistics: false,
      });
      enhanceViewer(host, content);
    }

    void createViewer();
    return () => {
      disposed = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [content]);

  const headings = extractMarkdownHeadings(content);
  const headingQueue = [...headings];

  return (
    <div ref={hostRef} data-testid="blog-post-content" className="max-w-none">
      <div className="toastui-editor-contents">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            img({ ...props }) {
              return <img {...props} loading="lazy" decoding="async" />;
            },
            h2({ children }) {
              const heading = headingQueue.shift();
              return <h2 id={heading?.id} className="scroll-mt-24">{children}</h2>;
            },
            h3({ children }) {
              const heading = headingQueue.shift();
              return <h3 id={heading?.id} className="scroll-mt-24">{children}</h3>;
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

export default memo(MarkdownViewer);
