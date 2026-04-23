const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildExecutionPrompt } = require('../runner');
const { normalizeSkillFile } = require('../src/integrations/skill-manager');

console.log('Testing Phase Skill Injection...');

(function testBuildExecutionPromptInjectsSkillGuidelines() {
  const skillFile = path.join(__dirname, '..', 'skills', 'frontend-html-basic.md');
  const backup = fs.readFileSync(skillFile, 'utf-8');

  try {
    fs.writeFileSync(
      skillFile,
      [
        '---',
        'name: frontend-html-basic',
        'description: Mock frontend skill',
        'output_contract: json_files',
        'max_lines_per_file: 100',
        '---',
        '',
        '## Constraints',
        '- MOCK_CONSTRAINT: keep markup semantic.',
        '',
        '## Output bounds',
        '- MOCK_BOUND: keep CSS under 100 lines.',
        ''
      ].join('\n'),
      'utf-8'
    );

    const prompt = buildExecutionPrompt({
      id: 'TMOCK',
      title: 'Create landing page shell',
      description: 'Generate initial HTML shell',
      skill: 'frontend-html-basic',
      input: [],
      output: ['index.html']
    });

    assert(prompt.includes('--- SKILL GUIDELINES (frontend-html-basic) ---'), 'Expected skill guidelines banner');
    assert(prompt.includes('MOCK_CONSTRAINT: keep markup semantic.'), 'Expected constraints to be injected');
    assert(prompt.includes('MOCK_BOUND: keep CSS under 100 lines.'), 'Expected output bounds to be injected');
    console.log('✓ buildExecutionPrompt injects skill guidelines');
  } finally {
    fs.writeFileSync(skillFile, backup, 'utf-8');
  }
})();

(function testBuildExecutionPromptWarnsOnMissingSkill() {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (msg) => warnings.push(String(msg));

  try {
    const prompt = buildExecutionPrompt({
      id: 'TMISS',
      title: 'Missing skill case',
      description: 'No skill file should be found',
      skill: 'missing-skill-for-test',
      input: [],
      output: ['index.html']
    });

    assert(typeof prompt === 'string' && prompt.length > 0, 'Prompt should still be returned');
    assert(
      warnings.some((msg) => msg.includes('[WARN] Skill file not found for "missing-skill-for-test"')),
      'Expected warning for missing skill file'
    );
    console.log('✓ Missing skill files warn without throwing');
  } finally {
    console.warn = originalWarn;
  }
})();

(function testNormalizeSkillFileAddsFrontmatter() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-normalize-'));
  const tmpFile = path.join(tmpDir, 'frontend-html-basic.md');

  try {
    fs.writeFileSync(tmpFile, 'Generate HTML only.\nKeep CSS under 100 lines.\n', 'utf-8');
    const result = normalizeSkillFile(tmpFile);
    const content = fs.readFileSync(tmpFile, 'utf-8');

    assert(result.changed === true, 'Expected normalizeSkillFile to modify file without frontmatter');
    assert(content.startsWith('---\nname: frontend-html-basic\n'), 'Expected normalized frontmatter');
    assert(content.includes('output_contract: json_files'), 'Expected output contract field');
    assert(content.includes('max_lines_per_file: 100'), 'Expected max_lines_per_file field');
    assert(content.includes('Generate HTML only.'), 'Expected original body to remain');
    console.log('✓ normalizeSkillFile adds frontmatter when missing');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

(function testNormalizeSkillFileDoesNotOverwriteValidFrontmatter() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-normalize-'));
  const tmpFile = path.join(tmpDir, 'custom-skill.md');
  const original = [
    '---',
    'name: custom-skill',
    'description: Existing valid frontmatter',
    'output_contract: markdown',
    '---',
    '',
    'Body content.',
    ''
  ].join('\n');

  try {
    fs.writeFileSync(tmpFile, original, 'utf-8');
    const result = normalizeSkillFile(tmpFile);
    const content = fs.readFileSync(tmpFile, 'utf-8');

    assert(result.changed === false, 'Expected valid frontmatter to remain unchanged');
    assert.strictEqual(content, original, 'Expected file content to remain untouched');
    console.log('✓ normalizeSkillFile preserves valid frontmatter');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
