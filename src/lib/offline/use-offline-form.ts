"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { enqueueOp } from "./queue";
import { flushQueue } from "./sync";
import type { QueuedKind } from "./types";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * 包装快速记录表单：离线时把 FormData 存进 IndexedDB，联网后自动回放。
 * 返回的 action 可直接交给 <form action={...}>。
 */
export function useOfflineForm({
  kind,
  tripId,
  action,
  summarize,
  onDoneQueued,
  disabled,
}: {
  kind: QueuedKind;
  tripId: string;
  action: (fd: FormData) => void;
  summarize: (fd: FormData) => string;
  onDoneQueued?: () => void;
  /** 为 true 时不走离线队列（例如编辑已有记录） */
  disabled?: boolean;
}) {
  return useCallback(
    (fd: FormData) => {
      if (!disabled && typeof navigator !== "undefined" && !navigator.onLine) {
        const fields: Record<string, string> = {};
        fd.forEach((v, k) => {
          if (typeof v === "string") fields[k] = v;
        });
        void enqueueOp({ kind, tripId, fields, summary: summarize(fd) }).then(() => {
          toast.success("已离线保存，联网后自动同步");
          onDoneQueued?.();
        });
        return;
      }
      action(fd);
    },
    [kind, tripId, action, summarize, onDoneQueued, disabled]
  );
}

/** 联网时自动尝试回放一次 */
export function useAutoFlush(onDone?: (synced: number) => void) {
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const r = await flushQueue();
      if (!cancelled && r.synced > 0) onDone?.(r.synced);
      if (!cancelled && r.errors.length > 0) toast.error(r.errors[0]);
    };
    if (navigator.onLine) void run();
    window.addEventListener("online", run);
    return () => {
      cancelled = true;
      window.removeEventListener("online", run);
    };
  }, [onDone]);
}
