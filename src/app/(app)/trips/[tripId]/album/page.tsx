import { notFound } from "next/navigation";
import Image from "next/image";
import { BackButton } from "@/components/layout/back-button";
import { PrintButton } from "@/components/photos/print-button";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";
import { imageUrl } from "@/lib/storage";
import { fmt, tripDays, babyAge, dayIndex, dayDate } from "@/lib/date";
import { formatDistance, haversine } from "@/lib/geo";

export const metadata = { title: "相册" };

/**
 * 打印版相册：用浏览器的「打印 / 存为 PDF」导出，
 * 不引入 PDF 库，排版直接复用 CSS，中文字体也不会缺字。
 */
export default async function AlbumPage(props: PageProps<"/trips/[tripId]/album">) {
  const { tripId } = await props.params;
  await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      stops: {
        orderBy: [{ arriveAt: "asc" }, { order: "asc" }],
        include: { photos: { where: { NOT: { aiTags: { has: "document" } } }, orderBy: [{ isFavorite: "desc" }, { aiScore: "desc" }, { takenAt: "asc" }], take: 4 }, entries: true },
      },
      dailyNotes: true,
      photos: { select: { id: true } },
    },
  });
  if (!trip) notFound();

  const n = tripDays(trip.startDate, trip.endDate);
  let distance = 0;
  for (let i = 1; i < trip.stops.length; i++) distance += haversine(trip.stops[i - 1], trip.stops[i]);

  const days = Array.from({ length: n }, (_, i) => i + 1).map((di) => ({
    index: di,
    date: dayDate(trip.startDate, di),
    stops: trip.stops.filter((s) => Math.min(Math.max(dayIndex(trip.startDate, s.arriveAt, s.timezone ?? trip.timezone), 1), n) === di),
    note: trip.dailyNotes.find((d) => dayIndex(trip.startDate, d.date) === di)?.content ?? null,
  })).filter((d) => d.stops.length > 0 || d.note);

  return (
    <>
      <div className="print:hidden">
        <BackButton href={`/trips/${tripId}`} label={trip.title} />
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-large-title">相册</h1>
          <PrintButton />
        </div>
        <p className="mb-5 rounded-2xl bg-fill px-4 py-3 text-footnote text-muted-foreground">
          点「导出 PDF」会打开系统打印面板，选择「存储为 PDF」即可保存或打印成册。
        </p>
      </div>

      <article className="album mx-auto max-w-3xl">
        <header className="mb-8 break-after-avoid text-center">
          <p className="text-footnote text-muted-foreground">
            {fmt.dateFull(trip.startDate, trip.timezone)} – {fmt.dateFull(trip.endDate, trip.timezone)}
          </p>
          <h2 className="mt-1 text-large-title">{trip.title}</h2>
          {trip.description && <p className="mt-1 text-subhead text-muted-foreground">{trip.description}</p>}
          <p className="mt-3 text-footnote text-muted-foreground">
            {n} 天 · {trip.stops.length} 站{distance ? ` · ${formatDistance(distance)}` : ""} · {trip.photos.length} 张照片
            {trip.babyBirthDate ? ` · ${trip.babyName ?? "宝宝"} ${babyAge(trip.babyBirthDate, trip.startDate)}` : ""}
          </p>
        </header>

        {days.map((day) => (
          <section key={day.index} className="mb-8 break-inside-avoid">
            <h3 className="mb-2 border-b border-border pb-1 text-title-2">
              Day {day.index}
              <span className="ml-2 text-subhead font-normal text-muted-foreground">
                {fmt.dateFull(day.date, trip.timezone)} {fmt.weekday(day.date, trip.timezone)}
              </span>
            </h3>
            {day.note && <p className="mb-3 whitespace-pre-wrap text-body leading-relaxed">{day.note}</p>}
            {day.stops.map((s) => (
              <div key={s.id} className="mb-4 break-inside-avoid">
                <p className="text-headline">
                  {s.name}
                  <span className="ml-2 text-footnote font-normal text-muted-foreground">
                    {fmt.time(s.arriveAt, s.timezone ?? trip.timezone)}
                    {s.city ? ` · ${s.city}` : ""}
                  </span>
                </p>
                {s.note && <p className="mt-1 text-subhead text-foreground/85">{s.note}</p>}
                {s.entries.length > 0 && <p className="mt-1 text-footnote text-muted-foreground">{s.entries.map((e) => e.title).join(" · ")}</p>}
                {s.photos.length > 0 && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {s.photos.map((p) => (
                      <figure key={p.id} className="break-inside-avoid">
                        <span className="relative block aspect-[4/3] overflow-hidden rounded-lg bg-fill">
                          <Image src={imageUrl(p.ossKey, { w: 900 })} alt={p.caption ?? p.aiCaption ?? ""} fill sizes="400px" className="object-cover" unoptimized />
                        </span>
                        {(p.caption ?? p.aiCaption) && <figcaption className="mt-1 text-caption text-muted-foreground">{p.caption ?? p.aiCaption}</figcaption>}
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        ))}

        <footer className="mt-10 text-center text-caption text-label-tertiary">Trace · 带娃旅行记</footer>
      </article>
    </>
  );
}
