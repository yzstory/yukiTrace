import "server-only";

type Level = "debug" | "info" | "warn" | "error";
type Fields = Record<string, unknown>;

const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = LEVELS[(process.env.LOG_LEVEL as Level) ?? (process.env.NODE_ENV === "production" ? "info" : "debug")] ?? 20;

/** 不能进日志的字段（避免把凭证/隐私写进容器日志） */
const REDACT = /^(password|passwordHash|apiKey|token|authorization|cookie|accessKeySecret|secret)$/i;

function clean(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (REDACT.test(k)) {
      out[k] = "[redacted]";
    } else if (v instanceof Error) {
      out[k] = { name: v.name, message: v.message, stack: v.stack?.split("\n").slice(0, 4).join("\n") };
    } else {
      out[k] = v;
    }
  }
  return out;
}

function emit(level: Level, msg: string, fields: Fields = {}) {
  if (LEVELS[level] < MIN) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...clean(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, fields?: Fields) => emit("debug", msg, fields),
  info: (msg: string, fields?: Fields) => emit("info", msg, fields),
  warn: (msg: string, fields?: Fields) => emit("warn", msg, fields),
  error: (msg: string, fields?: Fields) => emit("error", msg, fields),
  /** 计时：返回一个结束函数，落一条带耗时的日志 */
  timer: (msg: string, fields?: Fields) => {
    const started = Date.now();
    return (extra?: Fields) => emit("info", msg, { ...fields, ...extra, ms: Date.now() - started });
  },
};
