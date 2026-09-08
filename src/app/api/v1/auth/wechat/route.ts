import { api, publicApi } from "@/lib/api/handler";
import { loginWithWechat, unbindWechat, wechatStatus } from "@/lib/services/auth";
import { issueToken } from "@/lib/services/tokens";

/**
 * 微信一键登录：{ code, device? } → 已绑定：{ token, user }；未绑定：{ bound: false }
 * 首次绑定走 POST /auth/login 带 wxCode。
 */
export const POST = publicApi(async ({ body }) => {
  const input = await body();
  const user = await loginWithWechat(String(input.code ?? ""));
  if (!user) return { bound: false };
  const { token } = await issueToken({ userId: user.id }, String(input.device ?? "微信小程序"), "api");
  return { bound: true, token, user };
});

/** 当前账号的微信绑定状态 */
export const GET = api(async ({ userId }) => wechatStatus(userId));

/** 解绑微信 */
export const DELETE = api(async ({ userId }) => unbindWechat(userId));
