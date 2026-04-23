const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  auditSkillsDirectory,
  normalizeSkillsDirectory
} = require('../src/integrations/skill-manager');

console.log('Testing Phase Skill Import...');

(function testNormalizeSkillsDirectoryRenamesVendorFilesWithoutExtension() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-import-'));
  const vendorDir = path.join(tmpDir, 'vendor', 'frontend');
  fs.mkdirSync(vendorDir, { recursive: true });
  const legacyFile = path.join(vendorDir, 'frontend-design');

  try {
    fs.writeFileSync(legacyFile, 'Make the UI feel premium.\n', 'utf-8');
    const result = normalizeSkillsDirectory(path.join(tmpDir, 'vendor'));
    const normalizedFile = `${legacyFile}.md`;
    const content = fs.readFileSync(normalizedFile, 'utf-8');

    assert(result.renamed === 1, 'Expected one extensionless vendor file to be renamed');
    assert(result.normalized === 1, 'Expected renamed file to be normalized');
    assert(fs.existsSync(normalizedFile), 'Expected renamed markdown file to exist');
    assert(content.includes('name: frontend-design'), 'Expected inferred skill name in frontmatter');
    assert(content.includes('## Constraints'), 'Expected Constraints section after normalization');
    assert(content.includes('## Output bounds'), 'Expected Output bounds section after normalization');
    console.log('✓ normalizeSkillsDirectory renames and normalizes vendor files');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

(function testNormalizeSkillsDirectoryMaterializesSkillWrappers() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-import-'));
  const skillDir = path.join(tmpDir, 'vendor', 'backend', 'nodejs-best-practices');
  fs.mkdirSync(skillDir, { recursive: true });

  try {
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), 'Ship maintainable backend patterns.\n', 'utf-8');
    const result = normalizeSkillsDirectory(path.join(tmpDir, 'vendor'));
    const wrapperFile = `${skillDir}.md`;
    const content = fs.readFileSync(wrapperFile, 'utf-8');

    assert(result.materialized === 1, 'Expected one wrapper file to be materialized from SKILL.md');
    assert(content.includes('name: nodejs-best-practices'), 'Expected wrapper to infer filename as skill name');
    assert(content.includes('## Constraints'), 'Expected wrapper to include Constraints section');
    assert(content.includes('## Output bounds'), 'Expected wrapper to include Output bounds section');
    console.log('✓ normalizeSkillsDirectory materializes wrapper files from SKILL.md sources');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();

(function testAuditSkillsDirectoryReportsSchemaProblems() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skill-import-'));
  fs.mkdirSync(path.join(tmpDir, 'frontend'), { recursive: true });

  try {
    fs.writeFileSync(path.join(tmpDir, 'frontend', 'valid.md'), [
      '---',
      'name: valid',
      'description: A valid skill',
      'output_contract: none',
      '---',
      '',
      '## Constraints',
      '',
      '## Output bounds',
      ''
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'frontend', 'missing-contract.md'), [
      '---',
      'name: missing-contract',
      'description: Missing contract',
      '---',
      '',
      'Body'
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'frontend', 'no-frontmatter.md'), 'Just content.\n', 'utf-8');

    const audits = auditSkillsDirectory(tmpDir);
    const byPath = Object.fromEntries(audits.map((item) => [item.filePath, item]));

    assert(byPath['frontend/valid.md']?.status === 'valid', 'Expected valid skill to pass audit');
    assert(byPath['frontend/missing-contract.md']?.message === 'missing output_contract', 'Expected missing output_contract warning');
    assert(byPath['frontend/no-frontmatter.md']?.message === 'no frontmatter', 'Expected missing frontmatter error');
    console.log('✓ auditSkillsDirectory reports valid, warning, and error states');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
})();
