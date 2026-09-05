"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, SendHorizonal, Loader2, Camera, ImagePlus, Square, Wrench, BookOpenText, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { prepareImage, IMAGE_ACCEPT, isProbablyHeic } from "@/lib/client-image";
import { VoiceButton } from "./voice-button";
import { generateTripSummary, generatePackingList } from "@/app/(app)/trips/[tripId]/ai-actions";
import type { ReceiptResult } from "@/app/api/ai/receipt/route";

const TOOL_LABELS: Record<string, string> = {
  listStops: "查站点",
  listEntries: "查条目",
  queryExpenses: "查花费",
  searchPlace: "搜地点",
  getTripSummary: "读概览",
  createStop: "添加站点",
  createEntry: "记录条目",
  addExpense: "记账",
  logBaby: "记宝宝状态",
  saveDailyNote: "写日记",
};

const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

export function AiChat({ tripId, homeCurrency, configured, canEdit, voiceEnabled }: { tripId: string; homeCurrency: string; configured: boolean; canEdit: boolean; voiceEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const [, start] = useTransition();
  const cameraRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: "/api/ai/chat", body: { tripId } }),
    onFinish: () => router.refresh(),
    onError: (e) => toast.error(e.message || "AI 出错了"),
  });
  const streaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, open, reduceMotion]);

  function submit(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    sendMessage({ text: t });
    setInput("");
  }

  async function onReceipt(original: File) {
    setBusy("正在处理图片…");
    const file = await prepareImage(original).catch(() => original);
    if (!file.type.startsWith("image/") && !isProbablyHeic(original)) {
      setBusy(null);
      toast.error("请选择图片文件");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      toast.error("图片不能超过 15MB");
      return;
    }
    setBusy("正在识别票据…");
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("homeCurrency", homeCurrency);
      const res = await fetch("/api/ai/receipt", { method: "POST", body: fd });
      const json = (await res.json()) as ReceiptResult & { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? "识别失败");
      const lines = [
        `我拍了一张${json.kind === "receipt" ? "收据" : json.kind === "flight" ? "航班确认单" : json.kind === "hotel" ? "酒店预订单" : json.kind === "car_rental" ? "租车合同" : json.kind === "train" ? "车票" : "票据"}，识别结果如下，请帮我记录：`,
        `名称：${json.title}`,
        json.amount != null ? `金额：${json.amount} ${json.currency ?? homeCurrency}` : "",
        json.paidAt ? `时间：${json.paidAt}` : "",
        json.entryType ? `条目类型：${json.entryType}` : json.category ? `分类：${json.category}` : "",
        Object.keys(json.meta ?? {}).length ? `字段：${Object.entries(json.meta).map(([k, v]) => `${k}=${v}`).join("，")}` : "",
        json.items?.length ? `明细：${json.items.map((i) => `${i.name}${i.amount != null ? ` ${i.amount}` : ""}`).join("；")}` : "",
        json.note ? `备注：${json.note}` : "",
      ].filter(Boolean);
      sendMessage({ text: lines.join("\n") });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "识别失败");
    } finally {
      setBusy(null);
    }
  }

  function runSummary() {
    setBusy("正在写游记…");
    start(async () => {
      const r = await generateTripSummary(tripId);
      setBusy(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      setMessages((m) => [...m, { id: `sum-${Date.now()}`, role: "assistant", parts: [{ type: "text", text: r.text! }] } as UIMessage]);
    });
  }
  function runPacking() {
    setBusy("正在生成装备清单…");
    start(async () => {
      const r = await generatePackingList(tripId);
      setBusy(null);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(`已生成 ${r.count} 项装备清单`);
      router.push(`/trips/${tripId}/checklist`);
    });
  }

  const quick = [
    canEdit && { label: "刚吃了拉面 2800 日元", text: "刚在站点附近吃了拉面，2800 日元，宝宝吃了点面条" },
    { label: "这趟花了多少", text: "这趟到现在总共花了多少？分类占比呢？" },
    { label: "宝宝相关花费", text: "宝宝相关的花费有哪些，一共多少？" },
    canEdit && { label: "宝宝睡了", text: "宝宝刚睡着了" },
  ].filter(Boolean) as Array<{ label: string; text: string }>;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="AI 助手"
        className="pressable float-action fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[5.5rem] z-30 flex size-12 items-center justify-center rounded-full glass text-primary md:bottom-[2.25rem] md:right-[6.75rem]"
      >
        <Sparkles className="size-6" strokeWidth={2.2} />
      </button>

      <Drawer open={open} onOpenChange={setOpen} repositionInputs={false}>
        <DrawerContent className="h-[88dvh] rounded-t-3xl bg-background">
          <DrawerHeader className="pb-1">
            <DrawerTitle className="flex items-center justify-center gap-1.5 text-headline">
              <Sparkles className="size-4 text-primary" /> AI 助手
            </DrawerTitle>
            <DrawerDescription className="text-caption">随口一句话，我帮你记下来；也可以问这趟的账。</DrawerDescription>
          </DrawerHeader>

          {!configured ? (
            <div className="mx-4 mt-4 rounded-2xl bg-fill p-5 text-center text-subhead text-muted-foreground">
              AI 尚未配置。在服务器 .env 里填写 <code className="rounded bg-card px-1">AI_BASE_URL</code>、<code className="rounded bg-card px-1">AI_API_KEY</code>、<code className="rounded bg-card px-1">AI_MODEL</code>（任意 OpenAI 兼容接口）后重启即可。
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 overflow-y-auto px-4 pb-2">
                {messages.length === 0 && (
                  <div className="flex flex-col gap-2 pt-2">
                    <p className="px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">试试</p>
                    {quick.map((q) => (
                      <button key={q.label} type="button" onClick={() => submit(q.text)} className="rounded-2xl bg-card px-4 py-3 text-left text-callout card-shadow active:bg-fill">
                        {q.label}
                      </button>
                    ))}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <button type="button" onClick={runSummary} className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-callout card-shadow active:bg-fill">
                        <BookOpenText className="size-4 text-ios-purple" /> 写一篇游记
                      </button>
                      {canEdit && (
                        <button type="button" onClick={runPacking} className="flex items-center gap-2 rounded-2xl bg-card px-4 py-3 text-callout card-shadow active:bg-fill">
                          <ListChecks className="size-4 text-ios-green" /> 生成装备清单
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-3 py-2">
                  <AnimatePresence initial={false}>
                    {messages.map((m) => (
                      <Message key={m.id} m={m} />
                    ))}
                  </AnimatePresence>
                  {(streaming || busy) && (
                    <div className="flex items-center gap-2 px-1 text-caption text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" /> {busy ?? "思考中…"}
                    </div>
                  )}
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(input);
                }}
                className="flex items-end gap-2 border-t border-border/60 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
              >
                <input
                  ref={cameraRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void onReceipt(file);
                  }}
                />
                <input
                  ref={photoRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void onReceipt(file);
                  }}
                />
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      disabled={!!busy || streaming}
                      className="flex size-10 items-center justify-center rounded-full bg-fill text-primary disabled:opacity-40"
                      aria-label="拍照识别"
                      title="拍照识别"
                    >
                      <Camera className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      disabled={!!busy || streaming}
                      className="flex size-10 items-center justify-center rounded-full bg-fill text-primary disabled:opacity-40"
                      aria-label="从相册或本地选择照片"
                      title="从相册或本地选择"
                    >
                      <ImagePlus className="size-5" />
                    </button>
                  </div>
                )}
                {voiceEnabled && (
                  <VoiceButton
                    disabled={streaming}
                    onText={(t) => {
                      // 直接发出去，省掉再点一次发送
                      setInput("");
                      sendMessage({ text: t });
                    }}
                  />
                )}
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
                  placeholder={canEdit ? "比如：刚打车去了小樽，3200 日元" : "问问这趟的花费或行程"}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-fill-secondary px-4 py-2.5 text-body outline-none focus:ring-2 focus:ring-ring/50"
                />
                {streaming ? (
                  <button type="button" onClick={stop} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-foreground" aria-label="停止">
                    <Square className="size-4 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim()} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="发送">
                    <SendHorizonal className="size-5" />
                  </button>
                )}
              </form>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

function Message({ m }: { m: UIMessage }) {
  const isUser = m.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(6px)" }}
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}
    >
      {m.parts.map((p, i) => {
        if (p.type === "text") {
          if (!p.text.trim()) return null;
          return (
            <div key={i} className={cn("max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-callout", isUser ? "bg-primary text-primary-foreground" : "bg-card card-shadow")}>
              {p.text}
            </div>
          );
        }
        if (p.type.startsWith("tool-")) {
          const name = p.type.slice(5);
          const state = (p as { state?: string }).state;
          return (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-caption text-muted-foreground">
              <Wrench className="size-3" /> {TOOL_LABELS[name] ?? name}
              {state && state !== "output-available" && state !== "output-error" ? "…" : ""}
            </span>
          );
        }
        return null;
      })}
    </motion.div>
  );
}
