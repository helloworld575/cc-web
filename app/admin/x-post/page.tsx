'use client';
import { useEffect, useState, useRef } from 'react';

interface BlogPost { slug: string; title: string; date: string; brief: string; }
interface DiaryEntry { id: number; date: string; content: string; }
interface SiteFile { id: number; filename: string; original_name: string; mime_type: string; size: number; }

export default function AdminPostToXPage() {
  const [tab, setTab] = useState<'blog' | 'diary' | 'custom'>('blog');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [diaries, setDiaries] = useState<DiaryEntry[]>([]);
  const [selectedContent, setSelectedContent] = useState('');
  const [selectedTitle, setSelectedTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [tweetMode, setTweetMode] = useState<'single' | 'thread'>('single');
  const [tweetText, setTweetText] = useState('');
  const [threadTexts, setThreadTexts] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [xAuthStatus, setXAuthStatus] = useState<string>('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Site files picker state
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [siteFiles, setSiteFiles] = useState<SiteFile[]>([]);
  const [siteFilesPage, setSiteFilesPage] = useState(1);
  const [siteFilesTotal, setSiteFilesTotal] = useState(0);
  const [loadingSiteFiles, setLoadingSiteFiles] = useState(false);

  useEffect(() => {
    fetch('/api/blog').then(r => r.ok ? r.json() : []).then(setPosts).catch(() => {});
    fetch('/api/diary').then(r => r.ok ? r.json() : []).then(setDiaries).catch(() => {});
    fetch('/api/x-auth').then(r => r.json()).then(d => {
      setXAuthStatus(d.authenticated ? '✓ Connected' : '✗ ' + (d.help || d.message || 'Not configured'));
    }).catch(() => setXAuthStatus('✗ Failed to check'));
  }, []);

  async function loadSiteFiles(page: number = 1) {
    setLoadingSiteFiles(true);
    const res = await fetch(`/api/files?page=${page}&pageSize=12`);
    if (res.ok) {
      const data = await res.json();
      setSiteFiles(data.files);
      setSiteFilesTotal(data.total);
      setSiteFilesPage(page);
    }
    setLoadingSiteFiles(false);
  }

  function openFilePicker() {
    setShowFilePicker(true);
    loadSiteFiles(1);
  }

  async function selectSiteFile(file: SiteFile) {
    if (images.length >= 4) {
      setResult({ ok: false, msg: 'Maximum 4 images per tweet' });
      return;
    }
    // Fetch the file from the server and convert to File object
    const res = await fetch(`/api/uploads/${file.filename}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const fileObj = new File([blob], file.original_name, { type: file.mime_type });
    const newImages = [...images, fileObj];
    setImages(newImages);
    setImagePreviews([...imagePreviews, `/api/uploads/${file.filename}`]);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 4) {
      setResult({ ok: false, msg: 'Maximum 4 images per tweet' });
      return;
    }
    const newImages = [...images, ...files];
    setImages(newImages);
    const newPreviews = [...imagePreviews];
    for (const file of files) {
      newPreviews.push(URL.createObjectURL(file));
    }
    setImagePreviews(newPreviews);
  }

  function removeImage(index: number) {
    const preview = imagePreviews[index];
    if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  }

  async function generateTweet() {
    if (!selectedContent) return;
    setGenerating(true);
    setResult(null);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_id: await getDefaultProviderId(),
          messages: [{ role: 'user', content: buildPrompt() }],
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        setResult({ ok: false, msg: d.error || 'AI generation failed' });
        setGenerating(false);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) fullText += parsed.text;
            } catch {}
          }
        }
      }

      try {
        const jsonStr = fullText.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
        const data = JSON.parse(jsonStr);
        if (data.mode === 'thread' && Array.isArray(data.tweets)) {
          setTweetMode('thread');
          setThreadTexts(data.tweets);
          setTweetText('');
        } else {
          setTweetMode('single');
          setTweetText(data.tweet || fullText);
          setThreadTexts([]);
        }
      } catch {
        setTweetMode('single');
        setTweetText(fullText.slice(0, 280));
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    }
    setGenerating(false);
  }

  function buildPrompt(): string {
    return `You are a social media copywriter. Convert this content into X/Twitter post(s).

Output ONLY valid JSON:
- Single: {"mode": "single", "tweet": "text ≤280 chars"}
- Thread: {"mode": "thread", "tweets": ["1/ ...", "2/ ...", "3/ ..."]}

Rules:
- Hook first — lead with the most interesting point
- Each tweet ≤ 280 characters
- Match source language
- Be conversational, specific, no corporate tone
- Thread: 3-8 tweets, number them "1/", "2/", etc.

Title: ${selectedTitle}
URL: https://www.thomaslee.site/blog/${selectedTitle}

<content>
${selectedContent}
</content>`;
  }

  async function getDefaultProviderId(): Promise<number> {
    const res = await fetch('/api/ai-providers');
    if (!res.ok) throw new Error('No AI providers');
    const providers = await res.json();
    const def = providers.find((p: any) => p.is_default) || providers[0];
    if (!def) throw new Error('No AI provider configured');
    return def.id;
  }

  async function postToX() {
    setPosting(true);
    setResult(null);

    try {
      if (tweetMode === 'thread') {
        const res = await fetch('/api/x-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thread: threadTexts }),
        });
        const data = await res.json();
        setResult(!res.ok ? { ok: false, msg: data.error } : { ok: true, msg: `Posted thread! ${data.tweets?.length} tweets` });
      } else if (images.length > 0) {
        const formData = new FormData();
        formData.append('text', tweetText);
        for (const img of images) {
          formData.append('images', img);
        }
        const res = await fetch('/api/x-post', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) {
          setResult({ ok: false, msg: data.error });
        } else {
          setResult({ ok: true, msg: `Posted with ${images.length} image(s)! Tweet ID: ${data.tweet?.id}` });
          setImages([]); setImagePreviews([]);
        }
      } else {
        const res = await fetch('/api/x-post', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: tweetText }),
        });
        const data = await res.json();
        setResult(!res.ok ? { ok: false, msg: data.error } : { ok: true, msg: `Posted! Tweet ID: ${data.tweet?.id}` });
      }
    } catch (e: any) {
      setResult({ ok: false, msg: e.message });
    }
    setPosting(false);
  }

  function selectBlog(post: BlogPost) {
    setSelectedTitle(post.title);
    fetch(`/api/blog/${post.slug}`).then(r => r.ok ? r.json() : null).then(data => {
      if (data) setSelectedContent(data.content);
    });
    setResult(null);
  }

  function selectDiary(entry: DiaryEntry) {
    setSelectedTitle(`Diary: ${entry.date}`);
    setSelectedContent(entry.content);
    setResult(null);
  }

  const siteFilesTotalPages = Math.ceil(siteFilesTotal / 12);

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Post to X</h1>
        <span className={`text-sm ${xAuthStatus.startsWith('✓') ? 'text-green-600' : 'text-red-500'}`}>
          {xAuthStatus}
        </span>
      </div>

      {/* Source selector tabs */}
      <div className="flex gap-1 mb-6 border-b">
        {(['blog', 'diary', 'custom'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`pb-2 px-3 text-sm font-medium ${tab === t ? 'border-b-2 border-black' : 'text-gray-500 hover:text-black'}`}>
            {t === 'blog' ? 'Blog Posts' : t === 'diary' ? 'Diary' : 'Custom'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Source selection */}
        <div>
          {tab === 'blog' && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {posts.map(p => (
                <div key={p.slug} onClick={() => selectBlog(p)}
                  className={`border rounded px-3 py-2 cursor-pointer text-sm hover:border-gray-400 ${selectedTitle === p.title ? 'border-black bg-gray-50' : ''}`}>
                  <span className="font-medium">{p.title}</span>
                  <span className="text-gray-400 text-xs ml-2">{p.date}</span>
                </div>
              ))}
              {posts.length === 0 && <p className="text-gray-400 text-sm">No blog posts</p>}
            </div>
          )}

          {tab === 'diary' && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {diaries.map(d => (
                <div key={d.id} onClick={() => selectDiary(d)}
                  className={`border rounded px-3 py-2 cursor-pointer text-sm hover:border-gray-400 ${selectedTitle === `Diary: ${d.date}` ? 'border-black bg-gray-50' : ''}`}>
                  <span className="font-medium">{d.date}</span>
                  <p className="text-gray-500 text-xs truncate">{d.content.slice(0, 80)}</p>
                </div>
              ))}
              {diaries.length === 0 && <p className="text-gray-400 text-sm">No diary entries</p>}
            </div>
          )}

          {tab === 'custom' && (
            <div className="space-y-3">
              <input value={selectedTitle} onChange={e => setSelectedTitle(e.target.value)}
                className="border rounded px-2 py-1 text-sm w-full" placeholder="Title" />
              <textarea value={selectedContent} onChange={e => setSelectedContent(e.target.value)}
                rows={12} className="border rounded px-2 py-1 text-sm w-full resize-y font-mono"
                placeholder="Paste your content here..." />
            </div>
          )}

          {selectedContent && (
            <button onClick={generateTweet} disabled={generating}
              className="mt-4 bg-black text-white px-4 py-2 rounded text-sm w-full disabled:opacity-50">
              {generating ? 'Generating...' : '🤖 Generate Tweet with AI'}
            </button>
          )}
        </div>

        {/* Right: Tweet preview & post */}
        <div className="space-y-4">
          {tweetMode === 'single' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Tweet</label>
                <span className={`text-xs ${tweetText.length > 280 ? 'text-red-500' : 'text-gray-400'}`}>
                  {tweetText.length}/280
                </span>
              </div>
              <textarea value={tweetText} onChange={e => setTweetText(e.target.value)}
                rows={6} className="border rounded px-3 py-2 text-sm w-full resize-y" placeholder="Write or generate a tweet..." />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-500">Thread ({threadTexts.length} tweets)</label>
                <button onClick={() => setThreadTexts([...threadTexts, ''])}
                  className="text-xs text-blue-500 hover:underline">+ Add tweet</button>
              </div>
              {threadTexts.map((t, i) => (
                <div key={i} className="relative">
                  <textarea value={t} onChange={e => {
                    const updated = [...threadTexts];
                    updated[i] = e.target.value;
                    setThreadTexts(updated);
                  }} rows={3} className="border rounded px-3 py-2 text-sm w-full resize-y pr-16" />
                  <div className="absolute top-1 right-2 flex gap-1 items-center">
                    <span className={`text-xs ${t.length > 280 ? 'text-red-500' : 'text-gray-300'}`}>{t.length}</span>
                    <button onClick={() => setThreadTexts(threadTexts.filter((_, j) => j !== i))}
                      className="text-red-300 hover:text-red-500 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image area */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-gray-500">Images ({images.length}/4)</label>
            </div>

            {/* Image previews */}
            {imagePreviews.length > 0 && (
              <div className="flex gap-2 mb-2 flex-wrap">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative group">
                    <img src={src} alt={`Upload ${i + 1}`}
                      className="w-20 h-20 object-cover rounded border" />
                    <button onClick={() => removeImage(i)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < 4 && (
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="image/*" multiple
                  onChange={handleImageSelect} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()}
                  className="flex-1 border border-dashed rounded px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
                  📁 From computer
                </button>
                <button onClick={openFilePicker}
                  className="flex-1 border border-dashed rounded px-3 py-2 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors">
                  🖼️ From site files
                </button>
              </div>
            )}
          </div>

          {/* Site files picker modal */}
          {showFilePicker && (
            <div className="border rounded-lg p-3 bg-gray-50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-600">Select from site files</span>
                <button onClick={() => setShowFilePicker(false)} className="text-xs text-gray-400 hover:text-gray-600">Close</button>
              </div>
              {loadingSiteFiles ? (
                <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
              ) : siteFiles.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No files uploaded yet</p>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {siteFiles.map(f => (
                      <button key={f.id} onClick={() => { selectSiteFile(f); setShowFilePicker(false); }}
                        className="border rounded overflow-hidden hover:border-blue-400 transition-colors group">
                        <img src={`/api/uploads/${f.filename}`} alt={f.original_name}
                          className="w-full h-16 object-cover" />
                        <p className="text-[10px] text-gray-400 truncate px-1 py-0.5 group-hover:text-blue-500">{f.original_name}</p>
                      </button>
                    ))}
                  </div>
                  {siteFilesTotalPages > 1 && (
                    <div className="flex justify-center gap-2">
                      <button onClick={() => loadSiteFiles(siteFilesPage - 1)} disabled={siteFilesPage <= 1}
                        className="text-xs px-2 py-0.5 border rounded disabled:opacity-30">Prev</button>
                      <span className="text-xs text-gray-400">{siteFilesPage}/{siteFilesTotalPages}</span>
                      <button onClick={() => loadSiteFiles(siteFilesPage + 1)} disabled={siteFilesPage >= siteFilesTotalPages}
                        className="text-xs px-2 py-0.5 border rounded disabled:opacity-30">Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={() => { setTweetMode(tweetMode === 'single' ? 'thread' : 'single'); }}
              className="border rounded px-3 py-1 text-xs text-gray-500 hover:bg-gray-50">
              Switch to {tweetMode === 'single' ? 'Thread' : 'Single'}
            </button>
          </div>

          {result && (
            <div className={`text-sm p-2 rounded ${result.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
              {result.msg}
            </div>
          )}

          <button onClick={postToX}
            disabled={posting || (tweetMode === 'single' ? (!tweetText && images.length === 0) : threadTexts.length === 0)}
            className="bg-blue-500 text-white px-4 py-2 rounded text-sm w-full hover:bg-blue-600 disabled:opacity-50">
            {posting ? 'Posting...' : images.length > 0 ? `🐦 Post to X with ${images.length} image(s)` : '🐦 Post to X'}
          </button>
        </div>
      </div>
    </main>
  );
}
