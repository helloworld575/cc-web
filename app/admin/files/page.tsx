'use client';
import { useEffect, useState, useRef } from 'react';

interface FileRecord { id: number; filename: string; original_name: string; mime_type: string; size: number; }

export default function AdminFilesPage() {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetch('/api/files').then(r => r.json()).then(setFiles); }, []);

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/files', { method: 'POST', body: fd });
    if (!res.ok) {
      const { error } = await res.json();
      setError(error ?? 'Upload failed');
    } else {
      const updated = await fetch('/api/files').then(r => r.json());
      setFiles(updated);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Admin — Files</h1>
      <div className="mb-6">
        <input ref={inputRef} type="file" accept="image/*" onChange={upload} className="hidden" id="file-input" />
        <label htmlFor="file-input" className="bg-black text-white px-4 py-2 rounded cursor-pointer">
          {uploading ? 'Uploading...' : 'Upload Image'}
        </label>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {files.map(f => (
          <div key={f.id} className="border rounded overflow-hidden">
            <img src={`/uploads/${f.filename}`} alt={f.original_name} className="w-full h-40 object-cover" />
            <p className="text-xs text-gray-500 px-2 py-1 truncate">{f.original_name}</p>
            <p className="text-xs text-gray-400 px-2 pb-1">{(f.size / 1024).toFixed(1)} KB</p>
          </div>
        ))}
      </div>
    </main>
  );
}
