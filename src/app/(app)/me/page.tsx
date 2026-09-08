import Link from "next/link";
import Image from "next/image";
import { Baby, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { PushToggle } from "@/components/pwa/push-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";
import { fmt } from "@/lib/date";
import { reviewableYears } from "@/lib/ai/year-review";
import { passportFor } from "@/lib/passport";
import { growth } from "@/lib/services/review";
import { PassportCard } from "@/components/passport/passport-card";
import { Sparkle } from "lucide-react";

export const metadata = { title: "我" };

export default async function MePage() {
  const user = await getCurrentUser();

  // 成长对照：与 /api/v1/growth 同一份数据
  const { pairs } = await growth({ userId: user.id });
  const years = await reviewableYears(user.id);
  const passport = await passportFor(user.id);

  return (
    <>
      <PageHeader title="我" />
      <PassportCard babyName={passport.babyName} cities={passport.stats.cities} pending={passport.stats.cities - passport.stats.inked} />
      <div className="rounded-2xl bg-card p-5 card-shadow">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-fill text-title-2 font-semibold">{user.name.slice(0, 1)}</span>
          <div>
            <p className="text-headline">{user.name}</p>
            <p className="text-subhead text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </div>

      {years.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 flex items-center gap-1.5 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">
            <Sparkle className="size-3.5 text-ios-purple" /> 年度回顾
          </h2>
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {years.map((y) => (
              <Link key={y} href={`/year/${y}`} className="flex shrink-0 items-center gap-2 rounded-2xl bg-card px-4 py-3 card-shadow">
                <span className="text-headline">{y}</span>
                <ChevronRight className="size-4 text-label-tertiary" />
              </Link>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 mt-6 flex items-center gap-1.5 px-1 text-footnote font-semibold uppercase tracking-wide text-muted-foreground">
        <Baby className="size-3.5" /> 同一个地方，不同的年纪
      </h2>
      {pairs.length === 0 ? (
        <p className="rounded-2xl bg-card px-4 py-6 text-center text-subhead text-muted-foreground card-shadow">再去一次去过的城市，这里就会把两次的照片放在一起。</p>
      ) : (
        <div className="flex flex-col gap-3">
          {pairs.map(({ city, visits: list }) => (
            <section key={city} className="rounded-2xl bg-card p-4 card-shadow">
              <h3 className="mb-3 text-headline">{city}</h3>
              <div className="no-scrollbar flex gap-3 overflow-x-auto">
                {list.map((x) => (
                  <Link key={x.tripId} href={`/trips/${x.tripId}/photos`} className="w-36 shrink-0">
                    <span className="relative block aspect-[4/5] overflow-hidden rounded-xl bg-fill">
                      {x.photoUrl && <Image src={x.photoUrl} alt="" fill sizes="144px" className="object-cover" unoptimized />}
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
        {process.env.VAPID_PUBLIC_KEY && <PushToggle publicKey={process.env.VAPID_PUBLIC_KEY} />}
        <Link href="/trips" className="flex items-center justify-between px-4 py-3 text-callout">
          添加到主屏幕使用 <span className="text-caption text-muted-foreground">Safari 分享 → 添加到主屏幕</span>
          <ChevronRight className="size-4 text-label-tertiary" />
        </Link>
      </div>

      <details className="mt-6 rounded-2xl bg-card card-shadow">
        <summary className="cursor-pointer list-none px-4 py-3 text-caption text-muted-foreground">开发者选项</summary>
        <Link href="/settings/mcp" className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-callout">
          MCP 接入 <span className="text-caption text-muted-foreground">让 Claude 等外部助手读取旅行记录</span>
          <ChevronRight className="size-4 text-label-tertiary" />
        </Link>
      </details>

      <form action={logout} className="mt-6">
        <Button type="submit" variant="secondary" className="h-11 w-full rounded-xl text-callout">
          退出登录
        </Button>
      </form>
    </>
  );
}
