import { api } from "@/lib/api/handler";
import { removeMember } from "@/lib/services/members";

export const DELETE = api<{ tripId: string; userId: string }>(async (ctx) => removeMember(ctx, ctx.params.tripId, ctx.params.userId));
