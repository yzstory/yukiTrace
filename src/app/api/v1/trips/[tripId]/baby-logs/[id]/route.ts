import { api } from "@/lib/api/handler";
import { deleteBabyLog } from "@/lib/services/daily";

export const DELETE = api<{ tripId: string; id: string }>(async (ctx) => deleteBabyLog(ctx, ctx.params.tripId, ctx.params.id));
