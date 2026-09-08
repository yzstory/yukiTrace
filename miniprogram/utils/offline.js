/**
 * 离线队列：写操作在没有网络时先存本地，网络恢复后按顺序回放 POST /api/sync。
 * 只覆盖 /api/sync 支持的四类新建：stop / entry / expense / babyLog（与网页离线队列一致）。
 */
const { post, getToken } = require("./request");

const KEY = "offlineQueue";
let replaying = false;
const listeners = new Set();

function read() {
  return wx.getStorageSync(KEY) || [];
}
function write(list) {
  wx.setStorageSync(KEY, list);
  listeners.forEach((fn) => fn(list));
}
function count(tripId) {
  const list = read();
  return tripId ? list.filter((x) => x.tripId === tripId).length : list.length;
}
function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 入队；返回 clientId */
function enqueue(kind, tripId, fields, label) {
  const item = { clientId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, kind, tripId, fields, label: label || kind, createdAt: Date.now(), error: "" };
  write([...read(), item]);
  return item.clientId;
}
function remove(clientId) {
  write(read().filter((x) => x.clientId !== clientId));
}

/** 判断一次请求失败是不是「没网」：status 0 且不是超时以外的原因都当离线处理 */
function isOffline(err) {
  return !!err && err.status === 0;
}

async function online() {
  const r = await new Promise((resolve) => wx.getNetworkType({ success: resolve, fail: () => resolve({ networkType: "unknown" }) }));
  return r.networkType !== "none";
}

/**
 * 回放队列：逐条 POST /api/sync；422（服务端校验拒绝）的条目保留并记下原因，让用户手动处理；
 * 网络错误则停止，等下次。返回 { applied, rejected, stopped }
 */
async function replay() {
  if (replaying || !getToken()) return { applied: 0, rejected: 0, stopped: false };
  if (!(await online())) return { applied: 0, rejected: 0, stopped: true };
  replaying = true;
  let applied = 0, rejected = 0, stopped = false;
  try {
    for (const item of read()) {
      if (item.error) continue; // 被拒绝过的不再自动重试
      try {
        await post("/api/sync", { kind: item.kind, tripId: item.tripId, fields: item.fields, clientId: item.clientId }, { silent: true, timeout: 20000 });
        remove(item.clientId);
        applied++;
      } catch (e) {
        if (e.status === 422 || e.status === 400) {
          rejected++;
          write(read().map((x) => (x.clientId === item.clientId ? { ...x, error: e.message } : x)));
        } else if (e.status === 401) {
          stopped = true;
          break;
        } else {
          stopped = true;
          break;
        }
      }
    }
  } finally {
    replaying = false;
  }
  return { applied, rejected, stopped };
}

/** 网络恢复时自动回放（app.js 里注册一次） */
function watch(onApplied) {
  wx.onNetworkStatusChange(async (res) => {
    if (!res.isConnected || !count()) return;
    const r = await replay();
    if (r.applied && onApplied) onApplied(r);
  });
}

module.exports = { enqueue, remove, read, count, onChange, isOffline, replay, watch, online };
