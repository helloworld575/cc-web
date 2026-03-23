export const runtime = 'nodejs';
import { calcBazi, formatElementsDesc, getTenGod, STEMS } from '@/lib/bazi';

const SYSTEM = `你是一位精通中国传统命理学的算命大师，深谙四柱八字、五行生克、十神体系。

你的知识体系涵盖：
- 四柱（年柱、月柱、日柱、时柱）天干地支的含义
- 五行生克制化：木生火→火生土→土生金→金生水→水生木；木克土、土克水、水克火、火克金、金克木
- 十神体系：比肩（同五行同阴阳）、劫财（同五行异阴阳）、食神（我生同阴阳）、伤官（我生异阴阳）、偏财（我克同阴阳）、正财（我克异阴阳）、偏官/七杀（克我同阴阳）、正官（克我异阴阳）、偏印（生我同阴阳）、正印（生我异阴阳）
- 身旺身弱的综合判断（月令、帮扶、印绶等）
- 格局分析（从强格、专旺格、普通格局等）
- 大运、流年与命局的互动

分析要有理有据、层次清晰，用通俗易懂的语言呈现专业深度。
每段分析结尾请标注：「命理仅供参考，请理性看待」`;

export async function POST(req: Request) {
  const { year, month, day, hour, gender, aspect } = await req.json();

  if (!year || !month || !day || hour === undefined || !aspect) {
    return new Response(JSON.stringify({ error: '参数不完整' }), { status: 400 });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'CLAUDE_API_KEY 未配置' }), { status: 500 });

  const bazi = calcBazi(Number(year), Number(month), Number(day), Number(hour));

  const tenGods = STEMS.map(s => `${s}=${getTenGod(bazi.dayMaster, s)}`).join('、');

  const prompt = `请对以下八字命盘进行【${aspect}】方面的命理分析：

性别：${gender === 'female' ? '女' : '男'}
公历生辰：${year}年${month}月${day}日${hour}时

四柱八字：
┌──────┬──────┬──────┬──────┐
│  年柱  │  月柱  │  日柱  │  时柱  │
│  ${bazi.year.stem}${bazi.year.branch}  │  ${bazi.month.stem}${bazi.month.branch}  │  ${bazi.day.stem}${bazi.day.branch}  │  ${bazi.hour.stem}${bazi.hour.branch}  │
│${bazi.year.stemElement}·${bazi.year.branchElement} │${bazi.month.stemElement}·${bazi.month.branchElement} │${bazi.day.stemElement}·${bazi.day.branchElement} │${bazi.hour.stemElement}·${bazi.hour.branchElement} │
└──────┴──────┴──────┴──────┘

日主：${bazi.dayMaster}（${bazi.dayMasterElement}）
五行统计：${formatElementsDesc(bazi.elements)}
十神速查：${tenGods}

请围绕「${aspect}」进行深入分析，包括：
1. 日主 ${bazi.dayMaster}（${bazi.dayMasterElement}）的性质与强弱评估
2. 与${aspect}相关的五行格局分析
3. 关键十神的作用与表现
4. 具体特征描述与人生建议
5. 注意事项与改善方向`;

  const host = (process.env.CLAUDE_API_HOST ?? 'https://api.anthropic.com').replace(/\/$/, '');

  const upstream = await fetch(`${host}/v1/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6',
      max_tokens: 2048,
      stream: true,
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!upstream.ok) {
    const err = await upstream.json();
    return new Response(JSON.stringify({ error: err.error?.message ?? 'API error' }), { status: 502 });
  }

  // Also send the calculated bazi as first event
  const encoder = new TextEncoder();
  const baziPayload = JSON.stringify({ bazi });

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${baziPayload}\n\n`));

      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') { controller.close(); return; }
          try {
            const parsed = JSON.parse(raw);
            if (parsed.type === 'content_block_delta' && parsed.delta?.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`));
            }
            if (parsed.type === 'message_stop') { controller.close(); return; }
          } catch { /* skip */ }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
  });
}
