import { api } from "@/lib/api/handler";
import { revokeToken } from "@/lib/services/tokens";

export const DELETE = api<{ id: string }>(async (ctx) => revokeToken(ctx, ctx.params.id));
