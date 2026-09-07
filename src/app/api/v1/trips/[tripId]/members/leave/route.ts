import { api } from "@/lib/api/handler";
import { leaveTrip } from "@/lib/services/members";

export const POST = api<{ tripId: string }>(async (ctx) => leaveTrip(ctx, ctx.params.tripId));
