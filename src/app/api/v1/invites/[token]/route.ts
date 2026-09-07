import { api, publicApi } from "@/lib/api/handler";
import { acceptInvite, inviteInfo } from "@/lib/services/members";

/** 邀请预览（不需要登录） */
export const GET = publicApi<{ token: string }>(async (ctx) => {
  const invite = await inviteInfo(ctx.params.token);
  return { trip: invite.trip, invitedBy: invite.createdBy.name, expiresAt: invite.expiresAt };
});
/** 接受邀请 */
export const POST = api<{ token: string }>(async (ctx) => acceptInvite(ctx, ctx.params.token));
