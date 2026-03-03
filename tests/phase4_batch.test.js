const assert = require('assert');

const {
  getExecutableTasks,
  selectBatchForExecution
} = require('../runner.js');

console.log("Testing Phase 4: Batch Selection...");

// Test 1: Dependencies respected
const tasks1 = [
  { id: "T1", estado: "done", depends_on: [], priority: 1 },
  { id: "T2", estado: "pending", depends_on: ["T1"], priority: 1 },
  { id: "T3", estado: "pending", depends_on: ["T2"], priority: 1 }
];

const batch1 = selectBatchForExecution(tasks1, 3);
assert(batch1.length === 1, "only T2 should be eligible");
assert(batch1[0].id === "T2", "T2 should be in batch");
console.log("✓ Dependencies respected");

// Test 2: max_batch_size respected
const tasks2 = [
  { id: "T1", estado: "done", depends_on: [], priority: 1 },
  { id: "T2", estado: "pending", depends_on: [], priority: 1 },
  { id: "T3", estado: "pending", depends_on: [], priority: 1 },
  { id: "T4", estado: "pending", depends_on: [], priority: 1 },
  { id: "T5", estado: "pending", depends_on: [], priority: 1 }
];

const batch2 = selectBatchForExecution(tasks2, 3);
assert(batch2.length === 3, "batch should respect max size");
console.log("✓ max_batch_size respected");

// Test 3: Deterministic ordering (Phase 15)
const tasks3 = [
  { id: "T3", estado: "pending", depends_on: [], priority: 2 },
  { id: "T1", estado: "pending", depends_on: [], priority: 2 },
  { id: "T2", estado: "pending", depends_on: [], priority: 2 }
];

const batch3a = selectBatchForExecution(tasks3, 3);
const batch3b = selectBatchForExecution(tasks3, 3);

const ids1 = batch3a.map(t => t.id).join(",");
const ids2 = batch3b.map(t => t.id).join(",");

assert(ids1 === ids2, `Non-deterministic: ${ids1} vs ${ids2}`);
assert(ids1 === "T1,T2,T3", `Expected T1,T2,T3 got ${ids1}`);
console.log("✓ Deterministic ordering works");

// Test 4: Parallel tasks (same priority, no deps)
const tasks4 = [
  { id: "T1", estado: "done", depends_on: [], priority: 1 },
  { id: "T2", estado: "pending", depends_on: ["T1"], priority: 2 },
  { id: "T3", estado: "pending", depends_on: ["T1"], priority: 2 }
];

const batch4 = selectBatchForExecution(tasks4, 3);
assert(batch4.length === 2, "T2 and T3 should both be eligible");
assert(batch4.some(t => t.id === "T2"), "T2 should be in batch");
assert(batch4.some(t => t.id === "T3"), "T3 should be in batch");
console.log("✓ Parallel batch selection works");

console.log("\n✅ Phase 4 tests passed");
