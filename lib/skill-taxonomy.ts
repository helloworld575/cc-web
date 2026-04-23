export interface SkillHierarchy {
  domain: string;
  category: string;
  subcategory: string;
  path: string[];
  order: number;
}

export type SkillOrchestrationRole = 'root' | 'router' | 'leaf';
export type SkillExecutionMode = 'direct' | 'route' | 'hybrid' | 'reference';

export interface SkillOrchestrationChild {
  skill: string;
  when: string;
  mode: SkillExecutionMode;
}

export interface SkillOrchestration {
  role: SkillOrchestrationRole;
  mode: SkillExecutionMode;
  children: SkillOrchestrationChild[];
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
  invocable: boolean;
  output?: string;
  hierarchy: SkillHierarchy;
  lookup: SkillLookup;
  orchestration: SkillOrchestration;
}

export interface Skill extends SkillSummary {
  system?: string;
  prompt?: string;
  content: string;
}

export interface InvocableSkillSummary extends SkillSummary {
  invocable: true;
  output: string;
}

export interface InvocableSkill extends Skill {
  invocable: true;
  output: string;
  prompt: string;
}

export interface SkillGroup<T extends SkillSummary = SkillSummary> {
  key: string;
  label: string;
  skills: T[];
}

export interface SkillTreeChild<T extends SkillSummary = SkillSummary> {
  skill: T;
  route: SkillOrchestrationChild;
  children: SkillTreeChild<T>[];
}

export interface SkillTreeNode<T extends SkillSummary = SkillSummary> {
  skill: T;
  children: SkillTreeChild<T>[];
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
    skill.orchestration.role,
    skill.orchestration.mode,
    ...skill.orchestration.children.flatMap(child => [child.skill, child.when, child.mode]),
  ].filter(Boolean) as string[];

  const flattened = normalize(haystacks.join(' '));
  if (!flattened) return false;
  if (flattened.includes(normalizedQuery)) return true;

  return normalizedQuery
    .split(' ')
    .every(token => flattened.includes(token));
}

export function groupSkillSummaries<T extends SkillSummary>(skills: T[]): SkillGroup<T>[] {
  const groups = new Map<string, SkillGroup<T>>();

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
        const roleRank = roleSortOrder(left.orchestration.role) - roleSortOrder(right.orchestration.role);
        if (roleRank !== 0) {
          return roleRank;
        }

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

export function isInvocableSkillSummary(
  skill: SkillSummary | null | undefined,
): skill is InvocableSkillSummary {
  return Boolean(skill?.invocable && typeof skill.output === 'string' && skill.output.length > 0);
}

export function isInvocableSkill(skill: Skill | SkillSummary | null | undefined): skill is InvocableSkill {
  return Boolean(
    skill?.invocable
    && typeof skill.output === 'string'
    && skill.output.length > 0
    && 'prompt' in (skill ?? {})
    && typeof (skill as Skill).prompt === 'string'
    && (skill as Skill).prompt!.length > 0,
  );
}

function roleSortOrder(role: SkillOrchestrationRole) {
  switch (role) {
    case 'root':
      return 0;
    case 'router':
      return 1;
    default:
      return 2;
  }
}

function compareSkillSummary(left: SkillSummary, right: SkillSummary) {
  const roleRank = roleSortOrder(left.orchestration.role) - roleSortOrder(right.orchestration.role);
  if (roleRank !== 0) return roleRank;
  return left.name.localeCompare(right.name);
}

export function buildSkillOrchestrationForest<T extends SkillSummary>(skills: T[]): SkillTreeNode<T>[] {
  const skillById = new Map(skills.map(skill => [skill.id, skill] as const));
  const referenced = new Set<string>();

  for (const skill of skills) {
    for (const child of skill.orchestration.children) {
      if (skillById.has(child.skill)) {
        referenced.add(child.skill);
      }
    }
  }

  const explicitRoots = skills
    .filter(skill => skill.orchestration.role === 'root')
    .sort(compareSkillSummary);
  const implicitRoots = skills
    .filter(skill => skill.orchestration.role !== 'root' && !referenced.has(skill.id))
    .sort(compareSkillSummary);

  const rootSkills = [...explicitRoots, ...implicitRoots];

  const buildChildren = (parent: T, ancestry: Set<string>): SkillTreeChild<T>[] => {
    return parent.orchestration.children
      .map((route) => {
        const childSkill = skillById.get(route.skill);
        if (!childSkill) return null;
        if (ancestry.has(childSkill.id)) return null;

        const childAncestry = new Set(ancestry);
        childAncestry.add(childSkill.id);

        return {
          skill: childSkill,
          route,
          children: buildChildren(childSkill, childAncestry),
        };
      })
      .filter((entry): entry is SkillTreeChild<T> => entry !== null);
  };

  return rootSkills.map(skill => ({
    skill,
    children: buildChildren(skill, new Set([skill.id])),
  }));
}
