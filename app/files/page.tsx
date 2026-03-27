'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Pagination from '@/components/Pagination';
import DateRangeFilter from '@/components/DateRangeFilter';
import { useLocale } from '@/components/useLocale';

interface FileRecord { id: number; filename: string; original_name: string; mime_type: string; size: number; uploaded_at: string; album_id: number | null; }
interface Album { id: number; name: string; cover_file_id: number | null; }
const PAGE_SIZE = 24;

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [lightbox, setLightbox] = useState<FileRecord | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbum, setActiveAlbum] = useState<string>('');
  const { t } = useLocale();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
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

  useEffect(() => { load(page, debouncedSearch, from, to, activeAlbum); }, [page, debouncedSearch, from, to, activeAlbum, load]);

  function onSearch(v: string) {
    setSearch(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 300);
  }
  function onFrom(v: string) { setFrom(v); setPage(1); }
  function onTo(v: string) { setTo(v); setPage(1); }
  function onReset() { setFrom(''); setTo(''); setPage(1); }

  // Lightbox keyboard nav
  useEffect(() => {
    if (!lightbox) return;
    const idx = files.findIndex(f => f.id === lightbox.id);
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setLightbox(null);
      if (e.key === 'ArrowRight' && idx < files.length - 1) setLightbox(files[idx + 1]);
      if (e.key === 'ArrowLeft' && idx > 0) setLightbox(files[idx - 1]);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightbox, files]);

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">{t('filesTitle')}</h1>

      {/* Album tabs */}
      {albums.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => { setActiveAlbum(''); setPage(1); }}
            className={`text-sm px-4 py-1.5 rounded-full border ${!activeAlbum ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>{t('allPhotos')}</button>
          {albums.map(a => (
            <button key={a.id} onClick={() => { setActiveAlbum(String(a.id)); setPage(1); }}
              className={`text-sm px-4 py-1.5 rounded-full border ${activeAlbum === String(a.id) ? 'bg-black text-white' : 'hover:bg-gray-100'}`}>{a.name}</button>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder={t('searchPlaceholder')} className="border rounded px-3 py-2 text-sm flex-1" />
      </div>
      <DateRangeFilter from={from} to={to} onFrom={onFrom} onTo={onTo} onReset={onReset} />
      <p className="text-xs text-gray-400 mb-4">{total} photo{total !== 1 ? 's' : ''}</p>
      {files.length === 0 && <p className="text-gray-500">{t('noPosts')}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map(f => (
          <button key={f.id} onClick={() => setLightbox(f)}
            className="group block overflow-hidden rounded border text-left hover:shadow-md transition-shadow">
            <div className="relative w-full" style={{ paddingBottom: '75%' }}>
              <img src={`/uploads/${f.filename}`} alt={f.original_name} loading="lazy"
                className="absolute inset-0 w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
            </div>
            <p className="text-xs text-gray-500 px-2 py-1 truncate">{f.original_name}</p>
          </button>
        ))}
      </div>
      <Pagination total={total} page={page} pageSize={PAGE_SIZE} onPage={setPage} />

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl leading-none opacity-70 hover:opacity-100" onClick={() => setLightbox(null)}>×</button>
          <button className="absolute left-4 text-white text-4xl opacity-70 hover:opacity-100 px-2"
            onClick={e => { e.stopPropagation(); const idx = files.findIndex(f => f.id === lightbox.id); if (idx > 0) setLightbox(files[idx - 1]); }}>‹</button>
          <div className="max-w-4xl max-h-[90vh] mx-12 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
            <img src={`/uploads/${lightbox.filename}`} alt={lightbox.original_name}
              className="max-w-full max-h-[80vh] object-contain rounded shadow-xl" />
            <p className="text-white text-sm opacity-80">{lightbox.original_name} · {(lightbox.size / 1024).toFixed(0)} KB</p>
          </div>
          <button className="absolute right-4 text-white text-4xl opacity-70 hover:opacity-100 px-2"
            onClick={e => { e.stopPropagation(); const idx = files.findIndex(f => f.id === lightbox.id); if (idx < files.length - 1) setLightbox(files[idx + 1]); }}>›</button>
        </div>
      )}
    </main>
  );
}
