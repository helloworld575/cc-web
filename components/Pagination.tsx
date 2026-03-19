'use client';
import { useState } from 'react';

interface Props {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
}

export default function Pagination({ total, page, pageSize, onPage }: Props) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <div className="flex gap-2 mt-6 items-center justify-center text-sm">
      <button onClick={() => onPage(page - 1)} disabled={page === 1} className="px-3 py-1 border rounded disabled:opacity-40">Prev</button>
      {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
        <button key={p} onClick={() => onPage(p)} className={`px-3 py-1 border rounded ${p === page ? 'bg-black text-white' : ''}`}>{p}</button>
      ))}
      <button onClick={() => onPage(page + 1)} disabled={page === pages} className="px-3 py-1 border rounded disabled:opacity-40">Next</button>
    </div>
  );
}
