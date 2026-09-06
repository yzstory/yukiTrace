"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage, type FileUIPart } from "ai";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Sparkles, SendHorizonal, Loader2, Camera, ImagePlus, Square, Wrench, BookOpenText, ListChecks, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { prepareChatImage, IMAGE_ACCEPT, isProbablyHeic } from "@/lib/client-image";
import { VoiceButton } from "./voice-button";
import { generateTripSummary, generatePackingList } from "@/app/(app)/trips/[tripId]/ai-actions";

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
  savePhotos: "存照片",
};

const MAX_ATTACHMENTS = 6;
type Pending = { id: string; file: File; url: string };

export function AiChat({ tripId, configured, canEdit, voiceEnabled }: { tripId: string; configured: boolean; canEdit: boolean; voiceEnabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
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

  async function submit(text: string) {
    const t = text.trim();
    if (streaming) return;
    if (!t && pending.length === 0) return;
    // 图片以附件形式随文字一起发出去，由模型根据文字判断用途
    const files = pending.length ? await toFileParts(pending.map((p) => p.file)) : [];
    sendMessage(files.length ? { text: t, files } : { text: t });
    pending.forEach((p) => URL.revokeObjectURL(p.url));
    setPending([]);
    setInput("");
  }

  async function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).slice(0, MAX_ATTACHMENTS - pending.length);
    if (incoming.length === 0) {
      toast.error(`一次最多 ${MAX_ATTACHMENTS} 张图片`);
      return;
    }
    setBusy("正在处理图片…");
    try {
      const prepared: Pending[] = [];
      for (const f of incoming) {
        if (!f.type.startsWith("image/") && !isProbablyHeic(f)) continue;
        const file = await prepareChatImage(f).catch(() => f);
        prepared.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, file, url: URL.createObjectURL(file) });
      }
      if (prepared.length === 0) toast.error("请选择图片文件");
      setPending((p) => [...p, ...prepared]);
    } finally {
      setBusy(null);
    }
  }

  function removePending(id: string) {
    setPending((p) => {
      const hit = p.find((x) => x.id === id);
      if (hit) URL.revokeObjectURL(hit.url);
      return p.filter((x) => x.id !== id);
    });
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
        className="pressable float-action fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-[5.5rem] z-30 flex size-12 items-center justify-center rounded-full glass text-primary md:bottom-[2.25rem] md:right-[6.75rem]"
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
                className="border-t border-border/60 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
              >
                {pending.length > 0 && (
                  <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
                    {pending.map((p) => (
                      <span key={p.id} className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-fill">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.url} alt="" className="size-full object-cover" />
                        <button type="button" onClick={() => removePending(p.id)} aria-label="移除图片" className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/60 text-white">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <span className="flex items-center px-1 text-caption text-muted-foreground">说说这些图片是什么，比如「今天的账单」或「宝宝第一次看海」</span>
                  </div>
                )}
                <div className="flex items-end gap-2">
                <input
                  ref={cameraRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    void addFiles(files);
                    e.currentTarget.value = "";
                  }}
                />
                <input
                  ref={photoRef}
                  type="file"
                  accept={IMAGE_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = e.currentTarget.files;
                    void addFiles(files);
                    e.currentTarget.value = "";
                  }}
                />
                {canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => cameraRef.current?.click()}
                      disabled={!!busy || streaming}
                      className="flex size-10 items-center justify-center rounded-full bg-fill text-primary disabled:opacity-40"
                      aria-label="拍照"
                      title="拍照"
                    >
                      <Camera className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => photoRef.current?.click()}
                      disabled={!!busy || streaming}
                      className="flex size-10 items-center justify-center rounded-full bg-fill text-primary disabled:opacity-40"
                      aria-label="添加图片"
                      title="添加图片"
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
                  placeholder={pending.length ? "这些图片是…" : canEdit ? "比如：刚打车去了小樽，3200 日元" : "问问这趟的花费或行程"}
                  className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl bg-fill-secondary px-4 py-2.5 text-body outline-none focus:ring-2 focus:ring-ring/50"
                />
                {streaming ? (
                  <button type="button" onClick={stop} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-foreground" aria-label="停止">
                    <Square className="size-4 fill-current" />
                  </button>
                ) : (
                  <button type="submit" disabled={(!input.trim() && pending.length === 0) || !!busy} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40" aria-label="发送">
                    <SendHorizonal className="size-5" />
                  </button>
                )}
                </div>
              </form>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}

/**
 * 把 File 读成 data URL 组成 FileUIPart。
 * 不走 DataTransfer/FileList：WebKit 要求 add() 的参数必须是原生 File，压缩库返回的 Blob 会报错。
 */
async function toFileParts(files: File[]): Promise<FileUIPart[]> {
  return Promise.all(
    files.map(
      (f) =>
        new Promise<FileUIPart>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve({ type: "file", mediaType: f.type || "image/jpeg", url: String(r.result), filename: f.name });
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        })
    )
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
      {m.parts.some((p) => p.type === "file" && p.mediaType?.startsWith("image/")) && (
        <div className={cn("flex max-w-[85%] flex-wrap gap-1.5", isUser ? "justify-end" : "justify-start")}>
          {m.parts
            .filter((p) => p.type === "file" && p.mediaType?.startsWith("image/"))
            .map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={(p as { url: string }).url} alt="" className="size-24 rounded-xl object-cover" />
            ))}
        </div>
      )}
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
