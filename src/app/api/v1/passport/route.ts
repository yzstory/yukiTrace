import { api } from "@/lib/api/handler";
import { passport } from "@/lib/services/passport";

export const GET = api(async (ctx) => passport(ctx));
