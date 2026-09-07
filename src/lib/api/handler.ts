import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { authenticate, type Principal } from "@/lib/api/auth";
import { isApiError } from "@/lib/api/errors";
import { log } from "@/lib/logger";

type Params = Record<string, string>;
type Ctx<P extends Params> = {
  req: NextRequest;
  params: P;
  principal: Principal;
  userId: string;
  /** JSON 请求体；非 JSON 或空体得到 {} */
  body: () => Promise<Record<string, unknown>>;
  query: URLSearchParams;
};
type PublicCtx<P extends Params> = Omit<Ctx<P>, "principal" | "userId"> & { principal: Principal | null; userId: string | null };

async function readBody(req: NextRequest): Promise<Record<string, unknown>> {
  if (!req.headers.get("content-type")?.includes("application/json")) return {};
  const json = await req.json().catch(() => null);
  return json && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

function respond(data: unknown) {
  if (data instanceof Response) return data;
  return NextResponse.json(data === undefined || data === null ? { ok: true } : data);
}

function fail(e: unknown, req: NextRequest) {
  if (isApiError(e)) {
    const headers: Record<string, string> = {};
    if (e.status === 401) headers["WWW-Authenticate"] = 'Bearer realm="yukitrace"';
    return NextResponse.json({ error: e.message }, { status: e.status, headers });
  }
  if (e instanceof ZodError) return NextResponse.json({ error: e.issues[0]?.message ?? "请求格式不正确" }, { status: 400 });
  log.error("api.unhandled", { method: req.method, path: req.nextUrl.pathname, err: e });
  return NextResponse.json({ error: "操作失败，请稍后重试" }, { status: 500 });
}

/**
 * /api/v1 路由的统一外壳：鉴权、JSON 体、错误翻译。
 * 处理函数返回任意可 JSON 化的值；返回 null/undefined 得到 { ok: true }。
 */
export function api<P extends Params = Params>(handler: (ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    try {
      const principal = await authenticate(req);
      if (!principal) return NextResponse.json({ error: "请先登录" }, { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="yukitrace"' } });
      const params = await route.params;
      return respond(await handler({ req, params, principal, userId: principal.userId, body: () => readBody(req), query: req.nextUrl.searchParams }));
    } catch (e) {
      return fail(e, req);
    }
  };
}

/** 不要求登录的路由（登录、注册、接受邀请前的预览等） */
export function publicApi<P extends Params = Params>(handler: (ctx: PublicCtx<P>) => Promise<unknown>) {
  return async (req: NextRequest, route: { params: Promise<P> }) => {
    try {
      const principal = await authenticate(req);
      const params = await route.params;
      return respond(await handler({ req, params, principal, userId: principal?.userId ?? null, body: () => readBody(req), query: req.nextUrl.searchParams }));
    } catch (e) {
      return fail(e, req);
    }
  };
}
