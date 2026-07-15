'use client';

import { useEffect, useRef, useState } from 'react';
import type ToastEditor from '@toast-ui/editor';
import { useLocale } from '@/components/useLocale';

interface Props {
  value: string;
  onChange: (val: string) => void;
  rows?: number;
  textareaTestId?: string;
  previewTestId?: string;
  minHeight?: number;
}

interface UploadResponse {
  ok?: boolean;
  filename?: string;
  url?: string;
  error?: string;
}

type ImageHookCallback = (url: string, text?: string) => void;

function extensionForMime(type: string) {
  if (type === 'image/jpeg') return 'jpg';
  if (type === 'image/gif') return 'gif';
  if (type === 'image/webp') return 'webp';
  return 'png';
}

function fileFromBlob(blob: Blob | File) {
  if (blob instanceof File && blob.name) return blob;
  const type = blob.type || 'image/png';
  return new File([blob], `markdown-image.${extensionForMime(type)}`, { type });
}

export default function MarkdownEditor({
  value,
  onChange,
  rows = 24,
  textareaTestId,
  previewTestId,
  minHeight,
}: Props) {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ToastEditor | null>(null);
  const latestValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [uploadError, setUploadError] = useState('');
  const { locale, t } = useLocale();
  const height = Math.max(minHeight ?? 0, rows * 20);
  const language = locale === 'zh' ? 'zh-CN' : 'en-US';
  const placeholder = t('markdownPlaceholder');

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    latestValueRef.current = value;
    const editor = editorRef.current;
    if (editor && editor.getMarkdown() !== value) {
      editor.setMarkdown(value, false);
    }
  }, [value]);

  useEffect(() => {
    let disposed = false;

    async function uploadImage(blob: Blob | File, callback: ImageHookCallback) {
      const file = fileFromBlob(blob);
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch('/api/files', { method: 'POST', body: formData });
        const data = (await response.json().catch(() => ({}))) as UploadResponse;

        if (!response.ok || !data.url) {
          throw new Error(data.error || 'Image upload failed');
        }

        setUploadError('');
        callback(data.url, file.name.replace(/\.[^.]+$/, '') || data.filename || 'image');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Image upload failed';
        setUploadError(message);
      }
    }

    function applyTestIds(editor: ToastEditor) {
      const host = editorHostRef.current;
      if (!host) return;

      const elements = editor.getEditorElements();
      if (textareaTestId) {
        host.querySelectorAll(`[data-testid="${textareaTestId}"]`).forEach(element => {
          element.removeAttribute('data-testid');
        });

        const editable = host.querySelector(
          '.toastui-editor-md-container [contenteditable="true"].toastui-editor-contents, .toastui-editor-md-container [contenteditable="true"], [contenteditable="true"].toastui-editor-contents, [contenteditable="true"]'
        );
        (editable ?? elements.mdEditor).setAttribute('data-testid', textareaTestId);
      }
      if (previewTestId) {
        elements.mdPreview.setAttribute('data-testid', previewTestId);
      }
    }

    async function createEditor() {
      const host = editorHostRef.current;
      if (!host) return;

      const [{ default: Editor }] = await Promise.all([
        import('@toast-ui/editor'),
        language === 'zh-CN' ? import('@toast-ui/editor/dist/i18n/zh-cn') : Promise.resolve(),
      ]);
      if (disposed || !editorHostRef.current) return;

      host.replaceChildren();

      const editor = new Editor({
        el: host,
        height: `${height}px`,
        minHeight: `${height}px`,
        initialValue: latestValueRef.current,
        initialEditType: 'markdown',
        previewStyle: 'vertical',
        language,
        placeholder,
        autofocus: false,
        usageStatistics: false,
        extendedAutolinks: true,
        toolbarItems: [
          ['heading', 'bold', 'italic', 'strike'],
          ['hr', 'quote'],
          ['ul', 'ol', 'task', 'indent', 'outdent'],
          ['table', 'image', 'link'],
          ['code', 'codeblock'],
        ],
        hooks: {
          addImageBlobHook: (blob, callback) => {
            void uploadImage(blob, callback);
          },
        },
      });

      editorRef.current = editor;
      editor.on('change', () => {
        const currentEditor = editorRef.current;
        if (!currentEditor) return;
        const nextValue = currentEditor.getMarkdown();
        latestValueRef.current = nextValue;
        onChangeRef.current(nextValue);
      });
      applyTestIds(editor);
      window.requestAnimationFrame(() => applyTestIds(editor));
    }

    void createEditor();

    return () => {
      disposed = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
  }, [height, language, placeholder, previewTestId, textareaTestId]);

  return (
    <div className="markdown-editor-shell">
      <div
        ref={editorHostRef}
        className="overflow-hidden rounded-lg border border-slate-200 bg-white"
        data-testid={textareaTestId ? `${textareaTestId}-root` : undefined}
        style={{ minHeight: height }}
      />
      {uploadError && (
        <p
          className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600"
          data-testid={textareaTestId ? `${textareaTestId}-upload-error` : undefined}
        >
          {uploadError}
        </p>
      )}
    </div>
  );
}
