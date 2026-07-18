import db from '@/lib/db';
import { savePost } from '@/lib/markdown';
import {
  crawlSubscriptionSources,
  getEnabledSubscriptionSources,
} from '@/lib/subscription-service';
import type { SubscriptionTopic } from '@/lib/subscription-topics';
import {
  AI_CONTENT_TYPES,
  classifySubscriptionEntry,
  SECURITY_CONTENT_TYPES,
  selectBalancedDailyEntries,
  SUBSCRIPTION_CONTENT_TYPE_LABELS,
  type SubscriptionContentType,
} from '@/lib/subscription-content-types';
import { revalidatePath } from 'next/cache';

const DAILY_ENTRY_LIMIT = 12;
const DAILY_CANDIDATE_LIMIT = 240;

export interface DailySubscriptionEntry {
  id: number;
  source_id: number;
  topic: SubscriptionTopic;
  source_name: string;
  source_url: string;
  title: string;
  url: string;
  excerpt: string;
  published_at?: string | null;
}

interface DailySummary {
  entry_id: number;
  summary: string;
}

function escapeMarkdownLabel(value: string) {
  return value.replace(/[\\[\]]/g, match => `\\${match}`).replace(/\s+/g, ' ').trim();
}

function safeHttpUrl(value: string, fallback = '') {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : fallback;
  } catch {
    return fallback;
  }
}

function markdownSafeUrl(value: string) {
  return value.replace(/[()!\[\]<>\\]/g, character => (
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  ));
}

function commonMarkUrl(value: string) {
  return `<${markdownSafeUrl(value)}>`;
}

