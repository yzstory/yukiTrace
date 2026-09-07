import { api } from "@/lib/api/handler";
import { createInvite } from "@/lib/services/members";

/** 生成家人邀请链接（30 天有效） */
export const POST = api<{ tripId: string }>(async (ctx) => {
  const { token } = await createInvite(ctx, ctx.params.tripId);
  return { token, url: `${process.env.APP_URL?.replace(/\/$/, "") ?? ctx.req.nextUrl.origin}/invite/${token}` };
});
