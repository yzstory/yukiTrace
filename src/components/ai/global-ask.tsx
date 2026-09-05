"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { motion, AnimatePresence } from "motion/react";
import { SendHorizonal, Loader2, Square, Wrench, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VoiceButton } from "./voice-button";

const TOOL_LABELS: Record<string, string> = {
  searchMemories: "翻记录",
  listTrips: "看旅程",
  compareSpending: "比花费",
  findPlacesVisited: "找地点",
  onThisDay: "查那年今日",
};

const SUGGESTIONS = [
  "我们住过哪些带婴儿床的酒店？",
  "去年这个时候我们在哪？",
  "哪一趟最费钱，主要花在什么上？",
  "宝宝一共去过几个城市？",
  "有母婴室的地方都有哪些？",
];

export function GlobalAsk({
  configured,
  voiceEnabled,
  semantic,
  tripCount,
  indexed,
}: {
  configured: boolean;
  voiceEnabled: boolean;
  semantic: boolean;
  tripCount: number;
  indexed: number;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/ask" }),
    onError: (e) => toast.error(e.message || "出错了"),
  });
  const streaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    sendMessage({ text: t });
    setInput("");
  }

  if (!configured) {
    return <p className="rounded-2xl bg-card p-6 text-center text-subhead text-muted-foreground card-shadow">AI 尚未配置，填好 AI_BASE_URL / AI_API_KEY / AI_MODEL 后即可使用。</p>;
  }

  return (
    <div className="flex flex-col">
      <div ref={listRef} className="flex flex-col gap-3 pb-4">
        {messages.length === 0 && (
          <>
            <div className="rounded-2xl bg-card p-4 card-shadow">
              <p className="flex items-center gap-1.5 text-callout font-medium">
                <Sparkles className="size-4 text-primary" /> 关于 {tripCount} 段旅程，随便问
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                {semantic ? `已索引 ${indexed} 条记录，支持语义搜索。` : "未配置向量模型，当前用关键词匹配，配置 AI_EMBEDDING_MODEL 后更聪明。"}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => submit(s)} className="rounded-2xl bg-card px-4 py-3 text-left text-callout card-shadow active:bg-fill">
                  {s}
                </button>
              ))}
            </div>
          </>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <Message key={m.id} m={m} />
          ))}
        </AnimatePresence>
        {streaming && (
          <div className="flex items-center gap-2 px-1 text-caption text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> 正在翻记录…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] flex items-end gap-2 rounded-2xl bg-background/80 py-2 backdrop-blur md:bottom-4"
      >
        {voiceEnabled && <VoiceButton disabled={streaming} onText={(t) => submit(t)} />}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit(input);
            }
          }}
          rows={1}
          placeholder="问问过去的旅行…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-fill-secondary px-4 py-2.5 text-body outline-none focus:ring-2 focus:ring-ring/50"
        />
        {streaming ? (
          <button type="button" onClick={stop} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill" aria-label="停止">
            <Square className="size-4 fill-current" />
          </button>
        ) : (
          <button type="submit" disabled={!input.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="发送">
            <SendHorizonal className="size-5" />
          </button>
        )}
      </form>
    </div>
  );
}

function Message({ m }: { m: UIMessage }) {
  const isUser = m.role === "user";
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      {m.parts.map((p, i) => {
        if (p.type === "text") {
          if (!p.text.trim()) return null;
          return (
            <div key={i} className={cn("max-w-[88%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-callout", isUser ? "bg-primary text-primary-foreground" : "bg-card card-shadow")}>
              {p.text}
            </div>
          );
        }
        if (p.type.startsWith("tool-")) {
          const name = p.type.slice(5);
          return (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-caption text-muted-foreground">
              <Wrench className="size-3" /> {TOOL_LABELS[name] ?? name}
            </span>
          );
        }
        return null;
      })}
    </motion.div>
  );
}
