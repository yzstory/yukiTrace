import { PageHeader } from "@/components/layout/page-header";

export const metadata = { title: "账本" };

export default function LedgerPage() {
  return (
    <>
      <PageHeader title="账本" />
      <div className="rounded-2xl bg-card p-8 text-center text-muted-foreground card-shadow">阶段 3：花费统计与图表。</div>
    </>
  );
}
