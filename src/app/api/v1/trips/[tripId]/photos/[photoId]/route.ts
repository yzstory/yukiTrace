import { api } from "@/lib/api/handler";
import { deletePhoto, updatePhotoCaption } from "@/lib/services/daily";

type P = { tripId: string; photoId: string };
/** 上传照片走 /api/upload（multipart，同样接受 Bearer） */
export const PATCH = api<P>(async (ctx) => {
  const { caption } = await ctx.body();
  await updatePhotoCaption(ctx, ctx.params.tripId, ctx.params.photoId, String(caption ?? ""));
});
export const DELETE = api<P>(async (ctx) => deletePhoto(ctx, ctx.params.tripId, ctx.params.photoId));
