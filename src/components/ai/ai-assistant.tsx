"use client";

import { usePathname } from "next/navigation";
import { AiChat } from "./ai-chat";

/**
 * 全站唯一的 AI 入口：在旅程页里自动带上该旅程的上下文（可记录、可查账），
 * 在其他页面则是跨旅程的回忆问答。切换旅程时对话重新开始。
 */
export function AiAssistant({ configured, voiceEnabled }: { configured: boolean; voiceEnabled: boolean }) {
  const pathname = usePathname();
  const m = /^\/trips\/([^/]+)/.exec(pathname);
  const tripId = m && m[1] !== "new" ? m[1] : null;
  return <AiChat key={tripId ?? "global"} tripId={tripId} configured={configured} voiceEnabled={voiceEnabled} />;
}
