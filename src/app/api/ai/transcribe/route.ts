import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { transcribeAudio, transcribeConfigured } from "@/lib/ai/model";
import { rateLimit, tooManyRequests, LIMITS } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.userId) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  if (!transcribeConfigured()) return NextResponse.json({ error: "语音功能未配置" }, { status: 503 });

  const limited = rateLimit(`ai:stt:${session.userId}`, LIMITS.aiChat.limit, LIMITS.aiChat.windowMs);
  if (!limited.ok) return tooManyRequests(limited, "语音识别次数用得有点快");

  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return NextResponse.json({ error: "缺少音频" }, { status: 400 });
  if (audio.size > MAX_BYTES) return NextResponse.json({ error: "录音太长了" }, { status: 413 });
  if (audio.size < 1024) return NextResponse.json({ error: "没录到声音，请长按后再说" }, { status: 400 });

  const done = log.timer("ai.transcribe", { userId: session.userId, bytes: audio.size });
  const r = await transcribeAudio(audio, String(form.get("language") ?? "zh"));
  if ("error" in r) {
    log.warn("ai.transcribe failed", { userId: session.userId, reason: r.error });
    return NextResponse.json({ error: r.error }, { status: 502 });
  }
  done({ chars: r.text.length });
  return NextResponse.json({ text: r.text });
}
