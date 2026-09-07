import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { inkAll, inkStamp } from "@/lib/services/passport";

/** body { city } 盖一枚；body { all: true } 全部盖章（最多 12 枚） */
export const POST = api(async (ctx) => {
  const { city, all } = await ctx.body();
  if (all === true) return inkAll(ctx);
  if (typeof city !== "string" || !city) throw badRequest("需要 city");
  return inkStamp(ctx, city);
});
