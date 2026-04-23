const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const readFile = (filepath) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const splitFrontmatter = (content) => {
  if (!content || !content.startsWith('---')) {
    return { attributes: null, body: content || '', hasFrontmatter: false };
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { attributes: null, body: content, hasFrontmatter: false };
  }

  let attributes = null;
  try {
    attributes = yaml.load(match[1]) || {};
  } catch (_e) {
    attributes = null;
  }

  return {
    attributes,
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
};

const parseFrontmatterName = (content) => {
  return splitFrontmatter(content).attributes?.name || null;
};

const humanizeSkillName = (name) => {
  return String(name || '')
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
};

const deriveSkillMetadata = (filePath, body = '') => {
  const normalizedPath = String(filePath || '').replace(/\\/g, '/');
  const baseName = path.basename(normalizedPath, '.md');
  const metadata = {
    name: baseName,
    description: `Produces ${humanizeSkillName(baseName)} guidance.`,
    output_contract: 'json_files'
  };

  const explicit = {
    'frontend-html-basic': {
      description: 'Generates scoped HTML, CSS, and JS files for simple browser-openable frontends.',
      output_contract: 'json_files',
      max_lines_per_file: 100
    },
    'design-taste': {
      description: 'Applies high-agency frontend design and engineering directives to premium UI work.',
      output_contract: 'none'
    },
    animations: {
      description: 'Produces GSAP and Three.js animation implementations for showcase frontend work.',
      output_contract: 'json_files'
    },
    'node-api': {
      description: 'Produces Express-style Node.js API implementations with validation and service layering.',
      output_contract: 'json_files'
    },
    'nodejs-backend-patterns': {
      description: 'Reference to the vendor Node.js backend patterns skill.',
      output_contract: 'none'
    },
    'nodejs-best-practices': {
      description: 'Reference to the vendor Node.js best practices skill.',
      output_contract: 'none'
    },
    accessibility: {
      description: 'Reference to the vendor accessibility skill.',
      output_contract: 'none'
    },
    'frontend-design': {
      description: 'Reference to the vendor frontend design skill.',
      output_contract: 'none'
    },
    seo: {
      description: 'Reference to the vendor SEO skill.',
      output_contract: 'none'
    }
  };

  if (explicit[baseName]) {
    Object.assign(metadata, explicit[baseName]);
  }

  if (normalizedPath.includes('/vendor/')) {
    metadata.output_contract = 'none';
  } else if (/readme|guide|docs|documentation/i.test(baseName)) {
    metadata.output_contract = 'markdown';
  } else if (/planner|plan|classifier|best-practices|design-taste/i.test(baseName)) {
    metadata.output_contract = 'none';
  }

  if (metadata.max_lines_per_file === undefined && /100 lines?|100-line|100 lines or fewer/i.test(body)) {
    metadata.max_lines_per_file = 100;
  }

  return metadata;
};

const hasValidNormalizedFrontmatter = (attributes) => {
  return Boolean(
    attributes &&
    typeof attributes.name === 'string' &&
    typeof attributes.description === 'string' &&
    typeof attributes.output_contract === 'string'
  );
};

const serializeFrontmatter = (attributes) => {
  const ordered = {};
  ['name', 'description', 'output_contract', 'max_lines_per_file'].forEach((key) => {
    if (attributes[key] !== undefined) {
      ordered[key] = attributes[key];
    }
  });
  Object.keys(attributes).forEach((key) => {
    if (ordered[key] === undefined && attributes[key] !== undefined) {
      ordered[key] = attributes[key];
    }
  });
  return `---\n${yaml.dump(ordered, { lineWidth: 120 }).trimEnd()}\n---\n\n`;
};

const normalizeSkillFile = (filePath) => {
  const original = readFile(filePath);
  if (original === null) {
    return { changed: false, content: null, metadata: null };
  }

  const parsed = splitFrontmatter(original);
  const existing = parsed.attributes || {};
  if (parsed.hasFrontmatter && hasValidNormalizedFrontmatter(existing)) {
    return { changed: false, content: original, metadata: existing };
  }

  const derived = deriveSkillMetadata(filePath, parsed.body);
  const normalized = { ...derived, ...existing };
  if (derived.max_lines_per_file !== undefined && existing.max_lines_per_file === undefined) {
    normalized.max_lines_per_file = derived.max_lines_per_file;
  }

  const nextContent = `${serializeFrontmatter(normalized)}${parsed.body}`;
  fs.writeFileSync(filePath, nextContent, 'utf-8');
  return { changed: true, content: nextContent, metadata: normalized };
};

const collectSkills = (dir, baseDir, items = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSkills(full, baseDir, items);
      continue;
    }
    if (!entry.name.endsWith('.md')) continue;
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');
    const content = readFile(full) || '';
    const name = parseFrontmatterName(content) || entry.name.replace(/\.md$/, '');
    let category = rel.split('/')[0];
    let source = 'local';
    if (category === 'vendor') {
      const parts = rel.split('/');
      category = parts[1] || 'vendor';
      source = 'autoskills';
    }
    items.push({ name, path: rel, category, source });
  }
  return items;
};

const buildUnifiedSkillsIndex = (skillsDir, outFile) => {
  if (!fs.existsSync(skillsDir)) return [];
  const items = collectSkills(skillsDir, skillsDir);
  if (outFile) {
    fs.writeFileSync(outFile, JSON.stringify({ generated_at: new Date().toISOString(), items }, null, 2));
  }
  return items;
};

module.exports = { buildUnifiedSkillsIndex, normalizeSkillFile };
