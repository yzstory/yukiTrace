/**
 * /api/v1 接口一览（对应 docs/api.md）。全部返回 Promise。
 * 时间字段传当地时间 `YYYY-MM-DDTHH:mm`，金额传原币常规单位（1800 日元 / 12.5 元）。
 */
const { get, post, put, patch, del } = require("./request");

const v1 = "/api/v1";
const trip = (id) => `${v1}/trips/${id}`;

const api = {
  // 账号
  login: (email, password, device = "微信小程序", wxCode = "") => post(`${v1}/auth/login`, { email, password, device, wxCode }, { auth: false, silent: true }),
  signup: (email, password, name, device = "微信小程序") => post(`${v1}/auth/signup`, { email, password, name, device }, { auth: false, silent: true }),
  logout: () => post(`${v1}/auth/logout`, {}, { silent: true }),
  me: () => get(`${v1}/me`),

  // 旅程
  trips: () => get(`${v1}/trips`),
  createTrip: (data) => post(`${v1}/trips`, data),
  tripDetail: (id) => get(trip(id)),
  updateTrip: (id, data) => put(trip(id), data),
  deleteTrip: (id) => del(trip(id)),
  setCover: (id, coverKey) => put(`${trip(id)}/cover`, { coverKey }),
  footprint: () => get(`${v1}/footprint`),

  // 记录
  createStop: (id, data) => post(`${trip(id)}/stops`, data, { silent: true }),
  updateStop: (id, stopId, data) => put(`${trip(id)}/stops/${stopId}`, data),
  deleteStop: (id, stopId) => del(`${trip(id)}/stops/${stopId}`),
  createEntry: (id, data) => post(`${trip(id)}/entries`, data, { silent: true }),
  updateEntry: (id, entryId, data) => put(`${trip(id)}/entries/${entryId}`, data),
  deleteEntry: (id, entryId) => del(`${trip(id)}/entries/${entryId}`),
  createExpense: (id, data) => post(`${trip(id)}/expenses`, data, { silent: true }),
  deleteExpense: (id, expenseId) => del(`${trip(id)}/expenses/${expenseId}`),
  updatePhotoCaption: (id, photoId, caption) => patch(`${trip(id)}/photos/${photoId}`, { caption }),
  deletePhoto: (id, photoId) => del(`${trip(id)}/photos/${photoId}`),
  analyzePhoto: (id, photoId) => post(`${trip(id)}/photos/${photoId}/analyze`, {}),
  createBabyLog: (id, data) => post(`${trip(id)}/baby-logs`, data, { silent: true }),
  deleteBabyLog: (id, logId) => del(`${trip(id)}/baby-logs/${logId}`),
  saveNote: (id, date, content) => put(`${trip(id)}/notes/${date}`, { content }),

  // 记录统一查改删（带版本号）
  record: (id, kind, refId) => get(`${trip(id)}/records/${kind}/${refId}`),
  editRecord: (id, kind, refId, version, values) => patch(`${trip(id)}/records/${kind}/${refId}`, { version, values }, { silent: true }),
  // version 走查询参数：微信对 DELETE 带 body 的处理不保证，服务端两种都支持
  removeRecord: (id, kind, refId, version) => del(`${trip(id)}/records/${kind}/${refId}`, undefined, { silent: true, query: { version } }),
  confirmRecord: (id, kind, refId, version) => post(`${trip(id)}/records/${kind}/${refId}/confirm`, { version }),
  undoActivity: (id, activityId) => post(`${trip(id)}/activities/${activityId}/undo`, {}),

  // 家人 / 分享
  members: (id) => get(`${trip(id)}/members`),
  removeMember: (id, userId) => del(`${trip(id)}/members/${userId}`),
  leaveTrip: (id) => post(`${trip(id)}/members/leave`, {}),
  createInvite: (id) => post(`${trip(id)}/invites`, {}),
  revokeInvite: (id, inviteId) => del(`${trip(id)}/invites/${inviteId}`),
  inviteInfo: (token) => get(`${v1}/invites/${token}`, undefined, { auth: false }),
  acceptInvite: (token) => post(`${v1}/invites/${token}`, {}),
  shareLinks: (id) => get(`${trip(id)}/share-links`),
  createShareLink: (id, hideExpense) => post(`${trip(id)}/share-links`, { hideExpense }),
  revokeShareLink: (id, linkId) => del(`${trip(id)}/share-links/${linkId}`),

  // 清单
  checklist: (id) => get(`${trip(id)}/checklist`),
  addChecklistItem: (id, group, text) => post(`${trip(id)}/checklist`, { group, text }),
  toggleChecklistItem: (id, itemId, checked) => patch(`${trip(id)}/checklist/${itemId}`, { checked }),
  deleteChecklistItem: (id, itemId) => del(`${trip(id)}/checklist/${itemId}`),
  applyChecklistTemplate: (id) => post(`${trip(id)}/checklist/template`, {}),
  resetChecklist: (id) => post(`${trip(id)}/checklist/reset`, {}),

  // 整理
  tidy: (id) => get(`${trip(id)}/tidy`),
  autoTidy: (id) => post(`${trip(id)}/tidy`, {}),

  // AI 生成（对话走 utils/stream.js）
  aiDailyDraft: (id, date, tone) => post(`${trip(id)}/ai/daily-draft`, { date, tone }, { timeout: 60000 }),
  aiFamilyDigest: (id, date) => post(`${trip(id)}/ai/family-digest`, { date }, { timeout: 60000 }),
  aiSummary: (id) => post(`${trip(id)}/ai/summary`, {}, { timeout: 60000 }),
  aiPackingList: (id) => post(`${trip(id)}/ai/packing-list`, {}, { timeout: 60000 }),

  // 回顾：旅程总结 / 年度回顾 / 成长对照
  tripSummary: (id) => get(`${trip(id)}/summary`),
  years: () => get(`${v1}/years`),
  yearReview: (year) => get(`${v1}/years/${year}`, undefined, { timeout: 60000 }),
  growth: () => get(`${v1}/growth`),

  // 微信登录
  wechatLogin: (code, device = "微信小程序") => post(`${v1}/auth/wechat`, { code, device }, { auth: false, silent: true }),
  wechatStatus: () => get(`${v1}/auth/wechat`, undefined, { silent: true }),
  wechatUnbind: () => del(`${v1}/auth/wechat`),

  // 护照 / 汇率 / 地点搜索
  passport: () => get(`${v1}/passport`),
  inkStamp: (city) => post(`${v1}/passport/stamps`, { city }, { timeout: 60000 }),
  inkAll: () => post(`${v1}/passport/stamps`, { all: true }, { timeout: 120000 }),
  rate: (from, to, at) => get(`${v1}/rates`, { from, to, at }),
  searchPlace: (q, city) => get(`/api/amap/search`, { q, city }),
  tokens: () => get(`${v1}/tokens`),
};

module.exports = api;
