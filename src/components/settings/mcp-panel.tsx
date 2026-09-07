"use client";

import { useState, useTransition } from "react";
import { Copy, Trash2, Loader2, Plus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmt } from "@/lib/date";
import { issueMcpToken, revokeMcpToken } from "@/app/(app)/settings/mcp/actions";

export type TokenRow = { id: string; name: string; prefix: string; scope: string; createdAt: Date; lastUsedAt: Date | null };

export function McpPanel({ tokens, baseUrl }: { tokens: TokenRow[]; baseUrl: string }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [fresh, setFresh] = useState<string | null>(null);

  const config = `{
  "mcpServers": {
    "trace": {
      "type": "http",
      "url": "${baseUrl}/api/mcp",
      "headers": { "Authorization": "Bearer ${fresh ?? "你的令牌"}" }
    }
  }
}`;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-card p-4 card-shadow">
        <h2 className="mb-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">这是什么</h2>
        <p className="text-subhead text-muted-foreground">
          生成一个令牌后，可以在 Claude 等支持 MCP 的助手里直接问「我们去过哪些有母婴室的地方」「去年花了多少」。对方只能读，不能改。
        </p>
      </section>

      {fresh && (
        <section className="rounded-2xl bg-ios-green/12 p-4">
          <p className="mb-2 text-footnote font-semibold text-ios-green">令牌已生成，只显示这一次</p>
          <code className="block break-all rounded-xl bg-card px-3 py-2 font-mono text-footnote">{fresh}</code>
          <Button
            variant="secondary"
            className="mt-2 h-9 w-full rounded-xl"
            onClick={async () => {
              await navigator.clipboard.writeText(fresh);
              toast.success("已复制令牌");
            }}
          >
            <Copy className="size-4" /> 复制令牌
          </Button>
        </section>
      )}

      <section className="rounded-2xl bg-card p-4 card-shadow">
        <h2 className="mb-2 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">配置片段</h2>
        <pre className="overflow-x-auto rounded-xl bg-fill-secondary p-3 font-mono text-caption leading-relaxed">{config}</pre>
        <Button
          variant="secondary"
          className="mt-2 h-9 w-full rounded-xl"
          onClick={async () => {
            await navigator.clipboard.writeText(config);
            toast.success("已复制配置");
          }}
        >
          <Copy className="size-4" /> 复制配置
        </Button>
      </section>

      <section className="rounded-2xl bg-card card-shadow">
        <h2 className="px-4 pt-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">令牌 {tokens.length}</h2>
        <p className="px-4 pt-1 text-caption text-muted-foreground">小程序 / App 登录签发的 API 令牌也列在这里，删除即下线该设备。</p>
        <ul className="divide-y divide-border/60">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-4 py-3">
              <KeyRound className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 truncate text-callout">
                  {t.name}
                  <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${t.scope === "api" ? "bg-amber/15 text-amber" : "bg-fill text-muted-foreground"}`}>{t.scope === "api" ? "API 读写" : "MCP 只读"}</span>
                </span>
                <span className="block truncate text-caption text-muted-foreground">
                  {t.prefix}… · {t.lastUsedAt ? `最近使用 ${fmt.date(t.lastUsedAt)}` : "尚未使用"}
                </span>
              </span>
              <button
                type="button"
                aria-label="删除令牌"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await revokeMcpToken(t.id);
                    toast.success("已删除");
                  })
                }
                className="rounded-full p-1.5 text-destructive active:bg-fill"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
          {tokens.length === 0 && <li className="px-4 py-6 text-center text-subhead text-muted-foreground">还没有令牌</li>}
        </ul>
        <form
          className="flex gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const n = name;
            setName("");
            start(async () => {
              const r = await issueMcpToken(n);
              if (r.error) toast.error(r.error);
              else setFresh(r.token!);
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="令牌名称，如「我的 Mac」" className="h-10 flex-1 rounded-xl bg-fill-secondary" />
          <Button type="submit" disabled={pending} className="h-10 rounded-xl">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} 生成
          </Button>
        </form>
      </section>
    </div>
  );
}
