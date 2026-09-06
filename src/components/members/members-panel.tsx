"use client";

import { useTransition } from "react";
import { useOrigin } from "@/hooks/use-origin";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, Trash2, Loader2, Crown, LogOut, Link2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createInvite, revokeInvite, removeMember, leaveTrip } from "@/app/(app)/trips/[tripId]/member-actions";
import type { MemberRole } from "@/generated/prisma/enums";
import { fmt } from "@/lib/date";
import { cn } from "@/lib/utils";

export type MemberRow = { userId: string; name: string; email: string; role: MemberRole; isOwner: boolean; joinedAt: Date };
export type InviteRow = { id: string; token: string; role: MemberRole; uses: number; maxUses: number | null; expiresAt: Date | null; createdAt: Date };

/**
 * 家庭旅程只有两种人：所有者和家人。家人都能一起记录；
 * 想让别人「只看不改」，用分享链接就够了，不再设只读成员。
 */
export function MembersPanel({
  tripId,
  members,
  invites,
  isOwner,
  meId,
}: {
  tripId: string;
  members: MemberRow[];
  invites: InviteRow[];
  isOwner: boolean;
  meId: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  const origin = useOrigin();

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("已复制邀请链接");
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-card card-shadow">
        <h2 className="px-4 pt-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">家人 {members.length}</h2>
        <ul className="divide-y divide-border/60">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-callout font-semibold">{m.name.slice(0, 1)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-callout font-medium">
                  {m.name}
                  {m.userId === meId && <span className="ml-1 text-caption text-muted-foreground">（我）</span>}
                </span>
                <span className="block truncate text-caption text-muted-foreground">{m.email}</span>
              </span>
              {m.isOwner && (
                <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-muted-foreground">
                  <Crown className="size-3" /> 所有者
                </span>
              )}
              {isOwner && !m.isOwner && m.userId !== meId && (
                <button
                  type="button"
                  aria-label="移出旅程"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await removeMember(tripId, m.userId);
                      toast.success("已移出旅程");
                    })
                  }
                  className="-mr-1 rounded-full p-1.5 text-destructive active:bg-fill"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="rounded-2xl bg-card p-4 card-shadow">
          <h2 className="mb-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">邀请家人</h2>
          <p className="mb-3 text-caption text-muted-foreground">把链接发给家人，对方登录或注册后就能一起记录。链接 30 天内有效。</p>

          <ul className="flex flex-col gap-2">
            {invites.map((iv) => {
              const url = `${origin}/invite/${iv.token}`;
              const expired = iv.expiresAt && iv.expiresAt < new Date();
              const used = iv.maxUses != null && iv.uses >= iv.maxUses;
              return (
                <li key={iv.id} className={cn("rounded-xl bg-fill-secondary p-3", (expired || used) && "opacity-55")}>
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 shrink-0 text-primary" />
                    <span className="min-w-0 flex-1 truncate text-footnote">{url}</span>
                    <button type="button" aria-label="复制" onClick={() => copy(url)} className="rounded-full p-1.5 text-primary active:bg-fill">
                      <Copy className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="撤销"
                      disabled={pending}
                      onClick={() => start(() => revokeInvite(tripId, iv.id))}
                      className="rounded-full p-1.5 text-destructive active:bg-fill"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className="mt-1.5 text-caption text-muted-foreground">
                    已加入 {iv.uses} 人
                    {iv.expiresAt ? ` · ${expired ? "已过期" : `${fmt.date(iv.expiresAt)} 到期`}` : " · 长期有效"}
                    {used && " · 已用完"}
                  </p>
                </li>
              );
            })}
          </ul>

          <Button
            variant="secondary"
            disabled={pending}
            className="mt-3 h-10 w-full rounded-xl"
            onClick={() =>
              start(async () => {
                const r = await createInvite(tripId);
                if (r?.token) {
                  await copy(`${origin}/invite/${r.token}`).catch(() => toast.success("邀请链接已生成"));
                }
                router.refresh();
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />} 生成邀请链接并复制
          </Button>
          <p className="mt-3 flex items-start gap-1.5 text-caption text-muted-foreground">
            <Share2 className="mt-0.5 size-3.5 shrink-0" /> 只想给朋友看看？在「编辑旅程」里生成只读分享链接，不用加成员。
          </p>
        </section>
      )}

      {!isOwner && (
        <Button
          variant="ghost"
          disabled={pending}
          className="h-11 rounded-xl text-callout text-destructive hover:bg-destructive/10"
          onClick={() => start(() => leaveTrip(tripId))}
        >
          <LogOut className="size-4" /> 退出这段旅程
        </Button>
      )}
    </div>
  );
}
