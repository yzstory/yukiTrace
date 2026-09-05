import { notFound } from "next/navigation";
import Link from "next/link";
import { BackButton } from "@/components/layout/back-button";
import { YearSlides } from "@/components/summary/year-slides";
import { yearReview, reviewableYears } from "@/lib/ai/year-review";
import { verifySession } from "@/lib/dal";

export async function generateMetadata(props: PageProps<"/year/[year]">) {
  const { year } = await props.params;
  return { title: `${year} 年回顾` };
}

export default async function YearPage(props: PageProps<"/year/[year]">) {
  const { year } = await props.params;
  const y = Number(year);
  if (!Number.isInteger(y) || y < 2000 || y > 2100) notFound();

  const { userId } = await verifySession();
  const [review, years] = await Promise.all([yearReview(userId, y), reviewableYears(userId)]);

  return (
    <>
      <BackButton href="/me" label="我" />
      <h1 className="mb-4 text-large-title">{y} 年回顾</h1>
      {years.length > 1 && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {years.map((yy) => (
            <Link
              key={yy}
              href={`/year/${yy}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-footnote font-medium ${yy === y ? "bg-foreground text-background" : "bg-card text-muted-foreground card-shadow"}`}
            >
              {yy}
            </Link>
          ))}
        </div>
      )}
      {review ? (
        <YearSlides review={review} />
      ) : (
        <p className="rounded-2xl bg-card px-4 py-8 text-center text-subhead text-muted-foreground card-shadow">{y} 年还没有旅程记录。</p>
      )}
    </>
  );
}
