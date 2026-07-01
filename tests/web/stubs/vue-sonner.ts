// Local stub for vue-sonner (a dependency of apps/web that is not resolvable
// from the tests workspace). Records calls on a global array the tests inspect.
interface ToastCall {
  options?: unknown;
  title: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __toastCalls: ToastCall[] | undefined;
}

export function toast(title: string, options?: unknown): void {
  if (!globalThis.__toastCalls) {
    globalThis.__toastCalls = [];
  }
  globalThis.__toastCalls.push({ title, options });
}
