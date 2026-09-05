/** 离线队列里的一条待同步操作 */
export type QueuedKind = "stop" | "entry" | "expense" | "babyLog";

export type QueuedOp = {
  id: string;
  kind: QueuedKind;
  tripId: string;
  /** 表单字段，与在线提交时的 FormData 完全一致 */
  fields: Record<string, string>;
  /** 展示用摘要，例如「拉面 ¥2,800」 */
  summary: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type QueuedPhoto = {
  id: string;
  tripId: string;
  stopId?: string;
  blob: Blob;
  filename: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
};

export type SyncResult = { synced: number; failed: number; errors: string[] };
