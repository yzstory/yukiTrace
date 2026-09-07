import { publicApi } from "@/lib/api/handler";
import { clientIp } from "@/lib/api/auth";
import { verifyCredentials } from "@/lib/services/auth";
import { issueToken } from "@/lib/services/tokens";

/** 邮箱密码登录，签发 API 令牌（tra_…）。device 用作令牌名称，方便在设置页辨认并撤销 */
export const POST = publicApi(async ({ req, body }) => {
  const input = await body();
  const user = await verifyCredentials(input, clientIp(req));
  const { token } = await issueToken({ userId: user.id }, String(input.device ?? "API 客户端"), "api");
  return { token, user };
});
