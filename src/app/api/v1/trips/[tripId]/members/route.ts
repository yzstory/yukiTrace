import { api } from "@/lib/api/handler";
import { listMembers } from "@/lib/services/members";

export const GET = api<{ tripId: string }>(async (ctx) => listMembers(ctx, ctx.params.tripId));
