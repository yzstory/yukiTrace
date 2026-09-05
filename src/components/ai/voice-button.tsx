"use client";

import { useCallback, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * 长按录音、松开转写。抱着娃时最常用的记录方式。
 * 录音在浏览器本地完成，只把音频发到自己的服务端转写。
 */
export function VoiceButton({ onText, disabled }: { onText: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "transcribing">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const start = useCallback(async () => {
    if (state !== "idle" || disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      cancelledRef.current = false;
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        if (cancelledRef.current) {
          setState("idle");
          return;
        }
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size < 1024) {
          setState("idle");
          toast.error("太短了，长按并说一句话");
          return;
        }
        setState("transcribing");
        try {
          const fd = new FormData();
          fd.set("audio", new File([blob], `voice.${mime.includes("webm") ? "webm" : "m4a"}`, { type: mime }));
          const res = await fetch("/api/ai/transcribe", { method: "POST", body: fd });
          const json = (await res.json()) as { text?: string; error?: string };
          if (!res.ok || !json.text) throw new Error(json.error ?? "转写失败");
          onText(json.text);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "转写失败");
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recorderRef.current = rec;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          // 60 秒自动停止，避免误触录一整段
          if (s >= 59) recorderRef.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("无法访问麦克风，请检查权限");
      setState("idle");
    }
  }, [state, disabled, onText]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    stop();
  }, [stop]);

  return (
    <motion.button
      type="button"
      aria-label={state === "recording" ? "松开结束录音" : "按住说话"}
      disabled={disabled || state === "transcribing"}
      whileTap={{ scale: 0.92 }}
      onPointerDown={(e) => {
        e.preventDefault();
        void start();
      }}
      onPointerUp={stop}
      onPointerLeave={() => state === "recording" && cancel()}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "flex size-10 shrink-0 select-none items-center justify-center rounded-full transition-colors",
        state === "recording" ? "bg-destructive text-white" : "bg-fill text-primary"
      )}
    >
      {state === "transcribing" ? (
        <Loader2 className="size-5 animate-spin" />
      ) : state === "recording" ? (
        <span className="flex flex-col items-center leading-none">
          <Square className="size-3.5 fill-current" />
          <span className="mt-0.5 text-[10px] tabular-nums">{seconds}s</span>
        </span>
      ) : (
        <Mic className="size-5" />
      )}
    </motion.button>
  );
}
