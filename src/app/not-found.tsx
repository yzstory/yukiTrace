import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "找不到页面" };

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 safe-top safe-bottom">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 text-center card-shadow">
        <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Compass className="size-8" />
        </span>
        <h1 className="text-title-2">这里没有记录</h1>
        <p className="mt-2 text-subhead text-muted-foreground">页面可能已被删除，或者链接不对。</p>
        <Button asChild className="mt-6 h-11 w-full rounded-xl">
          <Link href="/trips">回到我的旅程</Link>
        </Button>
      </div>
    </main>
  );
}
