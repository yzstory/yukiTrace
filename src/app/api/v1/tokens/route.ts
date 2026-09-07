import { api } from "@/lib/api/handler";
import { badRequest } from "@/lib/api/errors";
import { issueToken, listTokens } from "@/lib/services/tokens";

export const GET = api(async (ctx) => listTokens(ctx));

/** 签发令牌：scope = api（读写）| mcp（只读） */
export const POST = api(async (ctx) => {
  const { name, scope = "api" } = await ctx.body();
  if (scope !== "api" && scope !== "mcp") throw badRequest("scope 只能是 api 或 mcp");
  return issueToken(ctx, String(name ?? ""), scope);
});
