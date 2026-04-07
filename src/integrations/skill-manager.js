const fs = require('fs');
const path = require('path');

const readFile = (filepath) => {
  try {
    return fs.readFileSync(filepath, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const parseFrontmatterName = (content) => {
  if (!content || !content.startsWith('---')) return null;
  const end = content.indexOf('---', 3);
  if (end === -1) return null;
  const front = content.slice(3, end);
  const match = front.match(/name:\s*(.+)/i);
  return match ? match[1].trim() : null;
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

module.exports = { buildUnifiedSkillsIndex };
