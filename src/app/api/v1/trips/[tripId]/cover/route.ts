import { api } from "@/lib/api/handler";
import { setTripCover } from "@/lib/services/trips";

/** body.coverKey 为 null 清除封面；封面文件先经 /api/upload（purpose=cover）上传 */
export const PUT = api<{ tripId: string }>(async (ctx) => {
  const { coverKey } = await ctx.body();
  await setTripCover(ctx, ctx.params.tripId, coverKey == null ? null : String(coverKey));
});
