"use client";

import { useEffect } from "react";
import Link from "next/link";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app error]", error.digest, error.message);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center card-shadow">
        <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-ios-orange/15 text-ios-orange">
          <TriangleAlert className="size-8" />
        </span>
        <h1 className="text-title-2">出了点小问题</h1>
        <p className="mt-2 text-subhead text-muted-foreground">刚才的操作没能完成，你的记录不会丢失。可以重试一次。</p>
        {error.digest && <p className="mt-3 font-mono text-caption text-label-tertiary">错误编号 {error.digest}</p>}
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={reset} className="h-11 rounded-xl">
            <RotateCcw className="size-4" /> 重试
          </Button>
          <Button asChild variant="secondary" className="h-11 rounded-xl">
            <Link href="/trips">回到我的旅程</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
