console.log("=== Running All Tests ===\n");

try {
  require('./phase1_state.test');
  require('./phase4_batch.test');
  require('./phase10_recalc.test');
  require('./phase11-14_validation.test');
  require('./phase15-17_final.test');
  
  console.log("\n=== ALL TESTS PASSED ===");
  process.exit(0);
} catch (e) {
  console.error("\n=== TEST FAILED ===");
  console.error(e.message);
  console.error(e.stack);
  process.exit(1);
}
