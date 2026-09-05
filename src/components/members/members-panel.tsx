"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Copy, Trash2, Loader2, Crown, Pencil, Eye, LogOut, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/quick-add/form-bits";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createInvite, revokeInvite, changeMemberRole, removeMember, leaveTrip } from "@/app/(app)/trips/[tripId]/member-actions";
import type { MemberRole } from "@/generated/prisma/enums";
import { fmt } from "@/lib/date";
import { cn } from "@/lib/utils";

export type MemberRow = { userId: string; name: string; email: string; role: MemberRole; isOwner: boolean; joinedAt: Date };
export type InviteRow = { id: string; token: string; role: MemberRole; uses: number; maxUses: number | null; expiresAt: Date | null; createdAt: Date };

const ROLE_META: Record<MemberRole, { label: string; desc: string; icon: typeof Crown }> = {
  OWNER: { label: "所有者", desc: "可管理成员与删除旅程", icon: Crown },
  EDITOR: { label: "可编辑", desc: "可记录、修改、上传", icon: Pencil },
  VIEWER: { label: "只读", desc: "只能查看，不能修改", icon: Eye },
};

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
  const [role, setRole] = useState<MemberRole>("EDITOR");
  const [days, setDays] = useState("7");
  const [uses, setUses] = useState("1");
  const router = useRouter();
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-2xl bg-card card-shadow">
        <h2 className="px-4 pt-3 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">成员 {members.length}</h2>
        <ul className="divide-y divide-border/60">
          {members.map((m) => {
            const meta = ROLE_META[m.role];
            const Icon = meta.icon;
            return (
              <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-fill text-callout font-semibold">{m.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-callout font-medium">
                    {m.name}
                    {m.userId === meId && <span className="ml-1 text-caption text-muted-foreground">（我）</span>}
                  </span>
                  <span className="block truncate text-caption text-muted-foreground">{m.email}</span>
                </span>
                {isOwner && !m.isOwner && m.userId !== meId ? (
                  <select
                    value={m.role}
                    disabled={pending}
                    onChange={(e) =>
                      start(async () => {
                        await changeMemberRole(tripId, m.userId, e.target.value as MemberRole);
                        toast.success("已更新权限");
                      })
                    }
                    className="h-8 rounded-lg border border-input bg-fill-secondary px-2 text-footnote"
                  >
                    <option value="EDITOR">可编辑</option>
                    <option value="VIEWER">只读</option>
                  </select>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-fill px-2.5 py-1 text-caption font-medium text-muted-foreground">
                    <Icon className="size-3" /> {meta.label}
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
            );
          })}
        </ul>
      </section>

      {isOwner && (
        <section className="rounded-2xl bg-card p-4 card-shadow">
          <h2 className="mb-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">邀请</h2>
          <p className="mb-3 text-caption text-muted-foreground">把链接发给家人，对方登录或注册后即可加入这段旅程。</p>

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
                    <button
                      type="button"
                      aria-label="复制"
                      onClick={async () => {
                        await navigator.clipboard.writeText(url);
                        toast.success("已复制邀请链接");
                      }}
                      className="rounded-full p-1.5 text-primary active:bg-fill"
                    >
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
                    {ROLE_META[iv.role].label} · 已用 {iv.uses}
                    {iv.maxUses != null ? `/${iv.maxUses}` : " 次"}
                    {iv.expiresAt ? ` · ${expired ? "已过期" : `${fmt.date(iv.expiresAt)} 到期`}` : " · 长期有效"}
                    {used && " · 已用完"}
                  </p>
                </li>
              );
            })}
          </ul>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary" className="mt-3 h-10 w-full rounded-xl">
                <UserPlus className="size-4" /> 新建邀请链接
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl">
              <DialogHeader>
                <DialogTitle>新建邀请链接</DialogTitle>
                <DialogDescription>{ROLE_META[role].desc}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3">
                <SelectField
                  label="权限"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as MemberRole)}
                  options={[
                    { value: "EDITOR", label: "可编辑 — 能记录与修改" },
                    { value: "VIEWER", label: "只读 — 只能查看" },
                  ]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="有效期"
                    name="days"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                    options={[
                      { value: "1", label: "1 天" },
                      { value: "7", label: "7 天" },
                      { value: "30", label: "30 天" },
                      { value: "0", label: "长期有效" },
                    ]}
                  />
                  <SelectField
                    label="可用次数"
                    name="uses"
                    value={uses}
                    onChange={(e) => setUses(e.target.value)}
                    options={[
                      { value: "1", label: "1 次" },
                      { value: "5", label: "5 次" },
                      { value: "0", label: "不限" },
                    ]}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={pending}
                  className="h-11 rounded-xl"
                  onClick={() =>
                    start(async () => {
                      await createInvite(tripId, role, Number(days), uses === "0" ? null : Number(uses));
                      toast.success("邀请链接已生成");
                      router.refresh();
                    })
                  }
                >
                  {pending ? <Loader2 className="size-4 animate-spin" /> : "生成"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
