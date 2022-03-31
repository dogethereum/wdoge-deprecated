import hre from "hardhat";



/**
 * These isolation hooks can be used in conjunction.
 */

/**
 * Isolates blockchain side effects from an entire mocha test suite.
 * This means that other test suites won't be able to observe transactions from this test suite.
 * Tests within the same test suite are not isolated from each other.
 * Use isolateEachTest() to do so.
 */
export function isolateTests(): void {
  isolate(before, after);
}

/**
 * Isolates blockchain side effects for each test within a test suite.
 * Does not isolate the test suite itself from another test suite.
 * Use isolateTests() for that.
 */
export function isolateEachTest(): void {
  isolate(beforeEach, afterEach);
}

function isolate(
  preHook: Mocha.HookFunction,
  postHook: Mocha.HookFunction
): void {
  // We want to use the snapshot value without specifying its type.
  let snapshot: unknown;

  preHook(async function () {
    snapshot = await hre.network.provider.request({
      method: "evm_snapshot",
      params: [],
    });
  });

  // TODO: allow defining test suites here?
  // It would ensure proper nesting of other `before` and `after` mocha directives

  postHook(async function () {
    await hre.network.provider.request({
      method: "evm_revert",
      params: [snapshot],
    });
  });
}