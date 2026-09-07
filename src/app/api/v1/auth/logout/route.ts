import { api } from "@/lib/api/handler";
import { deleteSession } from "@/lib/session";
import { revokeToken } from "@/lib/services/tokens";

/** 令牌登录：撤销当前令牌；cookie 登录：清会话 */
export const POST = api(async ({ principal }) => {
  if (principal.via === "token") await revokeToken(principal, principal.tokenId);
  else await deleteSession();
});
