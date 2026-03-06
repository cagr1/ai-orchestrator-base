const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Import functions from runner
const runnerPath = path.join(__dirname, '..', 'runner.js');
const {
  getMemoryConfig,
  countMemoryEntries,
  shouldCompactMemory,
  performMemoryCompaction,
  appendToMemoryWithCompaction
} = require(runnerPath);

console.log("Testing Phase 5B: Memory Compaction (Mejora 3)...");

// Backup and restore memory file
const MEMORY_FILE = path.join(__dirname, '..', 'system', 'memory.md');
const BACKUP_FILE = path.join(__dirname, '..', 'system', 'memory.backup.md');

const backupMemory = () => {
  if (fs.existsSync(MEMORY_FILE)) {
    fs.copyFileSync(MEMORY_FILE, BACKUP_FILE);
  }
};

const restoreMemory = () => {
  if (fs.existsSync(BACKUP_FILE)) {
    fs.copyFileSync(BACKUP_FILE, MEMORY_FILE);
    fs.unlinkSync(BACKUP_FILE);
  }
};

// Test 1: getMemoryConfig
console.log("\n--- Test 1: getMemoryConfig ---");
const config = getMemoryConfig();
assert(config !== undefined, "Config should be defined");
assert(config.max_entries === 20, "Default max_entries should be 20");
assert(config.enable_compaction === true, "Default enable_compaction should be true");
console.log("✓ getMemoryConfig returns correct defaults");

// Test 2: countMemoryEntries - empty content
console.log("\n--- Test 2: countMemoryEntries - empty ---");
backupMemory();

try {
  fs.writeFileSync(MEMORY_FILE, "# Memory Log\n\n", 'utf-8');
  const countEmpty = countMemoryEntries();
  assert(countEmpty === 0, "Empty memory should have 0 entries");
  console.log("✓ countMemoryEntries handles empty content");
} finally {
  restoreMemory();
}

// Test 3: countMemoryEntries - with content
console.log("\n--- Test 3: countMemoryEntries - with content ---");
backupMemory();

try {
  const testContent = "# Memory Log\n\n## Entry 1\n- Task: T1\n\n## Entry 2\n- Task: T2\n\n";
  fs.writeFileSync(MEMORY_FILE, testContent, 'utf-8');
  const count = countMemoryEntries();
  assert(count === 2, "Memory with 2 entries should count as 2");
  console.log("✓ countMemoryEntries counts correctly");
} finally {
  restoreMemory();
}

// Test 4: shouldCompactMemory - below threshold
console.log("\n--- Test 4: shouldCompactMemory - below threshold ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 10; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  const result = shouldCompactMemory();
  assert(result === false, "Should not compact when below threshold");
  console.log("✓ shouldCompactMemory returns false below threshold");
} finally {
  restoreMemory();
}

// Test 5: shouldCompactMemory - at threshold
console.log("\n--- Test 5: shouldCompactMemory - at threshold ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 20; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  const result = shouldCompactMemory();
  assert(result === true, "Should compact when at or above threshold");
  console.log("✓ shouldCompactMemory returns true at threshold");
} finally {
  restoreMemory();
}

// Test 6: shouldCompactMemory - above threshold
console.log("\n--- Test 6: shouldCompactMemory - above threshold ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 25; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  const result = shouldCompactMemory();
  assert(result === true, "Should compact when above threshold");
  console.log("✓ shouldCompactMemory returns true above threshold");
} finally {
  restoreMemory();
}

// Test 7: performMemoryCompaction - below threshold
console.log("\n--- Test 7: performMemoryCompaction - below threshold ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 5; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  performMemoryCompaction();
  const afterContent = fs.readFileSync(MEMORY_FILE, 'utf-8');
  const count = countMemoryEntries();
  assert(count === 5, "Should keep all entries when below threshold");
  console.log("✓ performMemoryCompaction skips when below threshold");
} finally {
  restoreMemory();
}

// Test 8: performMemoryCompaction - above threshold
console.log("\n--- Test 8: performMemoryCompaction - above threshold ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 25; i++) {
    content += "## Entry " + i + "\n- Task completed: T" + i + "\n- Decision: Test decision " + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  performMemoryCompaction();
  const afterContent = fs.readFileSync(MEMORY_FILE, 'utf-8');
  const count = countMemoryEntries();
  assert(count <= 20, "Should reduce to max_entries or less after compaction");
  console.log("✓ performMemoryCompaction reduces entries above threshold");
} finally {
  restoreMemory();
}

// Test 9: Compaction preserves summary
console.log("\n--- Test 9: Compaction preserves summary ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 25; i++) {
    content += "## Entry " + i + "\n- Task completed: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  performMemoryCompaction();
  const afterContent = fs.readFileSync(MEMORY_FILE, 'utf-8');
  const hasSummary = afterContent.includes("Historical Summary");
  assert(hasSummary === true, "Compacted memory should include summary");
  console.log("✓ Compaction includes historical summary");
} finally {
  restoreMemory();
}

// Test 10: appendToMemoryWithCompaction adds entry
console.log("\n--- Test 10: appendToMemoryWithCompaction adds entry ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 5; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  appendToMemoryWithCompaction("## Entry 6\n- Task: T6\n");
  const count = countMemoryEntries();
  assert(count === 6, "Should have 6 entries after append");
  console.log("✓ appendToMemoryWithCompaction adds entry without compaction");
} finally {
  restoreMemory();
}

// Test 11: appendToMemoryWithCompaction triggers compaction
console.log("\n--- Test 11: appendToMemoryWithCompaction triggers compaction ---");
backupMemory();

try {
  let content = "# Memory Log\n\n";
  for (let i = 1; i <= 19; i++) {
    content += "## Entry " + i + "\n- Task: T" + i + "\n\n";
  }
  fs.writeFileSync(MEMORY_FILE, content, 'utf-8');
  appendToMemoryWithCompaction("## Entry 20\n- Task: T20\n");
  appendToMemoryWithCompaction("## Entry 21\n- Task: T21\n");
  const count = countMemoryEntries();
  assert(count <= 20, "Should compact after adding entries over threshold");
  console.log("✓ appendToMemoryWithCompaction triggers compaction when needed");
} finally {
  restoreMemory();
}

console.log("\n✅ Phase 5B (Memory Compaction) tests passed");
