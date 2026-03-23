'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';

interface FileRecord { id: number; filename: string; original_name: string; mime_type: string; size: number; uploaded_at: string; }
const PAGE_SIZE = 24;

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocale();

  const load = useCallback((p: number, s: string, f: string, tDate: string) => {
    const q = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), search: s, from: f, to: tDate });
    fetch(`/api/files?${q}`).then(r => r.json()).then(data => {
      setFiles(data.files ?? []);
      setTotal(data.total ?? 0);
    });
  }, []);

  useEffect(() => { load(page, search, from, to); }, [page, search, from, to, load]);

  async function uploadFiles(selected: File[]) {
    if (!selected.length) return;
    setError('');
    setUploading(true);
    let done = 0;
    const errors: string[] = [];
    for (const file of selected) {
      setProgress(`${++done}/${selected.length}: ${file.name}`);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/files', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json();
        errors.push(`${file.name}: ${data.error ?? 'failed'}`);
      }
    }
    setUploading(false);
    setProgress('');
    if (errors.length) setError(errors.join(' | '));
    if (inputRef.current) inputRef.current.value = '';
    load(1, search, from, to);
    setPage(1);
  }

  async function deleteFile(id: number) {
    await fetch(`/api/files/${id}`, { method: 'DELETE' });
    load(page, search, from, to);
  }

  function onSearch(v: string) { setSearch(v); setPage(1); }
  function onFrom(v: string) { setFrom(v); setPage(1); }
  function onTo(v: string) { setTo(v); setPage(1); }
  function onReset() { setFrom(''); setTo(''); setPage(1); }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t('adminFiles')}</h1>
      <div
        onDrop={e => { e.preventDefault(); uploadFiles(Array.from(e.dataTransfer.files)); }}
        onDragOver={e => e.preventDefault()}
        className="border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer hover:border-black transition-colors"
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="image/*" multiple
          onChange={e => uploadFiles(Array.from(e.target.files ?? []))} className="hidden" />
        {uploading
          ? <p className="text-sm text-gray-600">{progress || t('uploading')}</p>
          : <p className="text-sm text-gray-500">{t('uploadHint')}</p>
        }
      </div>
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      <div className="flex gap-2 mb-3">
        <input value={search} onChange={e => onSearch(e.target.value)} placeholder={t('searchPlaceholder')}
          className="border rounded px-3 py-1 text-sm flex-1" />
      </div>
      <DateRangeFilter from={from} to={to} onFrom={onFrom} onTo={onTo} onReset={onReset} />
      <p className="text-xs text-gray-400 mb-4">{total} {t('filesTitle').toLowerCase()}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map(f => (
          <div key={f.id} className="border rounded overflow-hidden group relative">
            <div className="relative w-full" style={{ paddingBottom: '75%' }}>
              <img src={`/uploads/${f.filename}`} alt={f.original_name} loading="lazy"
                className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <p className="text-xs text-gray-500 px-2 py-0.5 truncate">{f.original_name}</p>
            <p className="text-xs text-gray-400 px-2 pb-1">{(f.size / 1024).toFixed(1)} KB · {f.uploaded_at?.slice(0, 10)}</p>
            <button
              onClick={() => { if (confirm(`${t('delete')} "${f.original_name}"?`)) deleteFile(f.id); }}
              className="absolute top-1 right-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >{t('delete')}</button>
          </div>
        ))}
      </div>
      <Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}
