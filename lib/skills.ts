import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type {
  InvocableSkill,
  InvocableSkillSummary,
  Skill,
  SkillHierarchy,
  SkillLookup,
  SkillSummary,
} from '@/lib/skill-taxonomy';
import { getRuntimePaths } from '@/lib/runtime-paths';

const { skillsDir } = getRuntimePaths();

type SkillFrontmatter = Record<string, unknown> & {
  name?: string;
  name_zh?: string;
  description?: string;
  description_zh?: string;
  system?: string;
  prompt?: string;
  output?: string;
  invocable?: boolean;
  user_invocable?: boolean;
  hierarchy?: Partial<SkillHierarchy> & { path?: string[] | string };
  lookup?: Partial<SkillLookup>;
  domain?: string;
  category?: string;
  subcategory?: string;
  order?: number;
  path?: string[] | string;
  invoke?: string;
  aliases?: string[] | string;
  keywords?: string[] | string;
};

type SkillDraft = Partial<Skill> & Pick<Skill, 'id' | 'name' | 'description' | 'prompt' | 'output'>;
type SkillQueryOptions = {
  includeNonInvocable?: boolean;
};

const HIERARCHY_OVERRIDES: Record<string, [string, string, string]> = {
  'agent-browser': ['agent', 'automation', 'browser'],
  'arming-thought': ['strategy', 'methodology', 'arming-thought'],
  'company-values': ['business', 'operations', 'values'],
  'concentrate-forces': ['strategy', 'methodology', 'prioritization'],
  'contradiction-analysis': ['strategy', 'analysis', 'contradictions'],
  'criticism-self-criticism': ['strategy', 'review', 'retrospective'],
  'find-community': ['business', 'discovery', 'community'],
  'find-skills': ['agent', 'skills', 'discovery'],
  'first-customers': ['business', 'growth', 'first-customers'],
  'grow-sustainably': ['business', 'growth', 'sustainability'],
  'investigation-first': ['strategy', 'analysis', 'investigation'],
  'marketing-plan': ['business', 'marketing', 'plan'],
  'mass-line': ['strategy', 'collaboration', 'feedback'],
  'memory-systems': ['agent', 'memory', 'systems'],
  'minimalist-review': ['business', 'review', 'decision-making'],
  mvp: ['business', 'product', 'mvp'],
  'overall-planning': ['strategy', 'planning', 'balancing'],
  'practice-cognition': ['strategy', 'execution', 'iteration'],
  pricing: ['business', 'go-to-market', 'pricing'],
  processize: ['business', 'operations', 'process'],
  'protracted-strategy': ['strategy', 'planning', 'long-term'],
  research: ['knowledge', 'research', 'web'],
  'skill-creator': ['agent', 'skills', 'authoring'],
  'spark-prairie-fire': ['strategy', 'execution', 'bootstrap'],
  summarize: ['knowledge', 'research', 'summaries'],
  subscription: ['knowledge', 'research', 'subscriptions'],
  tmux: ['agent', 'automation', 'terminal'],
  'validate-idea': ['business', 'discovery', 'validation'],
  'webapp-testing': ['agent', 'automation', 'testing'],
  workflows: ['strategy', 'workflow', 'orchestration'],
};

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown, fallback = 999) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map(entry => asString(entry))
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined;
}

