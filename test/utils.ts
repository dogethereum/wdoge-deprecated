import type { ContractTransaction, ContractReceipt, Event } from "ethers";
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

function isolate(preHook: Mocha.HookFunction, postHook: Mocha.HookFunction): void {
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

export async function expectFailure(
  f: () => Promise<unknown>,
  handle: (error: Error) => void
): Promise<void> {
  let result;
  try {
    result = await f();
  } catch (error) {
    if (error instanceof Error) {
      // In most cases the handler won't return a promise, but just in case.
      try {
        await handle(error);
      } catch (assertion) {
        throw new Error(`${assertion}
Original error: ${error.stack || error}`);
      }
      return;
    }

    throw error;
  }

  throw new Error(`Did not fail. Result: ${result}`);
}

export function filterEvents(events: ContractReceipt["events"], name: string): Event[] {
  if (events === undefined) {
    throw new Error("No events found on receipt!");
  }
  return events.filter(({ event }) => event === name);
}

export async function getEvents(
  tx: ContractTransaction,
  eventName: string
): Promise<{ receipt: ContractReceipt; events: Event[] }> {
  const receipt = await tx.wait();
  const events = filterEvents(receipt.events, eventName);
  return { receipt, events: events };
}
