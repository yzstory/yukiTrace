import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * OpenAI 兼容接口：任何服务商（OpenAI / DeepSeek / 通义 / 智谱 / OpenRouter / 自建）都用同一套配置。
 * AI_BASE_URL   例如 https://api.deepseek.com/v1
 * AI_API_KEY
 * AI_MODEL      对话与工具调用模型
 * AI_VISION_MODEL 支持图片输入的模型（票据识别），可与 AI_MODEL 相同
 */
export function aiConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL);
}

function provider() {
  return createOpenAICompatible({
    name: "trace-ai",
    baseURL: process.env.AI_BASE_URL!,
    apiKey: process.env.AI_API_KEY!,
    includeUsage: false,
  });
}

export function chatModel() {
  return provider().chatModel(process.env.AI_MODEL ?? "gpt-4o-mini");
}

export function visionModel() {
  return provider().chatModel(process.env.AI_VISION_MODEL ?? process.env.AI_MODEL ?? "gpt-4o-mini");
}

export function transcribeConfigured() {
  return Boolean(process.env.AI_API_KEY && process.env.AI_BASE_URL && process.env.AI_TRANSCRIBE_MODEL);
}

/**
 * 语音转写：OpenAI 兼容网关的 /audio/transcriptions 是 multipart 接口，
 * AI SDK 的 openai-compatible provider 未暴露转写模型，这里直接调用最省事也最通用。
 */
export async function transcribeAudio(file: File, language = "zh"): Promise<{ text: string } | { error: string }> {
  if (!transcribeConfigured()) return { error: "未配置语音模型（AI_TRANSCRIBE_MODEL）" };
  const base = process.env.AI_BASE_URL!.replace(/\/$/, "");
  const form = new FormData();
  form.set("file", file);
  form.set("model", process.env.AI_TRANSCRIBE_MODEL!);
  form.set("language", language);
  form.set("response_format", "json");

  const res = await fetch(`${base}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.AI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { error: `转写失败（${res.status}）${detail.slice(0, 120)}` };
  }
  const json = (await res.json()) as { text?: string };
  if (!json.text?.trim()) return { error: "没听清，请再说一次" };
  return { text: json.text.trim() };
}
