import { toast } from "vue-sonner";

export function useNotification() {
  const supported = import.meta.client && "Notification" in window;

  async function requestPermission(): Promise<void> {
    if (!supported || Notification.permission !== "default") {
      return;
    }
    await Notification.requestPermission();
  }

  function notify(title: string, body: string, onClick?: () => void): void {
    if (supported && Notification.permission === "granted") {
      const n = new Notification(title, { body, icon: "/favicon.ico" });
      if (onClick) {
        n.onclick = () => {
          window.focus();
          onClick();
        };
      }
    } else {
      toast(title, { description: body });
    }
  }

  return { requestPermission, notify };
}
