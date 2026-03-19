'use client';
import { useEffect, useState } from 'react';
import Pagination from '@/components/Pagination';

interface FileRecord { id: number; filename: string; original_name: string; mime_type: string; size: number; }
const PAGE_SIZE = 12;

export default function FilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetch('/api/files').then(r => r.json()).then(setFiles);
  }, []);

  const filtered = files.filter(f => f.original_name.toLowerCase().includes(search.toLowerCase()));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Photos</h1>
      <input
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search photos..."
        className="w-full border rounded px-3 py-2 mb-6 text-sm"
      />
      {paged.length === 0 && <p className="text-gray-500">No photos found.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {paged.map(f => (
          <a key={f.id} href={`/uploads/${f.filename}`} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded border">
            <img src={`/uploads/${f.filename}`} alt={f.original_name} className="w-full h-48 object-cover group-hover:opacity-90 transition" />
            <p className="text-xs text-gray-500 px-2 py-1 truncate">{f.original_name}</p>
          </a>
        ))}
      </div>
      <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onPage={setPage} />
    </main>
  );
}

