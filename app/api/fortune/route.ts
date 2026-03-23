export const runtime = 'nodejs';
import { calcBazi, formatElementsDesc, getTenGod, STEMS } from '@/lib/bazi';
import { calcZiwei } from '@/lib/ziwei';
import { computeHexagram, randomHexagram, timeToHexagram, numberToHexagram, formatLines, TRIGRAMS } from '@/lib/yijing';

const SYSTEM = `你是一位精通中国传统命理学的大师，深谙四柱八字、紫微斗数、周易六爻和梅花易数。

你的知识体系涵盖：
- 四柱八字：天干地支、五行生克、十神体系、身旺身弱、格局分析
- 紫微斗数：命宫身宫、十二宫、五行局、紫微星系
- 周易六爻：六十四卦、变卦、动爻解读
- 梅花易数：体卦用卦、五行生克、动爻起卦

分析要有理有据、层次清晰，用通俗易懂的语言呈现专业深度。
每段分析结尾请标注：「命理仅供参考，请理性看待」`;

function buildBaziPrompt(data: Record<string, unknown>): { preflight: string; prompt: string } {
  const { year, month, day, hour, gender, aspect } = data as {
    year: number; month: number; day: number; hour: number; gender: string; aspect: string;
  };
  const bazi = calcBazi(year, month, day, hour);
  const tenGods = STEMS.map(s => `${s}=${getTenGod(bazi.dayMaster, s)}`).join('、');
  const preflight = JSON.stringify({ bazi });

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

  return { preflight, prompt };
}

function buildZiweiPrompt(data: Record<string, unknown>): { preflight: string; prompt: string } {
  const { year, month, day, hour, gender, aspect } = data as {
    year: number; month: number; day: number; hour: number; gender: string; aspect: string;
  };
  const bazi = calcBazi(year, month, day, hour);
  const stemIdx = STEMS.indexOf(bazi.year.stem);
  const branchIdx = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'].indexOf(bazi.year.branch);
  const ziwei = calcZiwei(year, month, day, hour, stemIdx, branchIdx);

  const palacesDesc = ziwei.palaces.map(p => `${p.name}（${p.branch}）`).join(' ');
  const preflight = JSON.stringify({ ziwei: { ...ziwei, palaces: ziwei.palaces } });

  const prompt = `请对以下紫微斗数命盘进行【${aspect}】方面的命理分析：

性别：${gender === 'female' ? '女' : '男'}
公历生辰：${year}年${month}月${day}日${hour}时

基本信息：
- 命宫：${ziwei.mingGongBranch}宫
- 身宫：${ziwei.shenGongBranch}宫
- 纳音五行：${ziwei.nayinName}（${ziwei.wuxingJu.name}）

十二宫排布：
${palacesDesc}

请围绕「${aspect}」进行深入分析，包括：
1. 命宫（${ziwei.mingGongBranch}）的基本格局与性情
2. 身宫（${ziwei.shenGongBranch}）的修身与后天发展
3. ${ziwei.wuxingJu.name}对命主的影响
4. 与${aspect}相关的关键宫位分析
5. 具体特征描述与人生建议`;

  return { preflight, prompt };
}

