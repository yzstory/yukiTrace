"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectField } from "./form-bits";
import { prepareImages, IMAGE_ACCEPT } from "@/lib/client-image";
import type { StopOption } from "./entry-form";

export function PhotoUploader({
  tripId,
  stops,
  defaultStopId,
  purpose = "photo",
  onDone,
}: {
  tripId: string;
  stops: StopOption[];
  defaultStopId?: string;
  purpose?: "photo" | "cover";
  onDone: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [stopId, setStopId] = useState(defaultStopId ?? "");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [stage, setStage] = useState<"idle" | "preparing" | "uploading">("idle");

  async function upload() {
    if (files.length === 0) return;
    // HEIC 转换 + 压缩，避免 iPhone 原图上传失败与流量浪费
    setStage("preparing");
    setProgress({ done: 0, total: files.length });
    const prepared = await prepareImages(files, (done, total) => setProgress({ done, total }));
    setStage("uploading");
    setProgress({ done: 0, total: prepared.length });
    // 分批上传（每批 3 张），避免单次请求过大
    const batch = 3;
    let matched = 0;
    for (let i = 0; i < prepared.length; i += batch) {
      const fd = new FormData();
      fd.set("tripId", tripId);
      fd.set("purpose", purpose);
      if (stopId) fd.set("stopId", stopId);
      prepared.slice(i, i + batch).forEach((f) => fd.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const msg = await res.json().catch(() => null);
        toast.error(msg?.error ?? "上传失败，请重试");
        setProgress(null);
        setStage("idle");
        return;
      }
      const json = (await res.json()) as { results: Array<{ stopId?: string | null }> };
      matched += json.results.filter((r) => r.stopId && !stopId).length;
      setProgress({ done: Math.min(i + batch, prepared.length), total: prepared.length });
    }
    setStage("idle");
    toast.success(purpose === "cover" ? "封面已更新" : `已上传 ${prepared.length} 张照片${matched ? `，${matched} 张已按 GPS 自动归位` : ""}`);
    router.refresh();
    onDone();
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        multiple={purpose === "photo"}
        className="hidden"
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-fill-secondary p-4 text-muted-foreground active:bg-fill"
      >
        {files.length === 0 ? (
          <>
            <ImagePlus className="size-8 text-primary" />
            <span className="text-callout">{purpose === "cover" ? "选择封面图" : "选择照片"}</span>
            <span className="text-caption">支持多选与 iPhone HEIC，自动读取拍摄时间与位置</span>
          </>
        ) : (
          <div className="grid w-full grid-cols-4 gap-2">
            {files.slice(0, 8).map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-lg bg-fill">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={URL.createObjectURL(f)} alt="" className="size-full object-cover" />
              </div>
            ))}
            {files.length > 8 && <div className="flex aspect-square items-center justify-center rounded-lg bg-fill text-callout">+{files.length - 8}</div>}
          </div>
        )}
      </button>
      {purpose === "photo" && stops.length > 0 && (
        <SelectField
          label="归属站点"
          name="stopId"
          value={stopId}
          onChange={(e) => setStopId(e.target.value)}
          options={[{ value: "", label: "按照片 GPS 自动匹配" }, ...stops.map((s) => ({ value: s.id, label: s.name }))]}
        />
      )}
      <Button type="button" onClick={upload} disabled={files.length === 0 || !!progress} className="h-12 rounded-xl text-body font-semibold">
        {progress ? (
          progress.done === progress.total ? (
            <Check className="size-5" />
          ) : (
            <>
              <Loader2 className="size-5 animate-spin" /> {stage === "preparing" ? "处理中" : "上传中"} {progress.done}/{progress.total}
            </>
          )
        ) : (
          `上传${files.length ? ` ${files.length} 张` : ""}`
        )}
      </Button>
    </div>
  );
}
