"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { CloudOff, RefreshCw, Check } from "lucide-react";
import { toast } from "sonner";
import { pendingCount, onQueueChange } from "@/lib/offline/queue";
import { flushQueue } from "@/lib/offline/sync";
import { useOnline } from "@/lib/offline/use-offline-form";

/**
 * 顶部浮条：离线时提示，有待同步条目时显示数量并可手动重试。
 * 联网事件触发时自动回放队列。
 */
export function SyncBadge() {
  const online = useOnline();
  const [count, setCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const router = useRouter();

  const refresh = useCallback(() => {
    void pendingCount().then(setCount);
  }, []);

  useEffect(() => {
    refresh();
    return onQueueChange(refresh);
  }, [refresh]);

  const flush = useCallback(async () => {
    setSyncing(true);
    const r = await flushQueue();
    setSyncing(false);
    refresh();
    if (r.synced > 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 2500);
      router.refresh();
    }
    if (r.errors.length > 0) toast.error(r.errors[0]);
    return r;
  }, [refresh, router]);

  useEffect(() => {
    // 放到微任务里，避免在 effect 体内同步 setState 触发级联渲染
    const run = () => {
      void Promise.resolve().then(flush);
    };
    if (online) run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [online, flush]);

  const show = !online || count > 0 || justSynced;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-[calc(env(safe-area-inset-top)+0.5rem)]"
        >
          {justSynced && count === 0 ? (
            <span className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-footnote font-medium text-ios-green">
              <Check className="size-3.5" /> 已同步
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void flush()}
              disabled={syncing || !online}
              className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 text-footnote font-medium"
            >
              {!online ? (
                <>
                  <CloudOff className="size-3.5 text-ios-orange" />
                  离线中{count > 0 ? ` · ${count} 条待同步` : "，仍可继续记录"}
                </>
              ) : (
                <>
                  <RefreshCw className={`size-3.5 text-primary ${syncing ? "animate-spin" : ""}`} />
                  {count} 条待同步{syncing ? "…" : "，点击重试"}
                </>
              )}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
