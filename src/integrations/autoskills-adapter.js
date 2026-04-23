const { execSync } = require('child_process');
const path = require('path');
const { normalizeSkillsDirectory } = require('./skill-manager');

const buildArgs = ({ dryRun, yes, agent, verbose }) => {
  const args = ['autoskills'];
  if (dryRun) args.push('--dry-run');
  if (yes) args.push('-y');
  if (agent) args.push('-a', agent);
  if (verbose) args.push('-v');
  return args;
};

const parseSuggestions = (output) => {
  const lines = String(output || '').split('\n');
  const suggestions = [];
  for (const line of lines) {
    const match = line.match(/^\s*\d+\.\s+([^›]+)›\s+([^\s]+)(?:\s+\(installed\))?\s*(?:←\s*(.+))?$/);
    if (match) {
      const owner = match[1].trim();
      const skill = match[2].trim();
      const hint = (match[3] || '').trim();
      suggestions.push({ source: owner, skill, hint });
    }
  }
  return suggestions;
};

const runAutoskills = ({ cwd, dryRun = true, yes = false, agent, verbose = false }) => {
  const args = buildArgs({ dryRun, yes, agent, verbose });
  const cmd = `npx ${args.join(' ')}`;
  try {
    const output = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, output, suggestions: parseSuggestions(output) };
  } catch (err) {
    const stdout = err?.stdout ? String(err.stdout) : '';
    const stderr = err?.stderr ? String(err.stderr) : '';
    const output = `${stdout}${stderr}`.trim() || String(err);
    return { ok: false, output, suggestions: parseSuggestions(output) };
  }
};

const normalizeVendorSkills = (cwd) => {
  const vendorDir = path.join(cwd, 'skills', 'vendor');
  const result = normalizeSkillsDirectory(vendorDir);
  console.log(`[SKILLS] Normalized ${result.normalized} vendor skills, renamed ${result.renamed} files`);
  return result;
};

module.exports = { runAutoskills, parseSuggestions, normalizeVendorSkills };