function buildLiuyaoPrompt(data: Record<string, unknown>): { preflight: string; prompt: string } {
  const { inputMethod, question, year, month, day, hour } = data as {
    inputMethod: string; question: string;
    year?: number; month?: number; day?: number; hour?: number;
  };

  let result;
  if (inputMethod === 'time' && year && month && day && hour !== undefined) {
    result = timeToHexagram(year, month, day, hour);
  } else {
    result = randomHexagram();
  }

  const lowerTrigram = TRIGRAMS[result.lowerBinary];
  const upperTrigram = TRIGRAMS[result.upperBinary];
  const linesFormatted = formatLines(result.lines);

  const changingDesc = result.changingLines.length > 0
    ? `动爻：第${result.changingLines.map(i => i + 1).join('、')}爻（从下数）\n变卦：${result.transformed?.fullName ?? '无'}`
    : '无动爻（静卦）';

  const preflight = JSON.stringify({ hexagram: result });

  const prompt = `请对以下周易六爻卦象进行占卜分析：

${question ? `问题：${question}` : '（随机起卦，求总体运势）'}

本卦：${result.hexagram.fullName} ${result.hexagram.unicode}
上卦：${upperTrigram.name}（${upperTrigram.nature}/${upperTrigram.element}）
下卦：${lowerTrigram.name}（${lowerTrigram.nature}/${lowerTrigram.element}）

六爻爻象（从下到上）：
${linesFormatted}

${changingDesc}
${result.transformed ? `\n变卦：${result.transformed.fullName} ${result.transformed.unicode}` : ''}

请进行六爻解析，包括：
1. 本卦${result.hexagram.fullName}的卦义与象征
2. 上下卦（${upperTrigram.name}与${lowerTrigram.name}）的关系解读
3. 动爻的含义与变化趋势
4. ${result.transformed ? `变卦${result.transformed.fullName}的启示` : '静卦的稳定性分析'}
5. 针对所问具体建议`;

  return { preflight, prompt };
}

function buildMeihuaPrompt(data: Record<string, unknown>): { preflight: string; prompt: string } {
  const { inputMethod, num1, num2, question, year, month, day, hour } = data as {
    inputMethod: string; num1?: number; num2?: number; question: string;
    year?: number; month?: number; day?: number; hour?: number;
  };

  let result;
  if (inputMethod === 'time' && year && month && day && hour !== undefined) {
    result = timeToHexagram(year, month, day, hour);
  } else if (inputMethod === 'number' && num1 !== undefined && num2 !== undefined) {
    result = numberToHexagram(num1, num2);
  } else {
    result = randomHexagram();
  }

  const lowerTrigram = TRIGRAMS[result.lowerBinary]; // 体卦 (lower = subject)
  const upperTrigram = TRIGRAMS[result.upperBinary]; // 用卦 (upper = use/object)
  const movingLine = result.changingLines[0]; // 梅花一般取一个动爻

  const preflight = JSON.stringify({ hexagram: result });

  const prompt = `请对以下梅花易数卦象进行占卜分析：

${question ? `问题：${question}` : '（起卦，求总体指引）'}

本卦：${result.hexagram.fullName} ${result.hexagram.unicode}
体卦（下卦）：${lowerTrigram.name}（${lowerTrigram.nature}/${lowerTrigram.element}）
用卦（上卦）：${upperTrigram.name}（${upperTrigram.nature}/${upperTrigram.element}）
${movingLine !== undefined ? `动爻：第${movingLine + 1}爻（从下数）` : '无动爻'}
${result.transformed ? `变卦：${result.transformed.fullName} ${result.transformed.unicode}` : ''}

请进行梅花易数解析，包括：
1. 体卦（${lowerTrigram.name}/${lowerTrigram.element}）代表主体的状态
2. 用卦（${upperTrigram.name}/${upperTrigram.element}）代表事物发展方向
3. 体用五行生克关系（${lowerTrigram.element}与${upperTrigram.element}的关系）
4. 动爻变化与事情走向
5. 综合建议与吉凶判断`;

  return { preflight, prompt };
}

export async function POST(req: Request) {
  const body = await req.json();
  const { method } = body as { method: string };

  if (!method) {
    return new Response(JSON.stringify({ error: '缺少 method 参数' }), { status: 400 });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return new Response(JSON.stringify({ error: 'CLAUDE_API_KEY 未配置' }), { status: 500 });

  let preflight: string;
  let prompt: string;

  try {
    switch (method) {
      case 'bazi': ({ preflight, prompt } = buildBaziPrompt(body)); break;
      case 'ziwei': ({ preflight, prompt } = buildZiweiPrompt(body)); break;
      case 'liuyao': ({ preflight, prompt } = buildLiuyaoPrompt(body)); break;
      case 'meihua': ({ preflight, prompt } = buildMeihuaPrompt(body)); break;
      default:
        return new Response(JSON.stringify({ error: '不支持的算命方式' }), { status: 400 });
    }
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 400 });
  }

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Send pre-calculated data first
      controller.enqueue(encoder.encode(`data: ${preflight}\n\n`));

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
