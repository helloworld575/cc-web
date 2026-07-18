import type { SubscriptionTopic } from '@/lib/subscription-topics';

export type SecurityContentType =
  | 'vulnerability'
  | 'threat-intelligence'
  | 'security-incident'
  | 'defense-research';

export type AiContentType =
  | 'model-product'
  | 'research-evaluation'
  | 'open-source-engineering'
  | 'industry-governance';

export type SubscriptionContentType = SecurityContentType | AiContentType;

export const SECURITY_CONTENT_TYPES: readonly SecurityContentType[] = [
  'vulnerability',
  'threat-intelligence',
  'security-incident',
  'defense-research',
];

export const AI_CONTENT_TYPES: readonly AiContentType[] = [
  'model-product',
  'research-evaluation',
  'open-source-engineering',
  'industry-governance',
];

export const SUBSCRIPTION_CONTENT_TYPE_LABELS: Record<SubscriptionContentType, string> = {
  vulnerability: '漏洞通告',
  'threat-intelligence': '威胁情报',
  'security-incident': '安全事件',
  'defense-research': '防御研究',
  'model-product': '模型与产品',
  'research-evaluation': '研究与评测',
  'open-source-engineering': '开源工程',
  'industry-governance': '行业与治理',
};

const SECURITY_QUOTAS: Record<SecurityContentType, number> = {
  vulnerability: 5,
  'threat-intelligence': 3,
  'security-incident': 2,
  'defense-research': 2,
};

const AI_QUOTAS: Record<AiContentType, number> = {
  'model-product': 4,
  'research-evaluation': 3,
  'open-source-engineering': 3,
  'industry-governance': 2,
};

function normalizedText(title: string, excerpt: string) {
  return `${title}\n${excerpt}`.toLowerCase().replace(/\s+/g, ' ');
}

const VULNERABILITY_PATTERN = /\b(?:cve|cnvd|cnnvd)-\d|漏洞|vulnerabilit|security advisory|rce\b|远程代码执行|代码执行|注入|提权|权限提升|认证绕过|身份验证绕过|路径遍历|缓冲区溢出/;
const SECURITY_INCIDENT_PATTERN = /数据泄露|信息泄露事件|入侵事件|安全事件|供应链事件|服务中断|breach|data leak|incident|compromise|outage/;
const THREAT_INTELLIGENCE_PATTERN = /\bapt\d*\b|威胁情报|攻击活动|恶意软件|勒索|钓鱼|僵尸网络|威胁主体|\bioc\b|\bttp\b|malware|ransomware|phishing|botnet|campaign/;

export function classifySecurityContent(title: string, excerpt: string): SecurityContentType {
  const normalizedTitle = normalizedText(title, '');
  const text = normalizedText(title, excerpt);

  if (SECURITY_INCIDENT_PATTERN.test(normalizedTitle)) {
    return 'security-incident';
  }
  if (THREAT_INTELLIGENCE_PATTERN.test(normalizedTitle)) {
    return 'threat-intelligence';
  }
  if (VULNERABILITY_PATTERN.test(normalizedTitle)) return 'vulnerability';

  if (SECURITY_INCIDENT_PATTERN.test(text)) return 'security-incident';
  if (THREAT_INTELLIGENCE_PATTERN.test(text)) return 'threat-intelligence';
  if (VULNERABILITY_PATTERN.test(text)) return 'vulnerability';
  return 'defense-research';
}

export function classifyAiContent(title: string, excerpt: string): AiContentType {
  const text = normalizedText(title, excerpt);

  if (/\barxiv\b|论文|研究报告|研究主题|benchmark|基准结果|评测|数据集|dataset|methodology|实验结果/.test(text)) {
    return 'research-evaluation';
  }
  if (/\bgithub\b|开源|代码仓库|repository|release notes|项目\/版本|兼容性\/迁移|迁移要求|\bsdk\b|框架\s*v?\d/.test(text)) {
    return 'open-source-engineering';
  }
  if (/监管|治理|政策|法案|法规|标准生效|并购|收购|投资|合作协议|governance|regulation|policy|acquisition|merger/.test(text)) {
    return 'industry-governance';
  }
  return 'model-product';
}

export function classifySubscriptionEntry(
  topic: 'security',
  title: string,
  excerpt: string,
): SecurityContentType;
export function classifySubscriptionEntry(
  topic: 'ai',
  title: string,
  excerpt: string,
): AiContentType;
export function classifySubscriptionEntry(
  topic: SubscriptionTopic,
  title: string,
  excerpt: string,
): SubscriptionContentType {
  return topic === 'security'
    ? classifySecurityContent(title, excerpt)
    : classifyAiContent(title, excerpt);
}

