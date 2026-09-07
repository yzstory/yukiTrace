import { api } from "@/lib/api/handler";
import { createShareLink, listShareLinks } from "@/lib/services/share";

export const GET = api<{ tripId: string }>(async (ctx) => ({ links: await listShareLinks(ctx, ctx.params.tripId) }));
export const POST = api<{ tripId: string }>(async (ctx) => {
  const { hideExpense = true } = await ctx.body();
  const link = await createShareLink(ctx, ctx.params.tripId, Boolean(hideExpense));
  return { ...link, url: `${process.env.APP_URL?.replace(/\/$/, "") ?? ctx.req.nextUrl.origin}/share/${link.token}` };
});
