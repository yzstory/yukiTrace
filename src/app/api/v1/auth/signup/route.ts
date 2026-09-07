import { publicApi } from "@/lib/api/handler";
import { clientIp } from "@/lib/api/auth";
import { registerUser } from "@/lib/services/auth";
import { issueToken } from "@/lib/services/tokens";

export const POST = publicApi(async ({ req, body }) => {
  const input = await body();
  const user = await registerUser(input, clientIp(req));
  const { token } = await issueToken({ userId: user.id }, String(input.device ?? "API 客户端"), "api");
  return { token, user };
});
