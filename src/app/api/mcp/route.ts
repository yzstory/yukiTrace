import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { globalTools } from "@/lib/ai/global-tools";
import { verifyMcpToken } from "@/lib/mcp-tokens";
import { rateLimit, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "yukitrace", title: "Trace 旅行记录", version: "1.0.0" };

type JsonRpcRequest = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function ok(id: JsonRpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function err(id: JsonRpcRequest["id"], code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

/**
 * MCP over HTTP（Streamable HTTP 的 JSON 响应形态）。
 * 只暴露只读工具，复用跨旅程问答那套定义，避免两处漂移。
 * 鉴权用独立的 MCP 令牌，而不是会话 cookie，方便外部客户端接入。
 */
export async function POST(req: NextRequest) {
  const userId = await verifyMcpToken(req.headers.get("authorization"));
  if (!userId) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "需要有效的 MCP 令牌（Authorization: Bearer trc_…）" } },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="yukitrace"' } }
    );
  }

  const limited = rateLimit(`mcp:${userId}`, LIMITS.aiChat.limit * 4, LIMITS.aiChat.windowMs);
  if (!limited.ok) return err(null, -32000, "请求过于频繁");

  const body = (await req.json().catch(() => null)) as JsonRpcRequest | JsonRpcRequest[] | null;
  if (!body || Array.isArray(body)) return err(null, -32600, "不支持批量请求");

  const tools = globalTools(userId);

  switch (body.method) {
    case "initialize":
      return ok(body.id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: "查询这个家庭的旅行记录：去过哪里、花了多少、宝宝当时多大、照片里有什么。所有工具只读。",
      });

    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "ping":
      return ok(body.id, {});

    case "tools/list":
      return ok(body.id, {
        tools: Object.entries(tools).map(([name, t]) => ({
          name,
          description: t.description,
          inputSchema: z.toJSONSchema(t.inputSchema as z.ZodType, { io: "input" }),
        })),
      });

    case "tools/call": {
      const name = String(body.params?.name ?? "");
      const tool = tools[name as keyof typeof tools];
      if (!tool) return err(body.id, -32602, `未知工具 ${name}`);
      try {
        const args = (body.params?.arguments ?? {}) as Record<string, unknown>;
        const parsed = (tool.inputSchema as z.ZodType).parse(args);
        const result = await tool.execute!(parsed as never, { toolCallId: "mcp", messages: [] } as never);
        log.info("mcp.call", { userId, tool: name });
        return ok(body.id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          structuredContent: { result },
        });
      } catch (e) {
        log.warn("mcp.call failed", { userId, tool: name, err: e });
        return ok(body.id, { content: [{ type: "text", text: e instanceof Error ? e.message : "调用失败" }], isError: true });
      }
    }

    default:
      return err(body.id, -32601, `不支持的方法 ${body.method}`);
  }
}

export async function GET() {
  // 不提供 SSE 通道；客户端使用 JSON 响应模式即可
  return new NextResponse("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
