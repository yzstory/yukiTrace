"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

/** base64url 的 VAPID 公钥转成 Uint8Array */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * 订阅状态放在组件外的小 store 里，用 useSyncExternalStore 读取。
 * 这样不需要在 effect 里 setState（React Compiler 会告警），也天然处理 SSR。
 */
const pushStore = {
  state: { supported: true, enabled: false } as { supported: boolean; enabled: boolean },
  listeners: new Set<() => void>(),
  loaded: false,
  subscribe(fn: () => void) {
    pushStore.listeners.add(fn);
    if (!pushStore.loaded) {
      pushStore.loaded = true;
      void pushStore.refresh();
    }
    return () => pushStore.listeners.delete(fn);
  },
  get: () => pushStore.state,
  getServer: () => SERVER_STATE,
  set(next: Partial<{ supported: boolean; enabled: boolean }>) {
    pushStore.state = { ...pushStore.state, ...next };
    pushStore.listeners.forEach((l) => l());
  },
  async refresh() {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      pushStore.set({ supported: false });
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    pushStore.set({ supported: true, enabled: Boolean(sub) });
  },
};
const SERVER_STATE = { supported: true, enabled: false };

export function PushToggle({ publicKey }: { publicKey: string }) {
  const { supported, enabled } = useSyncExternalStore(pushStore.subscribe, pushStore.get, pushStore.getServer);
  const [busy, setBusy] = useState(false);
  const sync = useCallback(() => pushStore.refresh(), []);

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      if (next) {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          toast.error("通知权限被拒绝，可在系统设置里开启");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
        const res = await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub.toJSON()),
        });
        if (!res.ok) throw new Error("订阅失败");
        pushStore.set({ enabled: true });
        toast.success("已开启：早晚各一条，宝宝作息也会提醒");
      } else {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        pushStore.set({ enabled: false });
        toast.success("已关闭提醒");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
      void sync();
    }
  }

  if (!supported) {
    return (
      <p className="flex items-center gap-2 px-4 py-3 text-subhead text-muted-foreground">
        <BellOff className="size-4" /> 当前浏览器不支持通知。iPhone 需先「添加到主屏幕」。
      </p>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Bell className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1">
        <span className="block text-callout">每日简报与作息提醒</span>
        <span className="block text-caption text-muted-foreground">早上说今天去哪，晚上提醒写日记</span>
      </span>
      {busy ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : <Switch checked={enabled} onCheckedChange={toggle} />}
    </div>
  );
}
