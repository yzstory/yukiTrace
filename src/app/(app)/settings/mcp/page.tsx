import { headers } from "next/headers";
import { BackButton } from "@/components/layout/back-button";
import { McpPanel, type TokenRow } from "@/components/settings/mcp-panel";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export const metadata = { title: "MCP 接入" };

export default async function McpSettingsPage() {
  const { userId } = await verifySession();
  const tokens: TokenRow[] = await db.mcpToken.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, prefix: true, createdAt: true, lastUsedAt: true },
  });

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const baseUrl = process.env.APP_URL?.replace(/\/$/, "") ?? `${proto}://${host}`;

  return (
    <>
      <BackButton href="/me" label="我" />
      <h1 className="mb-4 text-large-title">MCP 接入</h1>
      <McpPanel tokens={tokens} baseUrl={baseUrl} />
    </>
  );
}
