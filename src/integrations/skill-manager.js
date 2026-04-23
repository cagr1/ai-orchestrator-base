const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const VALID_OUTPUT_CONTRACTS = new Set(['json_files', 'markdown', 'none']);
const REQUIRED_SECTIONS = ['Constraints', 'Output bounds'];

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
    typeof attributes.output_contract === 'string' &&
    VALID_OUTPUT_CONTRACTS.has(attributes.output_contract)
  );
};

const hasSection = (body, heading) => {
  const lines = String(body || '').split(/\r?\n/);
  return lines.some((line) => line.trim() === `## ${heading}`);
};

const ensureRequiredSections = (body) => {
  let nextBody = String(body || '');
  const addedSections = [];

  REQUIRED_SECTIONS.forEach((heading) => {
    if (hasSection(nextBody, heading)) return;
    nextBody = nextBody.replace(/\s*$/, '');
    nextBody += `${nextBody.trim() ? '\n\n' : ''}## ${heading}\n\n`;
    addedSections.push(heading);
  });

  if (nextBody && !nextBody.endsWith('\n')) {
    nextBody += '\n';
  }

  return { body: nextBody, addedSections };
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
    return {
      changed: false,
      content: null,
      metadata: null,
      added_frontmatter: false,
      added_sections: [],
      renamed: false,
      filePath
    };
  }

  const parsed = splitFrontmatter(original);
  const existing = parsed.attributes || {};
  const derived = deriveSkillMetadata(filePath, parsed.body);
  const normalized = { ...derived, ...existing };
  if (derived.max_lines_per_file !== undefined && existing.max_lines_per_file === undefined) {
    normalized.max_lines_per_file = derived.max_lines_per_file;
  }
  const sectionResult = ensureRequiredSections(parsed.body);
  const hasValidFrontmatter = parsed.hasFrontmatter && hasValidNormalizedFrontmatter(existing);
  const needsChange = !hasValidFrontmatter || sectionResult.addedSections.length > 0;

  if (!needsChange) {
    return {
      changed: false,
      content: original,
      metadata: existing,
      added_frontmatter: false,
      added_sections: [],
      renamed: false,
      filePath
    };
  }

  const nextContent = `${serializeFrontmatter(normalized)}${sectionResult.body}`;
  fs.writeFileSync(filePath, nextContent, 'utf-8');
  return {
    changed: true,
    content: nextContent,
    metadata: normalized,
    added_frontmatter: !hasValidFrontmatter,
    added_sections: sectionResult.addedSections,
    renamed: false,
    filePath
  };
};

const collectSkills = (dir, baseDir, items = []) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(`${full}.md`)) continue;
      collectSkills(full, baseDir, items);
      continue;
    }
    if (entry.name === 'SKILL.md' && fs.existsSync(`${dir}.md`)) continue;
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

const renameSkillFileToMarkdown = (filePath) => {
  if (path.extname(filePath).toLowerCase() === '.md') {
    return { filePath, renamed: false };
  }
  const nextPath = `${filePath}.md`;
  if (fs.existsSync(nextPath)) {
    return { filePath: nextPath, renamed: false };
  }
  fs.renameSync(filePath, nextPath);
  return { filePath: nextPath, renamed: true };
};

const materializeSkillWrapper = (skillDirPath) => {
  const sourceFile = path.join(skillDirPath, 'SKILL.md');
  if (!fs.existsSync(sourceFile)) return null;
  const wrapperPath = `${skillDirPath}.md`;
  const sourceContent = readFile(sourceFile);
  if (sourceContent === null) return null;
  const previousContent = readFile(wrapperPath);
  const changed = previousContent !== sourceContent;
  if (changed) {
    fs.writeFileSync(wrapperPath, sourceContent, 'utf-8');
  }
  return { wrapperPath, changed };
};

const normalizeSkillsDirectory = (dir) => {
  const result = {
    normalized: 0,
    renamed: 0,
    materialized: 0,
    files: []
  };
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const materialized = materializeSkillWrapper(full);
      if (materialized) {
        if (materialized.changed) {
          result.materialized += 1;
        }
        const normalized = normalizeSkillFile(materialized.wrapperPath);
        if (normalized.changed) {
          result.normalized += 1;
        }
        result.files.push({ ...normalized, filePath: materialized.wrapperPath });
        continue;
      }
      const nested = normalizeSkillsDirectory(full);
      result.normalized += nested.normalized;
      result.renamed += nested.renamed;
      result.materialized += nested.materialized;
      result.files.push(...nested.files);
      continue;
    }

    const renamed = renameSkillFileToMarkdown(full);
    if (renamed.renamed) {
      result.renamed += 1;
    }
    const normalized = normalizeSkillFile(renamed.filePath);
    if (normalized.changed) {
      result.normalized += 1;
    }
    result.files.push({ ...normalized, renamed: renamed.renamed, filePath: renamed.filePath });
  }

  return result;
};

const auditSkillFile = (filePath) => {
  const content = readFile(filePath);
  if (content === null) {
    return { filePath, status: 'error', message: 'unreadable' };
  }

  const parsed = splitFrontmatter(content);
  if (!parsed.hasFrontmatter) {
    return { filePath, status: 'error', message: 'no frontmatter' };
  }

  const attributes = parsed.attributes || {};
  if (!attributes.output_contract) {
    return { filePath, status: 'warn', message: 'missing output_contract' };
  }
  if (!VALID_OUTPUT_CONTRACTS.has(attributes.output_contract)) {
    return { filePath, status: 'warn', message: `invalid output_contract: ${attributes.output_contract}` };
  }
  if (typeof attributes.name !== 'string' || typeof attributes.description !== 'string') {
    return { filePath, status: 'warn', message: 'missing required frontmatter fields' };
  }

  return { filePath, status: 'valid', message: 'valid' };
};

const auditSkillsDirectory = (dir, baseDir = dir, items = []) => {
  if (!fs.existsSync(dir)) return items;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (fs.existsSync(`${full}.md`)) {
        items.push(auditSkillFile(`${full}.md`));
        continue;
      }
      auditSkillsDirectory(full, baseDir, items);
      continue;
    }

    if (entry.name === 'SKILL.md' && fs.existsSync(`${dir}.md`)) {
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (ext !== '.md') {
      if (ext) {
        continue;
      }
      items.push({
        filePath: path.relative(baseDir, full).replace(/\\/g, '/'),
        status: 'warn',
        message: 'missing .md extension'
      });
      continue;
    }

    const audit = auditSkillFile(full);
    items.push({
      ...audit,
      filePath: path.relative(baseDir, full).replace(/\\/g, '/')
    });
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

module.exports = {
  auditSkillFile,
  auditSkillsDirectory,
  buildUnifiedSkillsIndex,
  normalizeSkillFile,
  normalizeSkillsDirectory
};
