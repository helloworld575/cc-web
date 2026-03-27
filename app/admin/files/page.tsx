'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import DateRangeFilter from '@/components/DateRangeFilter';
import Pagination from '@/components/Pagination';
import { useLocale } from '@/components/useLocale';

interface FileRecord { id: number; filename: string; original_name: string; mime_type: string; size: number; uploaded_at: string; album_id: number | null; }
interface Album { id: number; name: string; cover_file_id: number | null; created_at: string; }
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

  // Album state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<string>('');
  const [newAlbumName, setNewAlbumName] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const loadAlbums = useCallback(() => {
    fetch('/api/albums').then(r => r.json()).then(d => setAlbums(d.albums ?? [])).catch(() => {});
  }, []);

  const load = useCallback((p: number, s: string, f: string, tDate: string, albumId: string) => {
    const q = new URLSearchParams({ page: String(p), pageSize: String(PAGE_SIZE), search: s, from: f, to: tDate });
    if (albumId) q.set('album_id', albumId);
    fetch(`/api/files?${q}`).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
      setFiles(data.files ?? []);
      setTotal(data.total ?? 0);
    }).catch(() => {});
  }, []);

  useEffect(() => { loadAlbums(); }, [loadAlbums]);
  useEffect(() => { load(page, search, from, to, activeAlbum); }, [page, search, from, to, activeAlbum, load]);

  async function createAlbum() {
    if (!newAlbumName.trim()) return;
    await fetch('/api/albums', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newAlbumName.trim() }) });
    setNewAlbumName('');
    loadAlbums();
  }

  async function deleteAlbum(id: number) {
    if (!confirm(t('deleteAlbumConfirm'))) return;
    await fetch(`/api/albums/${id}`, { method: 'DELETE' });
    if (activeAlbum === String(id)) setActiveAlbum('');
    loadAlbums();
    load(page, search, from, to, activeAlbum === String(id) ? '' : activeAlbum);
  }

  async function moveFiles(albumId: number | null) {
    await Promise.all(Array.from(selected).map(fid =>
      fetch(`/api/files/${fid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ album_id: albumId }) })
    ));
    setSelected(new Set());
    load(page, search, from, to, activeAlbum);
  }

  async function uploadFiles(selectedFiles: File[]) {
    if (!selectedFiles.length) return;
    setError('');
    setUploading(true);
    let done = 0;
    const errors: string[] = [];
    for (const file of selectedFiles) {
      setProgress(`${++done}/${selectedFiles.length}: ${file.name}`);
      const fd = new FormData();
      fd.append('file', file);
      if (activeAlbum && activeAlbum !== 'none') fd.append('album_id', activeAlbum);
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
    load(1, search, from, to, activeAlbum);
    setPage(1);
  }

  async function deleteFile(id: number) {
    const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    if (!res.ok) return;
    load(page, search, from, to, activeAlbum);
  }

  function toggleSelect(id: number) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }

  function onSearch(v: string) { setSearch(v); setPage(1); }
  function onFrom(v: string) { setFrom(v); setPage(1); }
  function onTo(v: string) { setTo(v); setPage(1); }
  function onReset() { setFrom(''); setTo(''); setPage(1); }

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">{t('adminFiles')}</h1>

      {/* Album management */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <h2 className="text-sm font-semibold mb-2">{t('albums')}</h2>
        <div className="flex gap-2 mb-3">
          <input value={newAlbumName} onChange={e => setNewAlbumName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && createAlbum()}
            placeholder={t('albumName')} className="border rounded px-3 py-1 text-sm flex-1" />
          <button onClick={createAlbum} className="bg-black text-white text-sm px-3 py-1 rounded hover:bg-gray-800">{t('newAlbum')}</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => { setActiveAlbum(''); setPage(1); setSelected(new Set()); }}
            className={`text-xs px-3 py-1 rounded-full border ${!activeAlbum ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>{t('allPhotos')}</button>
          <button onClick={() => { setActiveAlbum('none'); setPage(1); setSelected(new Set()); }}
            className={`text-xs px-3 py-1 rounded-full border ${activeAlbum === 'none' ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>{t('noAlbum')}</button>
          {albums.map(a => (
            <span key={a.id} className="inline-flex items-center gap-1">
              <button onClick={() => { setActiveAlbum(String(a.id)); setPage(1); setSelected(new Set()); }}
                className={`text-xs px-3 py-1 rounded-full border ${activeAlbum === String(a.id) ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>{a.name}</button>
              <button onClick={() => deleteAlbum(a.id)} className="text-xs text-red-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      </div>

      {/* Batch move */}
      {selected.size > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm">
          <span>{selected.size} selected</span>
          <select onChange={e => { const v = e.target.value; if (v === '__remove') moveFiles(null); else if (v) moveFiles(Number(v)); e.target.value = ''; }}
            className="border rounded px-2 py-1 text-sm" defaultValue="">
            <option value="" disabled>{t('moveToAlbum')}</option>
            <option value="__remove">{t('removeFromAlbum')}</option>
            {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      )}

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
          <div key={f.id} className={`border rounded overflow-hidden group relative ${selected.has(f.id) ? 'ring-2 ring-blue-500' : ''}`}>
            <div className="relative w-full cursor-pointer" style={{ paddingBottom: '75%' }} onClick={() => toggleSelect(f.id)}>
              <img src={`/uploads/${f.filename}`} alt={f.original_name} loading="lazy"
                className="absolute inset-0 w-full h-full object-cover" />
              {selected.has(f.id) && <div className="absolute top-1 left-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>}
            </div>
            <p className="text-xs text-gray-500 px-2 py-0.5 truncate">{f.original_name}</p>
            <p className="text-xs text-gray-400 px-2 pb-1">{(f.size / 1024).toFixed(1)} KB · {f.uploaded_at?.slice(0, 10)}</p>
            {/* Per-file album move */}
            <select value={f.album_id ?? ''} onChange={e => {
              const v = e.target.value;
              fetch(`/api/files/${f.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ album_id: v ? Number(v) : null }) })
                .then(() => load(page, search, from, to, activeAlbum));
            }} className="absolute bottom-7 right-1 text-xs bg-white/80 border rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
              <option value="">{t('noAlbum')}</option>
              {albums.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
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
