import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "地图" };

export default function MapPage() {
  return (
    <>
      <PageHeader title="地图" />
      <div className="rounded-2xl bg-card p-8 text-center text-muted-foreground card-shadow">阶段 3：高德地图与路线。</div>
    </>
  );
}
