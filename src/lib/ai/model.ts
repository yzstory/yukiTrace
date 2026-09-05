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
