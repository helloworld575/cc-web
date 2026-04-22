export interface SkillHierarchy {
  domain: string;
  category: string;
  subcategory: string;
  path: string[];
  order: number;
}

export interface SkillLookup {
  invoke: string;
  aliases: string[];
  keywords: string[];
}

export interface SkillSummary {
  id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  output: string;
  hierarchy: SkillHierarchy;
  lookup: SkillLookup;
}

export interface Skill extends SkillSummary {
  system?: string;
  prompt: string;
}

export interface SkillGroup {
  key: string;
  label: string;
  skills: SkillSummary[];
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\u4e00-\u9fff\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function humanizeSkillSegment(segment: string) {
  return segment
    .split(/[-_/]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function formatSkillPath(skill: Pick<SkillSummary, 'hierarchy'>) {
  return skill.hierarchy.path.map(humanizeSkillSegment).join(' / ');
}

export function matchSkillSummary(skill: SkillSummary, query: string) {
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return true;

  const haystacks = [
    skill.id,
    skill.name,
    skill.name_zh,
    skill.description,
    skill.description_zh,
    skill.lookup.invoke,
    ...skill.lookup.aliases,
    ...skill.lookup.keywords,
    ...skill.hierarchy.path,
  ].filter(Boolean) as string[];

  const flattened = normalize(haystacks.join(' '));
  if (!flattened) return false;
  if (flattened.includes(normalizedQuery)) return true;

  return normalizedQuery
    .split(' ')
    .every(token => flattened.includes(token));
}

export function groupSkillSummaries(skills: SkillSummary[]): SkillGroup[] {
  const groups = new Map<string, SkillGroup>();

  for (const skill of skills) {
    const groupKey = `${skill.hierarchy.domain}/${skill.hierarchy.category}`;
    const groupLabel = `${humanizeSkillSegment(skill.hierarchy.domain)} / ${humanizeSkillSegment(skill.hierarchy.category)}`;
    const existing = groups.get(groupKey);

    if (existing) {
      existing.skills.push(skill);
      continue;
    }

    groups.set(groupKey, {
      key: groupKey,
      label: groupLabel,
      skills: [skill],
    });
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      skills: group.skills.sort((left, right) => {
        if (left.hierarchy.order !== right.hierarchy.order) {
          return left.hierarchy.order - right.hierarchy.order;
        }

        if (left.hierarchy.subcategory !== right.hierarchy.subcategory) {
          return left.hierarchy.subcategory.localeCompare(right.hierarchy.subcategory);
        }

        return left.name.localeCompare(right.name);
      }),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}
