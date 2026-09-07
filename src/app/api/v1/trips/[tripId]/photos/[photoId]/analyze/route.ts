import { api } from "@/lib/api/handler";
import { retryPhotoAnalysis } from "@/lib/services/organize";

export const POST = api<{ tripId: string; photoId: string }>(async (ctx) => retryPhotoAnalysis(ctx, ctx.params.tripId, ctx.params.photoId));
