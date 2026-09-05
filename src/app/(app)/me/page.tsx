import Link from "next/link";
import Image from "next/image";
import { Baby, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { fmt, babyAge } from "@/lib/date";

export const metadata = { title: "我" };

export default async function MePage() {
  const user = await getCurrentUser();

  // 成长对照：同一城市在不同旅程出现，且各自有照片
  const trips = await db.trip.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    orderBy: { startDate: "asc" },
    include: { stops: { where: { city: { not: null } }, select: { city: true, photos: { take: 1, orderBy: { takenAt: "asc" }, select: { ossKey: true } } } } },
  });
  const byCity = new Map<string, Array<{ tripId: string; title: string; date: Date; photoKey: string | null; ageText: string | null }>>();
  for (const t of trips) {
    const seen = new Set<string>();
    for (const s of t.stops) {
      if (!s.city || seen.has(s.city)) continue;
      seen.add(s.city);
      const list = byCity.get(s.city) ?? [];
      list.push({ tripId: t.id, title: t.title, date: t.startDate, photoKey: s.photos[0]?.ossKey ?? null, ageText: t.babyBirthDate ? babyAge(t.babyBirthDate, t.startDate) : null });
      byCity.set(s.city, list);
    }
  }
  const pairs = Array.from(byCity.entries()).filter(([, l]) => l.length >= 2 && l.some((x) => x.photoKey));

  return (
    <>
      <PageHeader title="我" />
      <div className="rounded-2xl bg-card p-5 card-shadow">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-fill text-title-2 font-semibold">{user.name.slice(0, 1)}</span>
          <div>
            <p className="text-headline">{user.name}</p>
            <p className="text-subhead text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      <h2 className="mb-2 mt-6 flex items-center gap-1.5 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">
        <Baby className="size-3.5" /> 同一个地方，不同的年纪
      </h2>
      {pairs.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-6 text-center text-subhead text-muted-foreground card-shadow">再去一次去过的城市，这里就会把两次的照片放在一起。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pairs.map(([city, list]) => (
            <section key={city} className="rounded-2xl bg-card p-4 card-shadow">
              <h3 className="mb-3 text-headline">{city}</h3>
              <div className="no-scrollbar flex gap-3 overflow-x-auto">
                {list.map((x) => (
                  <Link key={x.tripId} href={`/trips/${x.tripId}/photos`} className="w-36 shrink-0">
                    <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-fill">
                      {x.photoKey && <Image src={imageUrl(x.photoKey, { w: 400 })} alt="" fill sizes="144px" className="object-cover" unoptimized />}
                    </span>
                    <span className="mt-1.5 block truncate text-footnote font-medium">{fmt.monthYear(x.date)}</span>
                    <span className="block truncate text-caption text-muted-foreground">{x.ageText ?? x.title}</span>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <h2 className="mb-2 mt-6 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">外观</h2>
      <div className="rounded-2xl bg-card p-3 card-shadow">
        <ThemeToggle />
      </div>

      <h2 className="mb-2 mt-6 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">设置</h2>
      <div className="divide-y divide-border/60 rounded-2xl bg-card card-shadow">
        <Link href="/trips" className="flex items-center justify-between px-4 py-3 text-callout">
          添加到主屏幕使用 <span className="text-caption text-muted-foreground">Safari 分享 → 添加到主屏幕</span>
          <ChevronRight className="size-4 text-label-tertiary" />
        </Link>
      </div>

      <form action={logout} className="mt-6">
        <Button type="submit" variant="secondary" className="h-11 w-full rounded-xl text-callout">
          退出登录
        </Button>
      </form>
    </>
  );
}
