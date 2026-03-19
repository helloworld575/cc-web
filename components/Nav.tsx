'use client';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';

export default function Nav() {
  const { data: session } = useSession();
  return (
    <nav className="border-b px-6 py-3 flex gap-6 text-sm items-center">
      <Link href="/" className="font-bold">Home</Link>
      <Link href="/blog">Blog</Link>
      <Link href="/tools">Tools</Link>
      <Link href="/files">Files</Link>
      <div className="ml-auto flex gap-4 items-center">
        {session ? (
          <>
            <Link href="/admin/blog">Admin</Link>
            <button onClick={() => signOut({ callbackUrl: '/' })} className="text-gray-500 hover:text-black">Logout</button>
          </>
        ) : (
          <Link href="/login">Login</Link>
        )}
      </div>
    </nav>
  );
}