function inferHierarchy(id: string, frontmatter: SkillFrontmatter): SkillHierarchy {
  const explicitPath = [
    ...asStringArray(frontmatter.hierarchy?.path),
    ...asStringArray(frontmatter.path),
  ];

  const inferredPath = (() => {
    if (explicitPath.length >= 3) return explicitPath.slice(0, 3);

    const overridden = HIERARCHY_OVERRIDES[id];
    if (overridden) return overridden;

    if (id.startsWith('article-')) {
      return ['content', 'article', id.replace(/^article-/, '')];
    }

    if (id.endsWith('-fortune')) {
      return ['fortune', 'divination', id.replace(/-fortune$/, '')];
    }

    if (id === 'subscription') {
      return ['knowledge', 'research', 'subscriptions'];
    }

    if (id === 'blog-to-x') {
      return ['content', 'distribution', 'social'];
    }

    if (
      id.endsWith('-review')
      || id.endsWith('-plan')
      || id.endsWith('-customers')
      || id.endsWith('-community')
      || id.endsWith('-idea')
      || id === 'pricing'
      || id === 'processize'
      || id === 'mvp'
    ) {
      return ['business', 'strategy', id];
    }

    return ['general', 'utility', id];
  })();

  const domain = asString(frontmatter.hierarchy?.domain) || asString(frontmatter.domain) || inferredPath[0];
  const category = asString(frontmatter.hierarchy?.category) || asString(frontmatter.category) || inferredPath[1];
  const subcategory =
    asString(frontmatter.hierarchy?.subcategory) ||
    asString(frontmatter.subcategory) ||
    inferredPath[2];

  return {
    domain,
    category,
    subcategory,
    path: [domain, category, subcategory],
    order: asNumber(frontmatter.hierarchy?.order ?? frontmatter.order),
  };
}

