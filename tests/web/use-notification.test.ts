import { useNotification } from "@web/composables/use-notification";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

interface ToastCall {
  options?: unknown;
  title: string;
}
type MutableGlobal = typeof globalThis & {
  __NUXT_CLIENT__?: boolean;
  __toastCalls?: ToastCall[];
};
const g = globalThis as MutableGlobal;

class FakeNotification {
  static permission: NotificationPermission = "default";
  static requestPermission = vi.fn().mockResolvedValue("granted");
  static last: FakeNotification | null = null;
  onclick: (() => void) | null = null;
  title: string;
  options?: NotificationOptions;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    FakeNotification.last = this;
  }
}

beforeEach(() => {
  g.__toastCalls = [];
  FakeNotification.requestPermission.mockClear();
  FakeNotification.permission = "default";
  FakeNotification.last = null;
  g.__NUXT_CLIENT__ = true;
  (window as unknown as { Notification: unknown }).Notification =
    FakeNotification;
  (globalThis as unknown as { Notification: unknown }).Notification =
    FakeNotification;
});

afterEach(() => {
  (window as unknown as { Notification?: unknown }).Notification = undefined;
  g.__NUXT_CLIENT__ = false;
});

describe("useNotification.requestPermission", () => {
  it("requests permission when supported and still default", async () => {
    await useNotification().requestPermission();
    expect(FakeNotification.requestPermission).toHaveBeenCalled();
  });

  it("no-ops when permission is already decided", async () => {
    FakeNotification.permission = "granted";
    await useNotification().requestPermission();
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });

  it("no-ops on the server (not supported)", async () => {
    g.__NUXT_CLIENT__ = false;
    await useNotification().requestPermission();
    expect(FakeNotification.requestPermission).not.toHaveBeenCalled();
  });
});

describe("useNotification.notify", () => {
  it("shows a native notification when permission is granted", () => {
    FakeNotification.permission = "granted";
    const onClick = vi.fn();
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {
      // noop
    });

    useNotification().notify("Title", "Body", onClick);

    const instance = FakeNotification.last;
    expect(instance).toBeDefined();
    instance?.onclick?.();
    expect(focus).toHaveBeenCalled();
    expect(onClick).toHaveBeenCalled();
    expect(g.__toastCalls).toHaveLength(0);
  });

  it("skips wiring onclick when no handler is passed", () => {
    FakeNotification.permission = "granted";
    useNotification().notify("Title", "Body");
    expect(FakeNotification.last?.onclick).toBeNull();
  });

  it("falls back to a toast when permission is not granted", () => {
    FakeNotification.permission = "denied";
    useNotification().notify("Title", "Body");
    expect(g.__toastCalls).toEqual([
      { title: "Title", options: { description: "Body" } },
    ]);
  });

  it("falls back to a toast on the server", () => {
    g.__NUXT_CLIENT__ = false;
    useNotification().notify("Title", "Body");
    expect(g.__toastCalls).toHaveLength(1);
  });
});
