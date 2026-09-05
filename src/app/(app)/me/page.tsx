import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { logout } from "@/app/(auth)/actions";

export const metadata = { title: "我" };

export default async function MePage() {
  const user = await getCurrentUser();
  return (
    <>
      <PageHeader title="我" />
      <div className="rounded-2xl bg-card p-5 card-shadow">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-full bg-fill text-title-2 font-semibold">
            {user.name.slice(0, 1)}
          </span>
          <div>
            <p className="text-headline">{user.name}</p>
            <p className="text-subhead text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <form action={logout} className="mt-6">
          <Button type="submit" variant="secondary" className="h-11 w-full rounded-xl text-callout">
            退出登录
          </Button>
        </form>
      </div>
    </>
  );
}
