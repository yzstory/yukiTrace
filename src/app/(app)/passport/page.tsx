import { BackButton } from "@/components/layout/back-button";
import { PassportBook, type PassportView } from "@/components/passport/passport-book";
import { verifySession } from "@/lib/dal";
import { passportFor } from "@/lib/passport";

export const metadata = { title: "旅行护照" };

export default async function PassportPage() {
  const { userId } = await verifySession();
  const passport = await passportFor(userId);
  const view: PassportView = {
    ...passport,
    stamps: passport.stamps.map((s) => ({ ...s, firstAt: s.firstAt.toISOString(), inkedAt: s.inkedAt?.toISOString() ?? null })),
  };
  return (
    <>
      <BackButton href="/me" label="我" />
      <PassportBook passport={view} canInk />
    </>
  );
}
