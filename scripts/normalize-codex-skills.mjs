import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const root = process.cwd();
const skillsRoot = path.join(root, '.codex', 'skills');

const DISPLAY_NAME_WORDS = {
  ai: 'AI',
  faq: 'FAQ',
  x: 'X',
  bazi: 'BaZi',
  ziwei: 'ZiWei',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function yamlQuote(value) {
  return `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')}"`;
}

function formatDisplayName(skillName) {
  return skillName
    .split('-')
    .filter(Boolean)
    .map((part) => DISPLAY_NAME_WORDS[part] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatShortDescription(displayName) {
  return `Codex skill for ${displayName}`;
}

function formatDefaultPrompt(skillName, displayName) {
  return `Use $${skillName} to apply the ${displayName} workflow to this task.`;
}

function extractLegacyPromptContract(content) {
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

function cleanupBody(content) {
  return content
    .replace(
      /^This skill mirrors `[^`]+` for Codex\.[\s\S]*?after edits\.\s*/m,
      '',
    )
    .replace('## Legacy Prompt Contract', '## App Prompt Contract')
    .replaceAll('The web app Claude skill defines this system prompt:', 'The web app skill defines this system prompt:')
    .replaceAll('The web app Claude skill uses this prompt template:', 'The web app skill uses this prompt template:')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function writeOpenAiYaml(targetDir, skillName) {
  const displayName = formatDisplayName(skillName);
  const openAiYaml = [
    'interface:',
    `  display_name: ${yamlQuote(displayName)}`,
    `  short_description: ${yamlQuote(formatShortDescription(displayName))}`,
    `  default_prompt: ${yamlQuote(formatDefaultPrompt(skillName, displayName))}`,
    '',
  ].join('\n');

  const agentsDir = path.join(targetDir, 'agents');
  ensureDir(agentsDir);
  fs.writeFileSync(path.join(agentsDir, 'openai.yaml'), openAiYaml);
}

function normalizeSkill(skillName) {
  const skillDir = path.join(skillsRoot, skillName);
  const file = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(file)) return;

  const raw = fs.readFileSync(file, 'utf8');
  const parsed = matter(raw);
  const legacyPromptContract = extractLegacyPromptContract(parsed.content);
  const cleanedBody = cleanupBody(parsed.content);

  const frontmatter = {
    ...parsed.data,
  };

  delete frontmatter.user_invocable;

  if (legacyPromptContract.prompt && legacyPromptContract.output) {
    frontmatter.invocable = true;
    frontmatter.prompt = frontmatter.prompt || legacyPromptContract.prompt;
    frontmatter.output = frontmatter.output || legacyPromptContract.output;
    if (legacyPromptContract.system && !frontmatter.system) {
      frontmatter.system = legacyPromptContract.system;
    }
    writeOpenAiYaml(skillDir, skillName);
  }

  const next = matter.stringify(`${cleanedBody}\n`, frontmatter);
  fs.writeFileSync(file, next);
}

function main() {
  if (!fs.existsSync(skillsRoot)) {
    throw new Error(`Skills directory not found: ${skillsRoot}`);
  }

  const skills = fs.readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();

  for (const skillName of skills) {
    normalizeSkill(skillName);
    console.log(`Normalized ${skillName}`);
  }

  console.log(`Normalized ${skills.length} skill(s) in ${path.relative(root, skillsRoot)}`);
}

main();
