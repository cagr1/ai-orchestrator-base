const assert = require('assert');

const { recalculateTaskStates } = require('../runner.js');

console.log("Testing Phase 10: Recalculation Rule...");

// Test 1: Blocked → Pending when deps done
const tasks1 = [
  { id: "T1", estado: "done", depends_on: [] },
  { id: "T2", estado: "blocked", depends_on: ["T1"] }
];

recalculateTaskStates(tasks1);
assert(tasks1[1].estado === "pending", "T2 should become pending when T1 is done");
console.log("✓ Blocked → Pending when deps done");

// Test 2: Pending → Blocked when deps not done
const tasks2 = [
  { id: "T1", estado: "pending", depends_on: [] },
  { id: "T2", estado: "pending", depends_on: ["T1"] }
];

recalculateTaskStates(tasks2);
assert(tasks2[1].estado === "blocked", "T2 should become blocked when T1 is pending");
console.log("✓ Pending → Blocked when deps not done");

// Test 3: Done never changes
const tasks3 = [
  { id: "T1", estado: "done", depends_on: [] },
  { id: "T2", estado: "failed", depends_on: ["T1"] }
];

recalculateTaskStates(tasks3);
assert(tasks3[0].estado === "done", "done should stay done");
assert(tasks3[1].estado === "failed", "failed should stay failed");
console.log("✓ Done/Failed never change");

// Test 4: Complex dependency chain
const tasks4 = [
  { id: "T1", estado: "done", depends_on: [] },
  { id: "T2", estado: "done", depends_on: ["T1"] },
  { id: "T3", estado: "blocked", depends_on: ["T2"] },
  { id: "T4", estado: "blocked", depends_on: ["T2", "T3"] }
];

recalculateTaskStates(tasks4);
assert(tasks4[2].estado === "pending", "T3 should become pending (T2 done)");
// T4 still blocked because T3 is not done yet
assert(tasks4[3].estado === "blocked", "T4 should stay blocked (T3 not done)");
console.log("✓ Complex dependency chain works");

console.log("\n✅ Phase 10 tests passed");
