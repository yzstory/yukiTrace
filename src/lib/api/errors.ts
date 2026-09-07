/**
 * 服务层统一错误：带 HTTP 状态码，Action 与 API 路由各自翻译。
 * 只有这里抛出的错误会把 message 原样给到客户端；其他异常一律当 500 处理，不泄露内部信息。
 */
export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const unauthorized = (message = "请先登录") => new ApiError(401, message);
export const forbidden = (message = "没有权限") => new ApiError(403, message);
export const notFound = (message = "不存在") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
export const tooMany = (message: string) => new ApiError(429, message);
export const unavailable = (message: string) => new ApiError(503, message);

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** Action 用：把 ApiError 收成 { error }，其他异常继续抛 */
export async function asActionResult<T>(run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (e) {
    if (isApiError(e)) return { error: e.message };
    throw e;
  }
}
