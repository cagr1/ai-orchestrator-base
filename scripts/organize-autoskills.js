const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const AGENTS_SKILLS = path.join(ROOT, '.agents', 'skills');
const VENDOR_ROOT = path.join(ROOT, 'skills', 'vendor');
const LOCK_FILE = path.join(ROOT, 'skills-lock.json');

const readFile = (p) => {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch (_e) {
    return null;
  }
};

const parseFrontmatter = (content) => {
  if (!content || !content.startsWith('---')) return {};
  const end = content.indexOf('---', 3);
  if (end === -1) return {};
  const front = content.slice(3, end);
  const nameMatch = front.match(/name:\s*(.+)/i);
  const descMatch = front.match(/description:\s*(.+)/i);
  return {
    name: nameMatch ? nameMatch[1].trim() : null,
    description: descMatch ? descMatch[1].trim() : null
  };
};

const inferCategory = ({ name, description }) => {
  const hay = `${name || ''} ${description || ''}`.toLowerCase();
  if (/(node|nodejs|backend|api|server|express|fastify)/.test(hay)) return 'backend';
  if (/(frontend|ui|ux|design|a11y|accessibility|seo)/.test(hay)) return 'frontend';
  if (/(security|auth|vulnerability)/.test(hay)) return 'security';
  if (/(devops|ci|cd|docker|k8s|kubernetes)/.test(hay)) return 'devops';
  return 'general';
};

const ensureDir = (p) => {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
};

const safeSymlink = (target, link) => {
  if (fs.existsSync(link)) {
    const stat = fs.lstatSync(link);
    if (stat.isSymbolicLink()) {
      const existing = fs.readlinkSync(link);
      if (path.resolve(path.dirname(link), existing) === target) return { ok: true, changed: false };
      return { ok: false, reason: 'symlink_points_elsewhere' };
    }
    return { ok: false, reason: 'path_exists' };
  }
  fs.symlinkSync(target, link, 'dir');
  return { ok: true, changed: true };
};

const loadSkills = () => {
  const fromLock = readFile(LOCK_FILE);
  if (fromLock) {
    try {
      const parsed = JSON.parse(fromLock);
      return Object.keys(parsed.skills || {});
    } catch (_e) {
      // fallthrough
    }
  }
  if (!fs.existsSync(AGENTS_SKILLS)) return [];
  return fs.readdirSync(AGENTS_SKILLS).filter((d) => {
    const full = path.join(AGENTS_SKILLS, d);
    return fs.statSync(full).isDirectory();
  });
};

const main = () => {
  if (!fs.existsSync(AGENTS_SKILLS)) {
    console.error('[AUTOSKILLS] No .agents/skills directory found.');
    process.exit(1);
  }

  ensureDir(VENDOR_ROOT);

  const skills = loadSkills();
  const results = [];

  for (const skill of skills) {
    const sourceDir = path.join(AGENTS_SKILLS, skill);
    const skillFile = path.join(sourceDir, 'SKILL.md');
    const content = readFile(skillFile) || '';
    const meta = parseFrontmatter(content);
    const category = inferCategory({ name: meta.name || skill, description: meta.description });
    const targetDir = path.join(VENDOR_ROOT, category);
    ensureDir(targetDir);

    const linkPath = path.join(targetDir, skill);
    const res = safeSymlink(sourceDir, linkPath);
    results.push({ skill, category, ...res });
  }

  const okCount = results.filter(r => r.ok).length;
  const changed = results.filter(r => r.changed).length;
  const skipped = results.filter(r => !r.ok).length;

  console.log(`[AUTOSKILLS] Organized ${okCount} skills into ${VENDOR_ROOT}`);
  if (changed > 0) console.log(`[AUTOSKILLS] Created ${changed} new links`);
  if (skipped > 0) console.log(`[AUTOSKILLS] Skipped ${skipped} items (existing paths)`);
};

main();
