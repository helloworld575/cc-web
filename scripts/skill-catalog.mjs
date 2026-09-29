const skillRoles = new Set(['root', 'router', 'leaf']);
const executionModes = new Set(['direct', 'route', 'hybrid', 'reference']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

export function toSkillCatalogEntry(id, frontmatter) {
  const invocable = frontmatter.invocable
    ?? frontmatter.user_invocable
    ?? Boolean(frontmatter.prompt && frontmatter.output);
  const hasOrchestration = Object.prototype.hasOwnProperty.call(frontmatter, 'orchestration');
  let orchestration = {
    role: 'leaf',
    mode: invocable ? 'direct' : 'reference',
    children: [],
  };

  if (hasOrchestration) {
    const rawOrchestration = frontmatter.orchestration;
    if (!rawOrchestration || typeof rawOrchestration !== 'object' || Array.isArray(rawOrchestration)) {
      orchestration = rawOrchestration;
    } else {
      const hasChildren = Object.prototype.hasOwnProperty.call(rawOrchestration, 'children');
      const children = hasChildren ? rawOrchestration.children : [];
      const hasRole = Object.prototype.hasOwnProperty.call(rawOrchestration, 'role');
      const hasMode = Object.prototype.hasOwnProperty.call(rawOrchestration, 'mode');
      orchestration = {
        ...rawOrchestration,
        role: hasRole ? rawOrchestration.role : (Array.isArray(children) && children.length ? 'router' : 'leaf'),
        mode: hasMode
          ? rawOrchestration.mode
          : (Array.isArray(children) && children.length
              ? (invocable ? 'hybrid' : 'route')
              : (invocable ? 'direct' : 'reference')),
        children,
      };
    }
  }

  return {
    id,
    name: frontmatter.name,
    description: frontmatter.description,
    invocable,
    prompt: frontmatter.prompt,
    output: frontmatter.output,
    orchestration,
  };
}

export function validateSkillCatalog(skills) {
  const failures = [];
  const skillById = new Map();

  if (!Array.isArray(skills) || skills.length === 0) {
    failures.push('catalog: at least one skill is required.');
    return failures;
  }

  for (const skill of skills) {
    if (!isNonEmptyString(skill.id)) {
      failures.push('catalog: every skill must have a non-empty id.');
      continue;
    }
    if (skillById.has(skill.id)) {
      failures.push(`${skill.id}: duplicate skill id.`);
      continue;
    }
    skillById.set(skill.id, skill);
  }

  for (const skill of skillById.values()) {
    const { id, orchestration } = skill;

    if (!isNonEmptyString(skill.name)) failures.push(`${id}: name must be a non-empty string.`);
    if (!isNonEmptyString(skill.description)) failures.push(`${id}: description must be a non-empty string.`);
    if (typeof skill.invocable !== 'boolean') failures.push(`${id}: invocable must be a boolean.`);
    if (skill.invocable && (!isNonEmptyString(skill.prompt) || !isNonEmptyString(skill.output))) {
      failures.push(`${id}: invocable skills must define non-empty prompt and output values.`);
    }

    if (!orchestration || typeof orchestration !== 'object' || Array.isArray(orchestration)) {
      failures.push(`${id}: orchestration must be an object.`);
      continue;
    }
    if (!skillRoles.has(orchestration.role)) {
      failures.push(`${id}: orchestration role must be root, router, or leaf.`);
    }
    if (!executionModes.has(orchestration.mode)) {
      failures.push(`${id}: orchestration mode is invalid.`);
    }
    if (!Array.isArray(orchestration.children)) {
      failures.push(`${id}: orchestration children must be an array.`);
      continue;
    }
    if ((orchestration.role === 'root' || orchestration.role === 'router') && orchestration.children.length === 0) {
      failures.push(`${id}: ${orchestration.role} skills must define child routes.`);
    }
    if (orchestration.role === 'leaf' && orchestration.children.length > 0) {
      failures.push(`${id}: leaf skills cannot define child routes.`);
    }

    const childIds = new Set();
    for (const child of orchestration.children) {
      if (!child || typeof child !== 'object' || Array.isArray(child)) {
        failures.push(`${id}: each child route must be an object.`);
        continue;
      }
      if (!isNonEmptyString(child.skill)) {
        failures.push(`${id}: each child route must name a skill.`);
        continue;
      }
      if (childIds.has(child.skill)) failures.push(`${id}: routes to "${child.skill}" more than once.`);
      childIds.add(child.skill);
      if (!isNonEmptyString(child.when)) failures.push(`${id}: route to "${child.skill}" must define when to use it.`);
      if (!executionModes.has(child.mode)) failures.push(`${id}: route to "${child.skill}" has an invalid mode.`);

      const target = skillById.get(child.skill);
      if (!target) {
        failures.push(`${id}: references missing skill "${child.skill}".`);
        continue;
      }
      if (child.mode === 'route' && (!Array.isArray(target.orchestration?.children) || target.orchestration.children.length === 0)) {
        failures.push(`${id}: route target "${child.skill}" has no child routes.`);
      }
    }
  }

  const activePath = [];
  const checked = new Set();
  const reportedCycles = new Set();
  const visit = (skill) => {
    const cycleStart = activePath.indexOf(skill.id);
    if (cycleStart >= 0) {
      const cycle = activePath.slice(cycleStart);
      const cycleKey = [...cycle].sort().join('\0');
      if (!reportedCycles.has(cycleKey)) {
        reportedCycles.add(cycleKey);
        failures.push(`${cycle[0]}: orchestration cycle detected: ${[...cycle, cycle[0]].join(' -> ')}.`);
      }
      return;
    }
    if (checked.has(skill.id)) return;

    activePath.push(skill.id);
    const children = Array.isArray(skill.orchestration?.children) ? skill.orchestration.children : [];
    for (const child of children) {
      const target = skillById.get(child?.skill);
      if (target) visit(target);
    }
    activePath.pop();
    checked.add(skill.id);
  };

  for (const skill of skillById.values()) visit(skill);
  return failures;
}
