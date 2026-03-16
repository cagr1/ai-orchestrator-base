console.log("=== Running All Tests ===\n");

try {
  require('./phase1_state.test');
  require('./phase4_batch.test');
  require('./phase10_recalc.test');
  require('./phase11-14_validation.test');
  require('./phase15-17_final.test');
  require('./phase18_simulation.test');
  require('./phase_attempts.test');
  require('./phase_memory_compaction.test');
  require('./phase_corrective_tasks.test');
  require('./phase_cli_commands.test');
  require('./phase_sdd_flow.test');
  require('./phase_skill_hygiene.test');
  require('./phase_tasks_lock.test');
  
  console.log("\n=== ALL TESTS PASSED ===");
  process.exit(0);
} catch (e) {
  console.error("\n=== TEST FAILED ===");
  console.error(e.message);
  console.error(e.stack);
  process.exit(1);
}
