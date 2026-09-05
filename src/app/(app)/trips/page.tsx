import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "旅程" };

export default function TripsPage() {
  return (
    <>
      <PageHeader title="旅程" subtitle="Trace" />
      <div className="rounded-2xl bg-card p-8 text-center text-muted-foreground card-shadow">
        还没有旅程，阶段 2 会在这里加入旅程卡片流。
      </div>
    </>
  );
}
