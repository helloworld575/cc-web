import Link from "next/link";

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-4">Welcome</h1>
      <p className="text-gray-600 mb-8">A personal site with blog, tools, and file storage.</p>
      <div className="flex gap-4">
        <Link href="/blog" className="underline">Blog</Link>
        <Link href="/tools" className="underline">Tools</Link>
        <Link href="/files" className="underline">Files</Link>
      </div>
    </main>
  );
}
