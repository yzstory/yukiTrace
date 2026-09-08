const { baseUrl, getToken } = require("./request");

/**
 * AI 对话流：POST /api/ai/chat，解析 Vercel AI SDK 的 UI Message Stream（SSE）。
 * 回调：onText(fullText) 文本增量后的全文；onTool({ name, state, input, output })；onDone()；onError(message)
 * 返回 { abort() }
 */
function chat({ messages, tripId, onText, onTool, onDone, onError }) {
  let text = "";
  let buffer = "";
  let finished = false;
  const tools = {};
  const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;

  function decode(chunk) {
    if (decoder) return decoder.decode(chunk, { stream: true });
    // 兜底：逐字节转（仅 ASCII 安全；正常环境都有 TextDecoder）
    return String.fromCharCode.apply(null, new Uint8Array(chunk));
  }

  function handleEvent(evt) {
    switch (evt.type) {
      case "text-delta":
        text += evt.delta || "";
        onText && onText(text);
        break;
      case "tool-input-start":
      case "tool-input-available": {
        const t = (tools[evt.toolCallId] = tools[evt.toolCallId] || { id: evt.toolCallId, name: evt.toolName, state: "running" });
        if (evt.input) t.input = evt.input;
        onTool && onTool({ ...t });
        break;
      }
      case "tool-output-available": {
        const t = (tools[evt.toolCallId] = tools[evt.toolCallId] || { id: evt.toolCallId, name: "" });
        t.state = "done";
        t.output = evt.output;
        onTool && onTool({ ...t });
        break;
      }
      case "tool-output-error": {
        const t = (tools[evt.toolCallId] = tools[evt.toolCallId] || { id: evt.toolCallId, name: "" });
        t.state = "error";
        t.error = evt.errorText;
        onTool && onTool({ ...t });
        break;
      }
      case "error":
        onError && onError(evt.errorText || "AI 出错了");
        break;
      default:
        break;
    }
  }

  function consume(str) {
    buffer += str;
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).replace(/\r$/, "");
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        handleEvent(JSON.parse(payload));
      } catch (e) {
        /* 半截 JSON 不会出现在整行里；忽略无法解析的行 */
      }
    }
  }

  const task = wx.request({
    url: `${baseUrl()}/api/ai/chat`,
    method: "POST",
    enableChunked: true,
    timeout: 120000,
    header: { "content-type": "application/json", authorization: `Bearer ${getToken()}` },
    data: { messages, tripId: tripId || null },
    success: (res) => {
      if (res.statusCode >= 400) {
        let msg = `AI 请求失败（${res.statusCode}）`;
        try {
          const body = typeof res.data === "string" ? JSON.parse(res.data) : res.data;
          if (body && body.error) msg = body.error;
        } catch (e) { /* ignore */ }
        onError && onError(msg);
      } else if (typeof res.data === "string" && res.data) {
        // 部分环境不走 chunk 回调而是一次性返回
        consume(res.data);
      }
    },
    fail: (err) => {
      if (!/abort/i.test((err && err.errMsg) || "")) onError && onError("网络不可用");
    },
    complete: () => {
      if (finished) return;
      finished = true;
      if (buffer) consume("\n");
      onDone && onDone();
    },
  });
  task.onChunkReceived((res) => consume(decode(res.data)));
  return { abort: () => task.abort() };
}

/** 构造一条用户消息（UIMessage） */
function userMessage(text, imageDataUrls = []) {
  const parts = [];
  imageDataUrls.forEach((url, i) => parts.push({ type: "file", mediaType: "image/jpeg", filename: `photo-${i + 1}.jpg`, url }));
  if (text) parts.push({ type: "text", text });
  return { id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: "user", parts };
}
function assistantMessage(text) {
  return { id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, role: "assistant", parts: [{ type: "text", text }] };
}

module.exports = { chat, userMessage, assistantMessage };
