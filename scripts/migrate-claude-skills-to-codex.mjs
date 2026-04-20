import fs from 'fs';
import path from 'path';

const root = process.cwd();
const sourceRoot = path.join(root, '.claude', 'skills');
const targetRoot = path.join(root, '.codex', 'skills');

const DISPLAY_NAME_WORDS = {
  ai: 'AI',
  faq: 'FAQ',
  x: 'X',
  bazi: 'BaZi',
  ziwei: 'ZiWei',
};

const DESCRIPTION_OVERRIDES = {
  'article-brief': 'Generate a short article excerpt or summary teaser. Use when Codex needs to write a brief, excerpt, teaser, or summary hook for a blog post or article.',
  'article-faq': 'Generate a reader-facing FAQ section for an article. Use when Codex needs to add FAQs, common questions, or Q&A blocks to blog content.',
  'article-polish': 'Rewrite and polish article copy for clarity and engagement. Use when Codex needs to improve wording, flow, tone, or readability without changing the core meaning.',
  'article-structure': 'Restructure article content for better flow and readability. Use when Codex needs to reorganize sections, improve sequencing, or tighten narrative structure.',
  'article-tags': 'Extract high-value tags and keywords from an article. Use when Codex needs blog tags, topic labels, SEO keywords, or content taxonomy suggestions.',
  'article-title': 'Generate SEO-friendly article titles and headline options. Use when Codex needs blog post titles, headline variants, or click-worthy title ideas.',
  'article-translate-en': 'Translate Chinese article content into natural English. Use when Codex needs to turn Chinese blog copy into fluent English while preserving meaning.',
  'bazi-fortune': 'Analyze BaZi or Four Pillars fortune charts. Use when Codex receives birth date and time details for BaZi, 四柱, 天干地支, 五行, or related Chinese astrology analysis.',
  'blog-to-x': 'Convert blog posts or diary entries into X or Twitter posts. Use when Codex needs tweet drafts, thread drafts, tweetstorms, or share-on-X copy from long-form content.',
  'liuyao-fortune': 'Analyze Liu Yao or I Ching divination results. Use when Codex needs 六爻, 易经占卜, 卦象 interpretation, or related fortune analysis.',
  'meihua-fortune': 'Analyze Meihua Yishu divination results. Use when Codex needs 梅花易数, numerology-style divination, or related Chinese fortune interpretation.',
  subscription: 'Summarize the latest updates from subscribed sources. Use when Codex needs a recent-content digest for blogs, GitHub repositories, X accounts, RSS feeds, Reddit, or similar web sources.',
  'ziwei-fortune': 'Analyze Zi Wei Dou Shu fortune charts. Use when Codex receives birth details for 紫微斗数, 命宫, 十二宫, or related palace-based Chinese astrology analysis.',
};

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function assertWithin(baseDir, targetPath) {
  const base = path.resolve(baseDir);
  const target = path.resolve(targetPath);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) {
    throw new Error(`Refusing to operate outside ${base}: ${target}`);
  }
}

function yamlQuote(value) {
  return `"${String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r?\n/g, '\\n')}"`;
}

function decodeFrontmatterValue(rawValue) {
  if (rawValue == null) return undefined;
  const value = rawValue.trim();

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1);
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  return value;
}

function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error('Missing YAML frontmatter in source skill');
  }

  const frontmatter = match[1];
  const fields = ['name', 'description', 'user_invocable', 'system', 'prompt', 'output', 'name_zh', 'description_zh'];
  const data = {};

  for (const field of fields) {
    const fieldMatch = frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'));
    if (!fieldMatch) continue;
    data[field] = decodeFrontmatterValue(fieldMatch[1]);
  }

  return {
    data,
    content: source.slice(match[0].length),
  };
}

