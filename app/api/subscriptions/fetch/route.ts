export const runtime = 'nodejs';
export const maxDuration = 300;
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import db from '@/lib/db';
import { rateLimitByIp } from '@/lib/rateLimit';
import { getSkill } from '@/lib/skills';
import { fetchByCategory } from '@/lib/fetchers';
import crypto from 'crypto';

async function generateBriefWithSkill(
  source: { name: string; url: string; category: string },
  content: string,
): Promise<string> {
  const skill = getSkill('subscription');
  if (!skill) {
    return 'Brief generation failed: subscription skill not found.';
  }

  const provider = db.prepare('SELECT * FROM ai_providers WHERE is_default = 1 LIMIT 1').get() as any;
  if (!provider) {
    return 'No default AI provider configured. Go to Admin → AI Config.';
  }

  let userPrompt = skill.prompt
    .replace('{{content}}', content)
    .replace('{{source_name}}', source.name)
    .replace('{{category}}', source.category)
    .replace('{{url}}', source.url);

  try {
    const payload: Record<string, unknown> = {
      model: provider.model,
      max_tokens: 1024,
      messages: [{ role: 'user', content: userPrompt }],
    };
    if (skill.system) payload.system = skill.system;

    let reqUrl: string;
    let reqHeaders: Record<string, string>;

    if (provider.api_type === 'anthropic') {
      reqUrl = `${provider.api_url}/v1/messages`;
      reqHeaders = {
        'x-api-key': provider.api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      };
    } else {
      reqUrl = `${provider.api_url.replace(/\/$/, '')}/v1/chat/completions`;
      reqHeaders = {
        'Authorization': `Bearer ${provider.api_key}`,
        'content-type': 'application/json',
      };
      if (skill.system) {
        (payload.messages as any[]).unshift({ role: 'system', content: skill.system });
        delete payload.system;
      }
    }

    const response = await fetch(reqUrl, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('AI API error:', error);
      return `Brief generation failed: AI API returned ${response.status}`;
    }

    const data = await response.json();
    if (provider.api_type === 'anthropic') {
      return data.content?.[0]?.text || 'No brief generated';
    } else {
      return data.choices?.[0]?.message?.content || 'No brief generated';
    }
  } catch (error: any) {
    console.error('AI brief generation error:', error);
    return `Brief generation failed: ${error.message}`;
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const rl = rateLimitByIp(req, 'subscriptions-fetch', 5);
  if (rl) return rl;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }

  const { source_id } = body;

  const sources = source_id
    ? [db.prepare('SELECT * FROM subscription_sources WHERE id = ? AND enabled = 1').get(source_id)]
    : db.prepare('SELECT * FROM subscription_sources WHERE enabled = 1').all();

  if (!sources || sources.length === 0) {
    return Response.json({ error: 'No enabled sources found' }, { status: 404 });
  }

  const results = [];

  for (const source of sources as any[]) {
    if (!source) continue;

    // Use category-specific fetcher
    const fetched = await fetchByCategory(source.url, source.category);
    if (!fetched) {
      results.push({ source_id: source.id, success: false, error: 'Failed to fetch content' });
      continue;
    }

    const contentHash = crypto.createHash('md5').update(fetched.content).digest('hex');

    const existing = db.prepare(
      'SELECT id FROM subscription_briefs WHERE source_id = ? AND content_hash = ?'
    ).get(source.id, contentHash);

    if (existing) {
      results.push({ source_id: source.id, success: true, cached: true });
      continue;
    }

    const brief = await generateBriefWithSkill(source, fetched.content);

    db.prepare(
      'INSERT INTO subscription_briefs (source_id, title, url, brief, content_hash) VALUES (?, ?, ?, ?, ?)'
    ).run(source.id, fetched.title, source.url, brief, contentHash);

    db.prepare("UPDATE subscription_sources SET last_fetched_at = datetime('now') WHERE id = ?").run(source.id);

    results.push({ source_id: source.id, success: true, title: fetched.title });
  }

  return Response.json({ results, total: sources.length });
}
