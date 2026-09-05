import { notFound } from "next/navigation";
import { BackButton } from "@/components/layout/back-button";
import { MembersPanel, type MemberRow, type InviteRow } from "@/components/members/members-panel";
import { requireTripAccess } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "成员" };

export default async function MembersPage(props: PageProps<"/trips/[tripId]/members">) {
  const { tripId } = await props.params;
  const { role, userId } = await requireTripAccess(tripId);
  const trip = await db.trip.findUnique({
    where: { id: tripId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } },
      invites: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!trip) notFound();

  const seen = new Set<string>();
  const members: MemberRow[] = [];
  for (const m of trip.members) {
    if (seen.has(m.userId)) continue;
    seen.add(m.userId);
    members.push({
      userId: m.userId,
      name: m.user.name,
      email: m.user.email,
      role: m.userId === trip.ownerId ? "OWNER" : m.role,
      isOwner: m.userId === trip.ownerId,
      joinedAt: m.joinedAt,
    });
  }
  if (!seen.has(trip.ownerId)) {
    members.unshift({ userId: trip.owner.id, name: trip.owner.name, email: trip.owner.email, role: "OWNER", isOwner: true, joinedAt: trip.createdAt });
  }
  members.sort((a, b) => Number(b.isOwner) - Number(a.isOwner));

  const invites: InviteRow[] = trip.invites.map((i) => ({
    id: i.id,
    token: i.token,
    role: i.role,
    uses: i.uses,
    maxUses: i.maxUses,
    expiresAt: i.expiresAt,
    createdAt: i.createdAt,
  }));

  return (
    <>
      <BackButton href={`/trips/${tripId}`} label={trip.title} />
      <h1 className="mb-4 text-large-title">成员</h1>
      <MembersPanel tripId={tripId} members={members} invites={role === "OWNER" ? invites : []} isOwner={role === "OWNER"} meId={userId} />
    </>
  );
}
