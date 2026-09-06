import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, Footprints } from "lucide-react";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { acceptInvite } from "@/app/(app)/trips/[tripId]/member-actions";
import { Button } from "@/components/ui/button";
import { fmt, tripDays } from "@/lib/date";

export const metadata = { title: "旅程邀请", robots: { index: false } };

export default async function InvitePage(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const invite = await db.tripInvite.findUnique({
    where: { token },
    include: { trip: { select: { title: true, startDate: true, endDate: true, timezone: true, babyName: true } }, createdBy: { select: { name: true } } },
  });

  if (!invite) return <Notice title="邀请无效" desc="链接可能已被撤销，或者输入有误。" />;
  if (invite.expiresAt && invite.expiresAt < new Date()) return <Notice title="邀请已过期" desc="请让对方重新生成一个链接。" />;
  if (invite.maxUses != null && invite.uses >= invite.maxUses) return <Notice title="邀请已用完" desc="这个链接的可用次数已经用尽。" />;

  const session = await getSession();
  if (!session?.userId) {
    return (
      <Shell>
        <Card invite={invite} />
        <p className="mt-6 text-center text-subhead text-muted-foreground">登录后即可加入</p>
        <div className="mt-3 flex flex-col gap-2">
          <Button asChild className="h-12 rounded-xl text-body font-semibold">
            <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>登录</Link>
          </Button>
          <Button asChild variant="secondary" className="h-12 rounded-xl text-body">
            <Link href={`/signup?next=${encodeURIComponent(`/invite/${token}`)}`}>注册新账号</Link>
          </Button>
        </div>
      </Shell>
    );
  }

  async function accept() {
    "use server";
    const r = await acceptInvite(token);
    if (r.tripId) redirect(`/trips/${r.tripId}`);
    redirect("/trips");
  }

  return (
    <Shell>
      <Card invite={invite} />
      <form action={accept} className="mt-6">
        <Button type="submit" className="h-12 w-full rounded-xl text-body font-semibold">
          <Users className="size-5" /> 加入这段旅程
        </Button>
      </form>
    </Shell>
  );
}

type InviteWithTrip = {
  createdBy: { name: string };
  trip: { title: string; startDate: Date; endDate: Date; timezone: string; babyName: string | null };
};

function Card({ invite }: { invite: InviteWithTrip }) {
  const t = invite.trip;
  return (
    <div className="rounded-3xl bg-card p-6 text-center card-shadow">
      <span className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Footprints className="size-8" />
      </span>
      <p className="text-subhead text-muted-foreground">{invite.createdBy.name} 邀请你一起记录</p>
      <h1 className="mt-1 text-title-1">{t.title}</h1>
      <p className="mt-1 text-subhead text-muted-foreground">
        {fmt.date(t.startDate, t.timezone)} – {fmt.date(t.endDate, t.timezone)} · {tripDays(t.startDate, t.endDate)} 天
      </p>
      <span className="mt-4 inline-block rounded-full bg-fill px-3 py-1 text-footnote font-medium text-muted-foreground">加入后可以一起记录</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 safe-top safe-bottom">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}

function Notice({ title, desc }: { title: string; desc: string }) {
  return (
    <Shell>
      <div className="rounded-3xl bg-card p-8 text-center card-shadow">
        <h1 className="text-title-2">{title}</h1>
        <p className="mt-2 text-subhead text-muted-foreground">{desc}</p>
        <Button asChild variant="secondary" className="mt-6 h-11 rounded-xl px-6">
          <Link href="/trips">回到我的旅程</Link>
        </Button>
      </div>
    </Shell>
  );
}