function extractLegacyPromptContract(content: string) {
  const system = content.match(
    /The web app (?:Claude )?skill defines this system prompt:\s+````text\r?\n([\s\S]*?)\r?\n````/,
  )?.[1];
  const prompt = content.match(
    /The web app (?:Claude )?skill uses this prompt template:\s+````text\r?\n([\s\S]*?)\r?\n````/,
  )?.[1];
  const output = content.match(/Expected structured output key:\s*`([^`]+)`/)?.[1];

  return {
    system: system?.trim(),
    prompt: prompt?.trim(),
    output: output?.trim(),
  };
}

function inferLookup(id: string, frontmatter: SkillFrontmatter, hierarchy: SkillHierarchy): SkillLookup {
  const invoke = asString(frontmatter.lookup?.invoke) || asString(frontmatter.invoke) || hierarchy.path.join('/');
  const aliases = unique([
    ...asStringArray(frontmatter.lookup?.aliases),
    ...asStringArray(frontmatter.aliases),
    id,
    hierarchy.path.join('/'),
  ]);
  const keywords = unique([
    ...asStringArray(frontmatter.lookup?.keywords),
    ...asStringArray(frontmatter.keywords),
    ...id.split('-'),
    ...hierarchy.path,
  ]);

  return { invoke, aliases, keywords };
}

function sortSkills(skills: SkillSummary[]) {
  return skills.sort((left, right) => {
    if (left.hierarchy.order !== right.hierarchy.order) {
      return left.hierarchy.order - right.hierarchy.order;
    }

    const leftPath = left.hierarchy.path.join('/');
    const rightPath = right.hierarchy.path.join('/');
    if (leftPath !== rightPath) {
      return leftPath.localeCompare(rightPath);
    }

    return left.name.localeCompare(right.name);
  });
}

function parseSkillMd(id: string, includeDetail = false): Skill | SkillSummary | null {
  const file = path.join(skillsDir, id, 'SKILL.md');
  if (!fs.existsSync(file)) return null;

  const raw = fs.readFileSync(file, 'utf8');
  const { data, content } = matter(raw);
  const frontmatter = data as SkillFrontmatter;
  const legacyPromptContract = extractLegacyPromptContract(content);
  const prompt = asString(frontmatter.prompt) || legacyPromptContract.prompt || '';
  const output = asString(frontmatter.output) || legacyPromptContract.output || '';
  const system = asString(frontmatter.system) || legacyPromptContract.system || undefined;
  const explicitInvocable = asBoolean(frontmatter.invocable) ?? asBoolean(frontmatter.user_invocable);
  const invocable = explicitInvocable ?? Boolean(prompt && output);

  const hierarchy = inferHierarchy(id, frontmatter);
  const lookup = inferLookup(id, frontmatter, hierarchy);

  const summary: SkillSummary = {
    id,
    name: asString(frontmatter.name) || id,
    name_zh: asString(frontmatter.name_zh) || undefined,
    description: asString(frontmatter.description),
    description_zh: asString(frontmatter.description_zh) || undefined,
    invocable,
    output: output || undefined,
    hierarchy,
    lookup,
  };

  if (!includeDetail) return summary;

  return {
    ...summary,
    system,
    prompt: prompt || undefined,
  };
}

function scoreSkillReference(summary: SkillSummary, reference: string) {
  const normalizedReference = normalize(reference);
  if (!normalizedReference) return 0;

  const exactFields = [
    summary.id,
    summary.lookup.invoke,
    summary.name,
    summary.name_zh,
    ...summary.lookup.aliases,
  ].filter(Boolean) as string[];

  if (exactFields.some(field => normalize(field) === normalizedReference)) {
    return 100;
  }

  const corpus = [
    summary.id,
    summary.name,
    summary.name_zh,
    summary.description,
    summary.description_zh,
    summary.lookup.invoke,
    ...summary.lookup.aliases,
    ...summary.lookup.keywords,
    ...summary.hierarchy.path,
  ].filter(Boolean) as string[];

  const normalizedCorpus = normalize(corpus.join(' '));
  if (!normalizedCorpus) return 0;

  let score = 0;
  if (normalizedCorpus.includes(normalizedReference)) score += 60;

  const tokens = normalizedReference.split(' ').filter(Boolean);
  for (const token of tokens) {
    if (normalizedCorpus.includes(token)) {
      score += 12;
    }
  }

  if (summary.lookup.invoke.startsWith(reference)) score += 10;

  return score;
}

export type { Skill, SkillHierarchy, SkillLookup, SkillSummary } from '@/lib/skill-taxonomy';

function filterSkills(skills: SkillSummary[], options: SkillQueryOptions = {}) {
  if (options.includeNonInvocable) return skills;
  return skills.filter((skill): skill is InvocableSkillSummary => skill.invocable);
}

export function getSkills(options: SkillQueryOptions = {}): SkillSummary[] {
  if (!fs.existsSync(skillsDir)) return [];

  const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => parseSkillMd(entry.name, false))
    .filter((skill): skill is SkillSummary => skill !== null);

  return sortSkills(filterSkills(skills, options));
}

export function findSkills(query: string, options: SkillQueryOptions = {}) {
  return getSkills(options)
    .map(skill => ({ skill, score: scoreSkillReference(skill, query) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map(entry => entry.skill);
}

export function getSkill(id: string): Skill | null {
  const skill = parseSkillMd(id, true);
  return skill as Skill | null;
}

export function resolveSkillReference(reference: string, options: SkillQueryOptions = {}): Skill | null {
  const exact = getSkill(reference);
  if (exact && (options.includeNonInvocable || exact.invocable)) return exact;

  const matches = findSkills(reference, options);
  if (matches.length === 0) return null;

  return getSkill(matches[0].id);
}

export function saveSkill(skill: SkillDraft) {
  const dir = path.join(skillsDir, skill.id);
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let body = `# ${skill.name}\n`;
  if (fs.existsSync(file)) {
    const existing = matter(fs.readFileSync(file, 'utf8'));
    body = existing.content;
  }

  const hierarchy = inferHierarchy(skill.id, skill as SkillFrontmatter);
  const lookup = inferLookup(skill.id, skill as SkillFrontmatter, hierarchy);

  const frontmatter: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
    invocable: true,
    system: skill.system,
    prompt: skill.prompt,
    output: skill.output,
    hierarchy,
    lookup,
  };

  if (skill.name_zh) frontmatter.name_zh = skill.name_zh;
  if (skill.description_zh) frontmatter.description_zh = skill.description_zh;

  const output = matter.stringify(body, frontmatter);
  fs.writeFileSync(file, output);
}

export function deleteSkill(id: string) {
  const dir = path.join(skillsDir, id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
}
