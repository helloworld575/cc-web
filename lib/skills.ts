import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { Skill, SkillHierarchy, SkillLookup, SkillSummary } from '@/lib/skill-taxonomy';

const skillsDir = path.join(process.cwd(), '.claude', 'skills');

type SkillFrontmatter = Record<string, unknown> & {
  name?: string;
  name_zh?: string;
  description?: string;
  description_zh?: string;
  system?: string;
  prompt?: string;
  output?: string;
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

function inferHierarchy(id: string, frontmatter: SkillFrontmatter): SkillHierarchy {
  const explicitPath = [
    ...asStringArray(frontmatter.hierarchy?.path),
    ...asStringArray(frontmatter.path),
  ];

  const inferredPath = (() => {
    if (explicitPath.length >= 3) return explicitPath.slice(0, 3);

    if (id.startsWith('article-')) {
      return ['content', 'article', id.replace(/^article-/, '')];
    }

    if (id.endsWith('-fortune')) {
      return ['fortune', 'divination', id.replace(/-fortune$/, '')];
    }

    if (id === 'subscription') {
      return ['research', 'subscriptions', 'briefing'];
    }

    if (id === 'blog-to-x') {
      return ['content', 'distribution', 'social'];
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
  const { data } = matter(raw);
  const frontmatter = data as SkillFrontmatter;

  if (!frontmatter.prompt || !frontmatter.output) return null;

  const hierarchy = inferHierarchy(id, frontmatter);
  const lookup = inferLookup(id, frontmatter, hierarchy);

  const summary: SkillSummary = {
    id,
    name: asString(frontmatter.name) || id,
    name_zh: asString(frontmatter.name_zh) || undefined,
    description: asString(frontmatter.description),
    description_zh: asString(frontmatter.description_zh) || undefined,
    output: asString(frontmatter.output),
    hierarchy,
    lookup,
  };

  if (!includeDetail) return summary;

  return {
    ...summary,
    system: asString(frontmatter.system) || undefined,
    prompt: asString(frontmatter.prompt),
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

export function getSkills(): SkillSummary[] {
  if (!fs.existsSync(skillsDir)) return [];

  const skills = fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => parseSkillMd(entry.name, false))
    .filter((skill): skill is SkillSummary => skill !== null);

  return sortSkills(skills);
}

export function findSkills(query: string) {
  return getSkills()
    .map(skill => ({ skill, score: scoreSkillReference(skill, query) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name))
    .map(entry => entry.skill);
}

export function getSkill(id: string): Skill | null {
  const skill = parseSkillMd(id, true);
  return skill as Skill | null;
}

export function resolveSkillReference(reference: string): Skill | null {
  const exact = getSkill(reference);
  if (exact) return exact;

  const matches = findSkills(reference);
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
    user_invocable: true,
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