function cleanExcerpt(value: string, maxChars = 600) {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

function escapeMarkdownText(value: string) {
  return value.replace(/([\\`*{}[\]()#+.!_>~-])/g, '\\$1');
}

function escapeSecurityFact(value: string) {
  return value.replace(/([\\`*{}[\]()#+!_>~])/g, '\\$1');
}

const UNKNOWN_SECURITY_FACT = '原文摘要未明确披露';

function extractLabeledSecurityValue(text: string, labels: string[]) {
  const labelPattern = labels
    .map(label => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const match = text.match(new RegExp(
    `(?:${labelPattern})\\s*[:：]\\s*(.*?)(?=\\s*(?:[。；;\\n]|\\.(?=\\s*[\\p{L}][\\p{L}\\p{N} /_-]{0,40}\\s*[:：])|$))`,
    'iu',
  ));
  return match?.[1]?.replace(/\s+/g, ' ').trim() || UNKNOWN_SECURITY_FACT;
}

export function extractSecurityFacts(title: string, excerpt: string) {
  const text = cleanExcerpt(`${title}\n${excerpt}`, 2000);
  const vulnerabilityId = text.match(/\b(?:CVE-\d{4}-\d{4,7}|CNVD-\d{4}-\d{3,}|CNNVD-\d{6}-\d{3,})\b/i)?.[0]
    ?.toUpperCase() || UNKNOWN_SECURITY_FACT;
  const vulnerabilityType = text.match(
    /(远程代码执行|任意代码执行|权限提升|信息泄露|拒绝服务|身份验证绕过|认证绕过|SQL\s*注入|命令注入|路径遍历|目录遍历|跨站脚本|XSS|SSRF|CSRF|缓冲区溢出|越界读取|越界写入|任意文件读取|任意文件写入)/i,
  )?.[1]?.replace(/\s+/g, '') || UNKNOWN_SECURITY_FACT;

  return {
    vulnerabilityId,
    vulnerabilityType,
    affectedSoftware: extractLabeledSecurityValue(text, [
      '涉及的软件或服务', '涉及软件或服务', '受影响的软件或服务', '受影响软件或服务',
      '受影响产品', '影响产品', 'Affected product', 'Affected software or service',
    ]),
    affectedVersions: extractLabeledSecurityValue(text, [
      '受影响版本', '影响版本', '受影响范围', 'Affected versions',
    ]),
    mitigation: extractLabeledSecurityValue(text, [
      '修复或缓解措施', '修复措施', '缓解措施', '处置建议', '修复建议', 'Mitigation',
    ]),
  };
}

function extractVulnerabilityFacts(title: string, excerpt: string) {
  const base = extractSecurityFacts(title, excerpt);
  const text = cleanExcerpt(`${title}\n${excerpt}`, 2000);
  return {
    ...base,
    severity: extractLabeledSecurityValue(text, [
      '漏洞级别', '严重性', '风险级别', 'CVSS', 'Severity',
    ]),
    exploitStatus: extractLabeledSecurityValue(text, [
      '利用状态', '利用情况', '在野利用', 'Exploit status',
    ]),
  };
}

function labeledFact(title: string, excerpt: string, labels: string[]) {
  return extractLabeledSecurityValue(cleanExcerpt(`${title}\n${excerpt}`, 2000), labels);
}

function renderFact(label: string, value: string) {
  return `- ${label}：${escapeSecurityFact(value)}`;
}

function renderLinkedFact(label: string, name: string, url: string) {
  return `- ${label}：[${escapeMarkdownLabel(name)}](${commonMarkUrl(url)})`;
}

function formatReferenceDate(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}

export function getShanghaiRunDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function getShanghaiDayUtcBounds(runDate: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(runDate)) {
    throw new Error('Invalid subscription run date');
  }
  const startDate = new Date(`${runDate}T00:00:00+08:00`);
  if (Number.isNaN(startDate.getTime())) throw new Error('Invalid subscription run date');
  return {
    start: startDate.toISOString(),
    end: new Date(startDate.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

export function renderDailySubscriptionPost({
  topic,
  runDate,
  intro,
  entries,
  summaries,
}: {
  topic: SubscriptionTopic;
  runDate: string;
  intro: string;
  entries: DailySubscriptionEntry[];
  summaries: DailySummary[];
}) {
  if (entries.some(entry => entry.topic !== topic)) {
    throw new Error('Subscription entry topic mismatch');
  }
  const summaryByEntry = new Map(
    summaries
      .filter(summary => entries.some(entry => entry.id === summary.entry_id))
      .map(summary => [summary.entry_id, cleanExcerpt(summary.summary)]),
  );
  const topicLabel = topic === 'security' ? '安全' : 'AI';
  const lines = [
    '## 片头',
    '',
    intro.trim() || `${runDate} ${topicLabel} 订阅信息汇总。`,
    '',
    '## 今日信息',
    '',
  ];

  if (entries.length === 0) {
    lines.push('本期抓取完成，但没有可核实的新条目。', '');
  } else {
    const categoryOrder = topic === 'security' ? SECURITY_CONTENT_TYPES : AI_CONTENT_TYPES;
    const entryNumber = new Map(entries.map((entry, index) => [entry.id, index + 1]));
    const entriesByType = new Map<SubscriptionContentType, DailySubscriptionEntry[]>();
    for (const entry of entries) {
      const type = topic === 'security'
        ? classifySubscriptionEntry('security', entry.title, entry.excerpt)
        : classifySubscriptionEntry('ai', entry.title, entry.excerpt);
      const grouped = entriesByType.get(type) || [];
      grouped.push(entry);
      entriesByType.set(type, grouped);
    }

    for (const type of categoryOrder) {
      const grouped = entriesByType.get(type) || [];
      if (grouped.length === 0) continue;
      lines.push(`## ${SUBSCRIPTION_CONTENT_TYPE_LABELS[type]}`, '');

      for (const entry of grouped) {
        const rawArticleUrl = safeHttpUrl(entry.url, safeHttpUrl(entry.source_url));
        const rawSourceUrl = safeHttpUrl(entry.source_url, rawArticleUrl);
        const articleUrl = commonMarkUrl(rawArticleUrl);
        const title = escapeMarkdownLabel(entry.title || entry.source_name);
        const date = formatReferenceDate(entry.published_at);
        const rawSummary = summaryByEntry.get(entry.id) || cleanExcerpt(entry.excerpt);
        const summary = escapeMarkdownText(
          rawSummary || '来源未提供可提取的摘要，请打开原文核对。',
        );
        const fields: string[] = [];

        if (type === 'vulnerability') {
          const facts = extractVulnerabilityFacts(entry.title, entry.excerpt);
          fields.push(
            renderLinkedFact('漏洞来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            renderFact('漏洞编号', facts.vulnerabilityId),
            renderFact('漏洞级别', facts.severity),
            renderFact('漏洞类型', facts.vulnerabilityType),
            renderFact('涉及的软件或服务', facts.affectedSoftware),
            renderFact('受影响版本', facts.affectedVersions),
            renderFact('利用状态', facts.exploitStatus),
            renderFact('修复或缓解措施', facts.mitigation),
            `- 事实摘要：${summary}`,
          );
        } else if (type === 'threat-intelligence') {
          fields.push(
            renderLinkedFact('信息来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            `- 信息总结：${summary}`,
            renderFact('威胁主体或攻击活动', labeledFact(entry.title, entry.excerpt, [
              '威胁主体', '攻击活动', '攻击组织', 'Threat actor', 'Campaign',
            ])),
            renderFact('受影响行业/地区/对象', labeledFact(entry.title, entry.excerpt, [
              '受影响行业/地区/对象', '受影响行业', '受影响地区', '受影响对象', '目标行业', 'Targets',
            ])),
            renderFact('IOC/TTP', labeledFact(entry.title, entry.excerpt, [
              'IOC/TTP', 'IOC', 'TTP', '攻击指标', '技战术',
            ])),
          );
        } else if (type === 'security-incident') {
          fields.push(
            renderLinkedFact('事件来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            `- 事件概述：${summary}`,
            renderFact('受影响对象', labeledFact(entry.title, entry.excerpt, [
              '受影响对象', '受影响客户', '受影响服务', 'Affected entities',
            ])),
            renderFact('时间与影响', labeledFact(entry.title, entry.excerpt, [
              '时间与影响', '发生时间', '影响范围', '事件影响', 'Timeline', 'Impact',
            ])),
            renderFact('当前状态', labeledFact(entry.title, entry.excerpt, [
              '当前状态', '处置状态', '调查状态', 'Status',
            ])),
          );
        } else if (type === 'defense-research') {
          fields.push(
            renderLinkedFact('研究来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            `- 核心内容：${summary}`,
            renderFact('适用对象', labeledFact(entry.title, entry.excerpt, [
              '适用对象', '适用范围', '适用环境', 'Audience',
            ])),
            renderFact('检测或防御措施', labeledFact(entry.title, entry.excerpt, [
              '检测或防御措施', '检测措施', '防御措施', '处置建议', 'Detection', 'Mitigation',
            ])),
          );
        } else if (type === 'model-product') {
          fields.push(
            renderLinkedFact('信息来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            renderFact('模型或产品', labeledFact(entry.title, entry.excerpt, [
              '模型或产品', '模型', '产品', 'Model', 'Product',
            ])),
            renderFact('版本/发布日期', labeledFact(entry.title, entry.excerpt, [
              '版本/发布日期', '版本', '发布日期', 'Version', 'Release date',
            ])),
            renderFact('能力变化', labeledFact(entry.title, entry.excerpt, [
              '能力变化', '主要能力', '功能变化', 'Capabilities',
            ])),
            renderFact('API/价格/可用范围/限制', labeledFact(entry.title, entry.excerpt, [
              'API/价格/可用范围/限制', 'API', '价格', '可用范围', '限制', 'Pricing', 'Availability',
            ])),
            `- 内容摘要：${summary}`,
          );
        } else if (type === 'research-evaluation') {
          fields.push(
            renderLinkedFact('研究来源/机构', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            renderFact('研究主题', labeledFact(entry.title, entry.excerpt, [
              '研究主题', '论文主题', 'Topic',
            ])),
            renderFact('方法与数据', labeledFact(entry.title, entry.excerpt, [
              '方法与数据', '研究方法', '数据集', 'Method', 'Dataset',
            ])),
            renderFact('基准结果', labeledFact(entry.title, entry.excerpt, [
              '基准结果', '评测结果', '实验结果', 'Benchmark', 'Results',
            ])),
            renderFact('主要结论与限制', labeledFact(entry.title, entry.excerpt, [
              '主要结论与限制', '结论与限制', '研究结论', '限制', 'Conclusion', 'Limitations',
            ])),
            `- 内容摘要：${summary}`,
          );
        } else if (type === 'open-source-engineering') {
          fields.push(
            renderLinkedFact('项目来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            renderFact('项目/版本', labeledFact(entry.title, entry.excerpt, [
              '项目/版本', '项目', '版本', 'Project', 'Version',
            ])),
            renderFact('主要变更', labeledFact(entry.title, entry.excerpt, [
              '主要变更', '更新内容', '变更', 'Changes',
            ])),
            renderFact('兼容性/迁移要求', labeledFact(entry.title, entry.excerpt, [
              '兼容性/迁移要求', '兼容性', '迁移要求', 'Compatibility', 'Migration',
            ])),
            `- 内容摘要：${summary}`,
          );
        } else {
          fields.push(
            renderLinkedFact('信息来源', entry.source_name, rawSourceUrl),
            ...(date ? [`- 发布时间：${date}`] : []),
            renderFact('事件或政策', labeledFact(entry.title, entry.excerpt, [
              '事件或政策', '政策', '法案', '事件', 'Policy', 'Event',
            ])),
            renderFact('生效时间', labeledFact(entry.title, entry.excerpt, [
              '生效时间', '发布日期', 'Effective date',
            ])),
            renderFact('适用范围', labeledFact(entry.title, entry.excerpt, [
              '适用范围', '适用对象', 'Scope',
            ])),
            renderFact('明确影响', labeledFact(entry.title, entry.excerpt, [
              '明确影响', '影响', 'Impact',
            ])),
            `- 内容摘要：${summary}`,
          );
        }

        lines.push(
          `### ${entryNumber.get(entry.id)}. [${title}](${articleUrl})`,
          '',
          ...fields,
          '',
        );
      }
    }
  }

  lines.push('## 参考信息', '');
  if (entries.length === 0) {
    lines.push('- 本期无可核实条目。');
  } else {
    entries.forEach((entry, index) => {
      const rawArticleUrl = safeHttpUrl(entry.url, safeHttpUrl(entry.source_url));
      const rawSourceUrl = safeHttpUrl(entry.source_url, rawArticleUrl);
      const articleUrl = commonMarkUrl(rawArticleUrl);
      const sourceUrl = commonMarkUrl(rawSourceUrl);
      lines.push(
        `${index + 1}. [${escapeMarkdownLabel(entry.title)}](${articleUrl}) — [${escapeMarkdownLabel(entry.source_name)}](${sourceUrl})`,
      );
    });
  }

  return `${lines.join('\n').trim()}\n`;
}

function getDailyEntries(topic: SubscriptionTopic, runDate: string) {
  const bounds = getShanghaiDayUtcBounds(runDate);
  const rows = db.prepare(`
    SELECT
      i.id,
      i.source_id,
      s.topic,
      s.name AS source_name,
      s.url AS source_url,
      i.title,
      i.url,
      i.content AS excerpt,
      i.published_at
    FROM subscription_items i
    JOIN subscription_sources s ON s.id = i.source_id
    WHERE s.enabled = 1
      AND s.topic = ?
      AND i.fetched_at >= datetime(?)
      AND i.fetched_at < datetime(?)
    ORDER BY COALESCE(i.published_at, i.fetched_at) DESC, i.id DESC
    LIMIT ?
  `).all(topic, bounds.start, bounds.end, DAILY_CANDIDATE_LIMIT) as DailySubscriptionEntry[];

  const seen = new Set<string>();
  const deduplicated = rows.filter(entry => {
    const key = safeHttpUrl(entry.url) || `${entry.source_id}\n${entry.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return selectBalancedDailyEntries(topic, deduplicated, DAILY_ENTRY_LIMIT);
}

interface DailyRunRow {
  status: 'running' | 'published' | 'failed';
  slug: string;
  entry_count: number;
}

function claimDailyPublication(runDate: string, topic: SubscriptionTopic, slug: string) {
  const inserted = db.prepare(`
    INSERT INTO subscription_daily_runs (run_date, topic, status, slug)
    VALUES (?, ?, 'running', ?)
    ON CONFLICT(run_date, topic) DO NOTHING
  `).run(runDate, topic, slug);
  if (inserted.changes === 1) return { claimed: true as const };

  const retried = db.prepare(`
    UPDATE subscription_daily_runs
    SET status = 'running', error_code = NULL, started_at = datetime('now'), updated_at = datetime('now')
    WHERE run_date = ? AND topic = ?
      AND (status = 'failed' OR (status = 'running' AND updated_at < datetime('now', '-30 minutes')))
  `).run(runDate, topic);
  if (retried.changes === 1) return { claimed: true as const };

  const existing = db.prepare(`
    SELECT status, slug, entry_count
    FROM subscription_daily_runs
    WHERE run_date = ? AND topic = ?
  `).get(runDate, topic) as DailyRunRow | undefined;
  return { claimed: false as const, existing };
}

export async function runDailySubscriptionPublishing({
  requestId,
  now = new Date(),
}: {
  requestId: string;
  now?: Date;
}) {
  const runDate = getShanghaiRunDate(now);
  const sources = getEnabledSubscriptionSources();
  const crawl = await crawlSubscriptionSources(sources);
  const successCount = crawl.results.filter(result => result.success).length;
  const publications = (['ai', 'security'] as const).map(topic => {
    const topicLabel = topic === 'security' ? '安全' : 'AI';
    const slug = `${runDate.replace(/-/g, '')}-${topic}-subscription-daily`;
    const claim = claimDailyPublication(runDate, topic, slug);
    if (!claim.claimed) {
      return {
        topic,
        slug: claim.existing?.slug || slug,
        status: claim.existing?.status || 'running',
        entry_count: claim.existing?.entry_count || 0,
        cached: claim.existing?.status === 'published',
      };
    }

    const topicSourceIds = new Set(
      sources.filter(source => source.topic === topic).map(source => source.id),
    );
    const topicSucceeded = crawl.results.some(result => (
      result.success && topicSourceIds.has(result.source_id)
    ));
    if (topicSourceIds.size === 0 || !topicSucceeded) {
      const errorCode = topicSourceIds.size === 0
        ? 'TOPIC_SOURCES_NOT_CONFIGURED'
        : 'TOPIC_CRAWL_FAILED';
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'failed', error_code = ?, updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(errorCode, runDate, topic);
      return { topic, slug, status: 'failed' as const, entry_count: 0, error_code: errorCode };
    }

    const entries = getDailyEntries(topic, runDate);
    const title = `${topicLabel} 订阅日报 | ${runDate}`;
    const intro = entries.length > 0
      ? `本期从已完成抓取的${topicLabel}订阅源中编选 ${entries.length} 条信息。片头用于说明编选范围；正文只保留来源可核实的事实与原文链接。`
      : `本期${topicLabel}订阅抓取已完成，但没有得到可核实的新条目。`;
    const content = renderDailySubscriptionPost({
      topic,
      runDate,
      intro,
      entries,
      summaries: entries.map(entry => ({
        entry_id: entry.id,
        summary: cleanExcerpt(entry.excerpt),
      })),
    });

    try {
      savePost(
        slug,
        title,
        runDate,
        content,
        `每日${topicLabel}订阅汇总，包含明确、可点击的原始参考链接。`,
      );
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'published', entry_count = ?, error_code = NULL, updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(entries.length, runDate, topic);
      revalidatePath(`/blog/${slug}`);
      return { topic, slug, status: 'published' as const, entry_count: entries.length };
    } catch {
      db.prepare(`
        UPDATE subscription_daily_runs
        SET status = 'failed', error_code = 'BLOG_WRITE_FAILED', updated_at = datetime('now')
        WHERE run_date = ? AND topic = ?
      `).run(runDate, topic);
      return { topic, slug, status: 'failed' as const, entry_count: 0, error_code: 'BLOG_WRITE_FAILED' };
    }
  });

  revalidatePath('/blog');
  const publishedCount = publications.filter(item => item.status === 'published').length;
  return {
    request_id: requestId,
    run_date: runDate,
    status: publishedCount === publications.length
      ? 'published' as const
      : publishedCount > 0
        ? 'partial' as const
        : 'failed' as const,
    crawl: {
      total: crawl.total,
      success: successCount,
      failed: crawl.total - successCount,
    },
    publications,
  };
}