function formatDisplayName(skillName) {
  return skillName
    .split('-')
    .filter(Boolean)
    .map((part) => DISPLAY_NAME_WORDS[part] || `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function formatShortDescription(displayName) {
  return `Codex mirror for ${displayName}`;
}

function formatDefaultPrompt(skillName, displayName) {
  return `Use $${skillName} to apply the ${displayName} workflow to this task.`;
}

function validateGeneratedSkill(skillName, skillMarkdown, openAiYaml) {
  const frontmatterMatch = skillMarkdown.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error(`Generated skill ${skillName} is missing frontmatter`);
  }

  const frontmatter = frontmatterMatch[1];
  const keys = [...frontmatter.matchAll(/^([a-zA-Z0-9_-]+):/gm)].map((match) => match[1]);
  const allowedKeys = new Set(['name', 'description']);
  const unexpected = keys.filter((key) => !allowedKeys.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Generated skill ${skillName} has unexpected frontmatter keys: ${unexpected.join(', ')}`);
  }

  if (!/^[a-z0-9-]+$/.test(skillName) || skillName.length > 64) {
    throw new Error(`Generated skill name is invalid: ${skillName}`);
  }

  const descriptionMatch = frontmatter.match(/^description:\s*"([\s\S]*)"$/m);
  if (!descriptionMatch) {
    throw new Error(`Generated skill ${skillName} is missing a quoted description`);
  }

  const description = descriptionMatch[1];
  if (description.includes('<') || description.includes('>') || description.length > 1024) {
    throw new Error(`Generated skill ${skillName} has an invalid description`);
  }

  if (!openAiYaml.includes('display_name:') || !openAiYaml.includes('short_description:') || !openAiYaml.includes('default_prompt:')) {
    throw new Error(`Generated skill ${skillName} is missing required agents/openai.yaml fields`);
  }
}

function copyResource(sourcePath, targetPath) {
  if (!fs.existsSync(sourcePath)) return;
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, targetPath, { recursive: true });
    return;
  }
  fs.copyFileSync(sourcePath, targetPath);
}

function buildSkillMarkdown(skillName, metadata, body) {
  const description = DESCRIPTION_OVERRIDES[skillName]
    || metadata.description
    || `Use $${skillName} when this workflow applies.`;
  const sections = [
    '---',
    `name: ${skillName}`,
    `description: ${yamlQuote(description)}`,
    '---',
    '',
    `This skill mirrors \`.claude/skills/${skillName}\` for Codex. Keep \`.claude/skills/${skillName}/SKILL.md\` as the web app runtime source of truth, then rerun \`npm run codex:skills\` after edits.`,
    '',
    body.trim(),
  ];

  if (metadata.system || metadata.prompt || metadata.output) {
    sections.push('', '## Legacy Prompt Contract');
  }

  if (metadata.system) {
    sections.push(
      '',
      'The web app Claude skill defines this system prompt:',
      '',
      '````text',
      String(metadata.system).trim(),
      '````',
    );
  }

  if (metadata.prompt) {
    sections.push(
      '',
      'The web app Claude skill uses this prompt template:',
      '',
      '````text',
      String(metadata.prompt).trim(),
      '````',
    );
  }

  if (metadata.output) {
    sections.push('', `Expected structured output key: \`${metadata.output}\``);
  }

  sections.push('');
  return sections.join('\n');
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
  return openAiYaml;
}

function migrateSkill(skillName) {
  const sourceDir = path.join(sourceRoot, skillName);
  const sourceSkillFile = path.join(sourceDir, 'SKILL.md');
  const targetDir = path.join(targetRoot, skillName);

  assertWithin(targetRoot, targetDir);
  if (!fs.existsSync(sourceSkillFile)) {
    throw new Error(`Missing source skill: ${sourceSkillFile}`);
  }

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  ensureDir(targetDir);

  const source = fs.readFileSync(sourceSkillFile, 'utf8');
  const parsed = parseFrontmatter(source);

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    if (entry.name === 'SKILL.md') continue;
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    copyResource(sourcePath, targetPath);
  }

  const skillMarkdown = buildSkillMarkdown(skillName, parsed.data, parsed.content);
  const openAiYaml = writeOpenAiYaml(targetDir, skillName);
  validateGeneratedSkill(skillName, skillMarkdown, openAiYaml);
  fs.writeFileSync(path.join(targetDir, 'SKILL.md'), skillMarkdown);
}

function main() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source skills directory not found: ${sourceRoot}`);
  }

  ensureDir(targetRoot);

  const skills = fs.readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(sourceRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();

  for (const skillName of skills) {
    migrateSkill(skillName);
    console.log(`Migrated ${skillName}`);
  }

  console.log(`Migrated ${skills.length} skill(s) to ${path.relative(root, targetRoot)}`);
}

main();
