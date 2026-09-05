import { getCurrentUser } from "@/lib/dal";
import { Sidebar } from "@/components/layout/sidebar";
import { TabBar } from "@/components/layout/tab-bar";
import { SyncBadge } from "@/components/offline/sync-badge";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh">
      <Sidebar user={user} />
      <main className="min-w-0 flex-1 pb-24 md:pb-8">
        <div className="mx-auto w-full max-w-3xl px-5 pt-6 md:px-8 md:pt-10">{children}</div>
      </main>
      <TabBar />
      <SyncBadge />
    </div>
  );
}
