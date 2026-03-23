import fs from 'fs';
import path from 'path';

const skillsDir = path.join(process.cwd(), 'data', 'skills');

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

export function getSkills(): Skill[] {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(skillsDir, f), 'utf8')) as Skill);
}

export function getSkill(id: string): Skill | null {
  const file = path.join(skillsDir, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function saveSkill(skill: Skill) {
  if (!fs.existsSync(skillsDir)) fs.mkdirSync(skillsDir, { recursive: true });
  fs.writeFileSync(path.join(skillsDir, `${skill.id}.json`), JSON.stringify(skill, null, 2));
}

export function deleteSkill(id: string) {
  const file = path.join(skillsDir, `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
