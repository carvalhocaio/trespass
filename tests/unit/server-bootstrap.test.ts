import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ENV } from "../helpers/env-mock";

// Capture the process-level handlers registered at module load without
// registering them for real, so we can invoke their bodies directly.
const h = vi.hoisted(() => ({
  handlers: {} as Record<string, (...a: unknown[]) => unknown>,
  logger: { error: vi.fn(), fatal: vi.fn() },
}));

vi.mock("@trespass/auth", () => ({ auth: { handler: vi.fn() } }));
vi.mock("@trespass/env/server", () => ({ env: TEST_ENV }));
vi.mock("@server/lib/logger", () => ({ logger: h.logger }));

describe("server bootstrap", () => {
  let onSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    h.handlers = {};
    h.logger.error.mockReset();
    h.logger.fatal.mockReset();
    vi.resetModules();
    onSpy = vi.spyOn(process, "on").mockImplementation(((
      event: string,
      cb: (...a: unknown[]) => void
    ) => {
      h.handlers[event] = cb;
      return process;
    }) as never);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    onSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("logs unhandledRejection reasons", async () => {
    await import("@server/index");

    h.handlers.unhandledRejection?.("boom");

    expect(h.logger.error).toHaveBeenCalledWith(
      { reason: "boom" },
      "unhandledRejection"
    );
  });

  it("fatally logs and exits on uncaughtException", async () => {
    await import("@server/index");

    const err = new Error("fatal");
    h.handlers.uncaughtException?.(err);

    expect(h.logger.fatal).toHaveBeenCalledWith({ err }, "uncaughtException");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