function priorityScore(topic: SubscriptionTopic, type: SubscriptionContentType, text: string) {
  const normalized = text.toLowerCase();
  const patterns = topic === 'security'
    ? type === 'vulnerability'
      ? [/严重|critical|cvss\s*(?:9|10)/, /已知遭利用|在野利用|actively exploited|\bkev\b/, /修复|补丁|upgrade|patch/]
      : type === 'threat-intelligence'
        ? [/正在活动|active campaign|攻击活动/, /\bioc\b|\bttp\b|指标|技战术/, /威胁主体|\bapt\b/]
        : type === 'security-incident'
          ? [/已确认|confirmed/, /数据泄露|供应链|breach|compromise/, /影响|受影响|impact/]
          : [/检测|detection/, /防御|mitigation|hardening/, /响应|response/]
    : type === 'model-product'
      ? [/官方|official/, /\bapi\b|价格|pricing|可用范围/, /发布|release|上线/]
      : type === 'research-evaluation'
        ? [/方法|数据集|method|dataset/, /benchmark|基准|评测/, /限制|limitation/]
        : type === 'open-source-engineering'
          ? [/release|发布|版本/, /兼容|迁移|migration/, /安全修复|security fix/]
          : [/生效|effective/, /适用范围|scope/, /政策|法案|regulation|policy/];

  return patterns.reduce((score, pattern) => score + (pattern.test(normalized) ? 1 : 0), 0);
}

function roundRobinBySource<T extends {
  entry: { source_id?: number | string };
  index: number;
}>(candidates: T[]) {
  const groups = new Map<string, T[]>();
  for (const candidate of candidates) {
    const key = candidate.entry.source_id === undefined
      ? `entry-${candidate.index}`
      : `source-${candidate.entry.source_id}`;
    const group = groups.get(key) || [];
    group.push(candidate);
    groups.set(key, group);
  }

  const balanced: T[] = [];
  while (balanced.length < candidates.length) {
    for (const group of groups.values()) {
      const next = group.shift();
      if (next) balanced.push(next);
    }
  }
  return balanced;
}

export function selectBalancedDailyEntries<T extends {
  title: string;
  excerpt: string;
  source_id?: number | string;
}>(
  topic: SubscriptionTopic,
  entries: readonly T[],
  limit = 12,
) {
  if (limit <= 0 || entries.length === 0) return [] as T[];

  const types: readonly SubscriptionContentType[] = topic === 'security'
    ? SECURITY_CONTENT_TYPES
    : AI_CONTENT_TYPES;
  const quotas: Partial<Record<SubscriptionContentType, number>> = topic === 'security'
    ? SECURITY_QUOTAS
    : AI_QUOTAS;
  const indexed = entries.map((entry, index) => ({
    entry,
    index,
    type: topic === 'security'
      ? classifySecurityContent(entry.title, entry.excerpt)
      : classifyAiContent(entry.title, entry.excerpt),
    score: 0,
  }));
  indexed.forEach((candidate) => {
    candidate.score = priorityScore(
      topic,
      candidate.type,
      `${candidate.entry.title}\n${candidate.entry.excerpt}`,
    );
  });

  const queues = new Map(types.map((type) => {
    const ranked = indexed
      .filter(candidate => candidate.type === type)
      .sort((left, right) => right.score - left.score || left.index - right.index);
    return [type, roundRobinBySource(ranked)] as const;
  }));
  const selected: typeof indexed = [];
  const perTypeCount = new Map<SubscriptionContentType, number>();

  while (selected.length < limit) {
    let added = false;
    for (const type of types) {
      if (selected.length >= limit) break;
      const count = perTypeCount.get(type) || 0;
      const quota = quotas[type] || 0;
      const queue = queues.get(type) || [];
      if (count >= quota || queue.length === 0) continue;
      selected.push(queue.shift()!);
      perTypeCount.set(type, count + 1);
      added = true;
    }
    if (!added) break;
  }

  if (selected.length < limit) {
    const selectedIndexes = new Set(selected.map(candidate => candidate.index));
    const remaining = roundRobinBySource(indexed
      .filter(candidate => !selectedIndexes.has(candidate.index))
      .sort((left, right) => right.score - left.score || left.index - right.index));
    selected.push(...remaining.slice(0, limit - selected.length));
  }

  return selected.map(candidate => candidate.entry);
}
