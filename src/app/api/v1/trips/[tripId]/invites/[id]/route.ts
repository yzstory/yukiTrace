import { api } from "@/lib/api/handler";
import { revokeInvite } from "@/lib/services/members";

export const DELETE = api<{ tripId: string; id: string }>(async (ctx) => revokeInvite(ctx, ctx.params.tripId, ctx.params.id));
