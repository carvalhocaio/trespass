import { vi } from "vitest";

/**
 * A configurable Drizzle mock for route/service tests.
 *
 * Unlike the always-empty chain in functional/routes.test.ts, this lets each
 * test queue the rows that successive queries should resolve to:
 *
 *   const { db, queueSelect, queueReturning } = makeDbMock();
 *   queueSelect([{ id: "repo-1" }]);   // first db.select(...) resolves to this
 *   queueReturning([{ id: "scan-1" }]); // first .returning() resolves to this
 *
 * Every builder method (`from`, `where`, `leftJoin`, `orderBy`, `limit`) is a
 * spy returning the same thenable chain, so any select shape is awaitable.
 * Writes (`insert().values()`, `update().set().where()`) are awaitable too and
 * expose `.returning()` / `.onConflictDoUpdate()`.
 */
export function makeDbMock() {
  const selectQueue: unknown[][] = [];
  const returningQueue: unknown[][] = [];

  const nextSelect = () => selectQueue.shift() ?? [];
  const nextReturning = () => returningQueue.shift() ?? [];

  function selectChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const m of ["from", "where", "leftJoin", "orderBy", "limit"]) {
      chain[m] = vi.fn(self);
    }
    const resolved = Promise.resolve().then(nextSelect);
    // biome-ignore lint/suspicious/noThenProperty: intentional thenable chain
    chain.then = resolved.then.bind(resolved);
    return chain;
  }

  function writeTerminal(): Record<string, unknown> {
    const resolved = Promise.resolve(undefined);
    return {
      // biome-ignore lint/suspicious/noThenProperty: awaitable write result
      then: resolved.then.bind(resolved),
      returning: vi.fn(() => Promise.resolve(nextReturning())),
      onConflictDoUpdate: vi.fn(() => Promise.resolve(undefined)),
    };
  }

  const db = {
    select: vi.fn(() => selectChain()),
    insert: vi.fn(() => ({ values: vi.fn(() => writeTerminal()) })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => writeTerminal()) })),
    })),
  };

  return {
    db,
    queueSelect: (rows: unknown[]) => selectQueue.push(rows),
    queueReturning: (rows: unknown[]) => returningQueue.push(rows),
  };
}
