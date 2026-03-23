import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const skillsDir = path.join(process.cwd(), '.claude', 'skills');

export interface Skill {
  id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  system?: string;
  prompt: string;
  output: string;
}

function parseSkillMd(dir: string): Skill | null {
  const file = path.join(skillsDir, dir, 'SKILL.md');
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, 'utf8');
  const { data } = matter(raw);
  // Only return skills that have web-app fields (system/prompt/output)
  if (!data.prompt || !data.output) return null;
  return {
    id: dir,
    name: data.name_zh || data.name || dir,
    name_zh: data.name_zh,
    description: data.description_zh || data.description || '',
    description_zh: data.description_zh,
    system: data.system,
    prompt: data.prompt,
    output: data.output,
  };
}

export function getSkills(): Skill[] {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => parseSkillMd(d.name))
    .filter((s): s is Skill => s !== null);
}

export function getSkill(id: string): Skill | null {
  return parseSkillMd(id);
}

export function saveSkill(skill: Skill) {
  const dir = path.join(skillsDir, skill.id);
  const file = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // Preserve existing body content if the file already exists
  let body = `# ${skill.name}\n`;
  if (fs.existsSync(file)) {
    const existing = matter(fs.readFileSync(file, 'utf8'));
    body = existing.content;
  }

  const frontmatter: Record<string, unknown> = {
    name: skill.id,
    description: skill.description,
    user_invocable: true,
    system: skill.system,
    prompt: skill.prompt,
    output: skill.output,
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
