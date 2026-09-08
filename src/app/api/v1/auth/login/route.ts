import { publicApi } from "@/lib/api/handler";
import { clientIp } from "@/lib/api/auth";
import { bindWechat, verifyCredentials } from "@/lib/services/auth";
import { issueToken } from "@/lib/services/tokens";

/**
 * 邮箱密码登录，签发 API 令牌（tra_…）。device 用作令牌名称，方便在设置页辨认并撤销。
 * 小程序可附带 wxCode（wx.login 的 code），登录成功后绑定微信，下次直接 POST /auth/wechat 一键登录。
 */
export const POST = publicApi(async ({ req, body }) => {
  const input = await body();
  const user = await verifyCredentials(input, clientIp(req));
  let wechatBound = false;
  if (input.wxCode) {
    try {
      await bindWechat(user.id, String(input.wxCode));
      wechatBound = true;
    } catch {
      /* 绑定失败不影响登录，客户端下次仍可走邮箱登录 */
    }
  }
  const { token } = await issueToken({ userId: user.id }, String(input.device ?? "API 客户端"), "api");
  return { token, user, wechatBound };
});
