/**
 * Phase Skill Hygiene Test (Mejora 4)
 * 
 * Tests for skill size limits, policy documentation, and modularization.
 * Focus areas:
 * - Skill line count limits (60-120 ideal, 150 max)
 * - Policy documentation in SKILL_EVOLUTION.md
 * - Sub-skill coherence and references
 */

const fs = require('fs');
const path = require('path');

// Helper: Count lines in a file
function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').length;
}

// Helper: Check if file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Helper: Read file content
function readFile(filePath) {
  return fs.readFileSync(filePath, 'utf-8');
}

const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const SYSTEM_DIR = path.join(__dirname, '..', 'system');

// Policy constants from SKILL_EVOLUTION.md
const MAX_SKILL_LINES = 150;
const IDEAL_MIN_LINES = 60;
const IDEAL_MAX_LINES = 120;

console.log('=== Phase Skill Hygiene Tests (Mejora 4) ===\n');

// Test 1: Policy exists in SKILL_EVOLUTION.md
console.log('Test 1: Policy documented in SKILL_EVOLUTION.md');
const evolutionPath = path.join(SYSTEM_DIR, 'SKILL_EVOLUTION.md');
if (!fileExists(evolutionPath)) {
  console.error('  FAIL: SKILL_EVOLUTION.md not found');
  process.exit(1);
}

const evolutionContent = readFile(evolutionPath);
const hasPolicy = evolutionContent.includes('Skill Hygiene Policy') && 
                 evolutionContent.includes('60-120') && 
                 evolutionContent.includes('150');
if (!hasPolicy) {
  console.error('  FAIL: Skill size policy not documented');
  process.exit(1);
}
console.log('  PASS: Skill hygiene policy documented\n');

// Test 2: Original design-taste.md still exists
console.log('Test 2: Original design-taste.md exists');
const originalPath = path.join(SKILLS_DIR, 'frontend', 'design-taste.md');
if (!fileExists(originalPath)) {
  console.error('  FAIL: design-taste.md not found');
  process.exit(1);
}
console.log('  PASS: Original skill file exists\n');

// Test 3: Original skill references sub-skills
console.log('Test 3: Original skill references sub-skills');
const originalContent = readFile(originalPath);
const hasReferences = originalContent.includes('design-taste-config.md') &&
                      originalContent.includes('design-taste-engineering.md') &&
                      originalContent.includes('design-taste-anti-slop.md') &&
                      originalContent.includes('design-taste-creative.md') &&
                      originalContent.includes('design-taste-checklist.md');
if (!hasReferences) {
  console.error('  FAIL: Original skill missing sub-skill references');
  process.exit(1);
}
console.log('  PASS: Original skill references all sub-skills\n');

// Test 4: All sub-skills exist
console.log('Test 4: All sub-skills exist');
const subSkills = [
  'frontend/design-taste-config.md',
  'frontend/design-taste-engineering.md',
  'frontend/design-taste-anti-slop.md',
  'frontend/design-taste-creative.md',
  'frontend/design-taste-checklist.md'
];

for (const subSkill of subSkills) {
  const subPath = path.join(SKILLS_DIR, subSkill);
  if (!fileExists(subPath)) {
    console.error(`  FAIL: ${subSkill} not found`);
    process.exit(1);
  }
}
console.log('  PASS: All sub-skills exist\n');

// Test 5: All sub-skills within size limits
console.log('Test 5: Sub-skills within size limits (max 150 lines)');
for (const subSkill of subSkills) {
  const subPath = path.join(SKILLS_DIR, subSkill);
  const lineCount = countLines(subPath);
  if (lineCount > MAX_SKILL_LINES) {
    console.error(`  FAIL: ${subSkill} has ${lineCount} lines (max: ${MAX_SKILL_LINES})`);
    process.exit(1);
  }
  console.log(`  PASS: ${subSkill} - ${lineCount} lines (max: ${MAX_SKILL_LINES})`);
}
console.log();

// Test 6: Sub-skills in ideal range
console.log('Test 6: Sub-skills in ideal range (60-120 lines)');
const idealRangePassed = subSkills.every(subSkill => {
  const subPath = path.join(SKILLS_DIR, subSkill);
  const lineCount = countLines(subPath);
  return lineCount >= IDEAL_MIN_LINES && lineCount <= IDEAL_MAX_LINES;
});
if (idealRangePassed) {
  console.log('  PASS: All sub-skills in ideal range (60-120 lines)\n');
} else {
  console.log('  Note: Some sub-skills outside ideal range (acceptable if coherent)\n');
}

// Test 7: Sub-skills have frontmatter with name and description
console.log('Test 7: Sub-skills have valid frontmatter');
for (const subSkill of subSkills) {
  const subPath = path.join(SKILLS_DIR, subSkill);
  const content = readFile(subPath);
  const hasFrontmatter = content.startsWith('---') && 
                        content.includes('name:') && 
                        content.includes('description:');
  if (!hasFrontmatter) {
    console.error(`  FAIL: ${subSkill} missing valid frontmatter`);
    process.exit(1);
  }
}
console.log('  PASS: All sub-skills have valid frontmatter\n');

// Test 8: Sub-skills have coherent content
console.log('Test 8: Sub-skills have coherent content');
const coherenceChecks = {
  'design-taste-config.md': ['BASELINE CONFIGURATION', 'ARCHITECTURE'],
  'design-taste-engineering.md': ['DESIGN ENGINEERING', 'PERFORMANCE'],
  'design-taste-anti-slop.md': ['Forbidden', 'BANNED'],
  'design-taste-creative.md': ['Hero', 'Bento'],
  'design-taste-checklist.md': ['Checklist', 'pre-flight']
};

for (const [file, keywords] of Object.entries(coherenceChecks)) {
  const subPath = path.join(SKILLS_DIR, 'frontend', file);
  const content = readFile(subPath);
  const hasKeywords = keywords.some(kw => content.includes(kw));
  if (!hasKeywords) {
    console.error(`  FAIL: ${file} missing expected keywords: ${keywords.join(', ')}`);
    process.exit(1);
  }
}
console.log('  PASS: Sub-skills have coherent content\n');

// Test 9: Content distributed across sub-skills
console.log('Test 9: Content distributed across sub-skills');
const originalLineCount = countLines(originalPath);
let totalSubSkillLines = 0;
for (const subSkill of subSkills) {
  totalSubSkillLines += countLines(path.join(SKILLS_DIR, subSkill));
}

// Total content should be significant (original + sub-skills)
if (totalSubSkillLines < 200) {
  console.error(`  FAIL: Sub-skills total only ${totalSubSkillLines} lines (expected significant content)`);
  process.exit(1);
}
console.log(`  PASS: Content distributed - Original: ${originalLineCount} lines, Sub-skills: ${totalSubSkillLines} lines\n`);

// Test 10: Split maintains backward compatibility
console.log('Test 10: Split maintains backward compatibility');
const stillHasMainContent = originalContent.includes('DESIGN_VARIANCE') || 
                            originalContent.includes('Rule 1:');
if (!stillHasMainContent) {
  console.error('  FAIL: Original skill missing main content references');
  process.exit(1);
}
console.log('  PASS: Backward compatibility maintained\n');

console.log('=== ALL SKILL HYGIENE TESTS PASSED ===');
