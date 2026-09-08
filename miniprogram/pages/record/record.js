const api = require("../../utils/api");
const F = require("../../utils/format");
const { imageSrc } = require("../../utils/request");

/** 与 src/lib/record-fields.ts 一致 */
const note = { key: "note", label: "备注", type: "textarea" };
const stop = { key: "stopId", label: "关联地点", type: "stop" };
const RECORD_FIELDS = {
  expense: [{ key: "title", label: "名称", required: true }, { key: "amount", label: "金额", type: "number", required: true }, { key: "currency", label: "币种", type: "currency", required: true }, { key: "paidAt", label: "付款时间", type: "datetime-local", required: true }, stop, note],
  entry: [{ key: "title", label: "名称", required: true }, { key: "startAt", label: "开始时间", type: "datetime-local", required: true }, { key: "endAt", label: "结束时间", type: "datetime-local" }, stop, note],
  stop: [{ key: "name", label: "地点名称", required: true }, { key: "arriveAt", label: "到达时间", type: "datetime-local", required: true }, { key: "leaveAt", label: "离开时间", type: "datetime-local" }, { key: "lat", label: "纬度", type: "number", required: true }, { key: "lng", label: "经度", type: "number", required: true }, { key: "address", label: "地址" }, note],
  photo: [{ key: "caption", label: "照片说明", type: "textarea" }, { key: "takenAt", label: "拍摄时间", type: "datetime-local" }, stop, { key: "firstMoment", label: "第一次（请按实际经历确认）" }],
  babyLog: [{ key: "at", label: "记录时间", type: "datetime-local", required: true }, note],
  dailyNote: [{ key: "content", label: "日记", type: "textarea", required: true }],
  checklistItem: [{ key: "text", label: "清单内容", required: true }],
};
const ACTION_LABELS = { create: "创建", update: "修改", delete: "删除", undo: "撤销", confirm: "核对", keepDuplicates: "保留重复", link: "关联地点" };
const SOURCE_LABELS = { ai: "AI", web: "网页", api: "接口", organize: "整理", sync: "离线同步", form: "表单" };

Page({
  data: { tripId: "", kind: "", refId: "", label: "", loading: true, canEdit: false, version: "", fields: [], values: {}, stops: [], stopIndex: 0, curIndex: 0, curLabels: F.CURRENCY_CODES, history: [], busy: false, image: "", extra: [], tz: "" },

  onLoad(q) {
    this.setData({ tripId: q.tripId, kind: q.kind, refId: q.refId, label: F.ENTITY_LABELS[q.kind] || "记录" });
    wx.setNavigationBarTitle({ title: F.ENTITY_LABELS[q.kind] || "记录" });
    this.load();
  },

  async load() {
    this.setData({ loading: true });
    try {
      const r = await api.record(this.data.tripId, this.data.kind, this.data.refId);
      if (!r.record) {
        wx.showToast({ title: "记录已被删除", icon: "none" });
        return setTimeout(() => wx.navigateBack(), 800);
      }
      const defs = RECORD_FIELDS[this.data.kind] || [];
      const values = {};
      const fields = defs.map((f) => {
        const v = r.values[f.key] == null ? "" : String(r.values[f.key]);
        values[f.key] = v;
        const field = { ...f };
        if (f.type === "datetime-local") { field.date = v ? v.slice(0, 10) : ""; field.time = v ? v.slice(11, 16) : ""; }
        return field;
      });
      const stops = [{ id: "", name: "不关联地点" }, ...r.stops];
      const rec = r.record;
      const extra = [];
      if (this.data.kind === "entry" && rec.type) extra.push(`类型：${(F.ENTRY_TYPES[rec.type] || {}).label || rec.type}`);
      if (this.data.kind === "stop" && rec.type) extra.push(`类型：${(F.STOP_TYPES[rec.type] || {}).label || rec.type}`);
      if (this.data.kind === "expense") { extra.push(`分类：${(F.EXPENSE_CATEGORIES[rec.category] || {}).label || rec.category}${rec.isBaby ? " · 宝宝相关" : ""}`); }
      if (this.data.kind === "babyLog" && rec.type) extra.push(`类型：${(F.BABY_LOG_TYPES[rec.type] || {}).label || rec.type}`);
      if (this.data.kind === "photo" && rec.aiCaption) extra.push(`AI 说明：${rec.aiCaption}`);
      const history = (r.history || []).map((h) => ({
        id: h.id,
        text: `${h.actor && h.actor.name ? h.actor.name : "系统"} · ${ACTION_LABELS[h.action] || h.action} · ${SOURCE_LABELS[h.source] || h.source}`,
        time: F.fmt.dateTime(h.createdAt, r.timezone),
        changes: describeChanges(h.before, h.after),
        pendingAi: h.source === "ai" && !h.reviewedAt && !h.undoneAt && ["create", "update"].includes(h.action),
        undone: !!h.undoneAt,
      }));
      this.setData({
        version: r.version, values, fields, stops, tz: r.timezone,
        stopIndex: Math.max(0, stops.findIndex((s) => s.id === values.stopId)),
        curIndex: Math.max(0, F.CURRENCY_CODES.indexOf(values.currency)),
        canEdit: !!r.canEdit, history, extra,
        image: this.data.kind === "photo" && rec.ossKey ? imageSrc(`/api/files/${rec.ossKey}?w=1200`) : "",
      });
    } catch (e) {
      if (e.status === 404) setTimeout(() => wx.navigateBack(), 800);
    } finally {
      this.setData({ loading: false });
    }
  },

  onInput(e) { this.setData({ [`values.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onDate(e) { this.updateDateTime(e.currentTarget.dataset.index, "date", e.detail.value); },
  onTime(e) { this.updateDateTime(e.currentTarget.dataset.index, "time", e.detail.value); },
  clearDateTime(e) {
    const i = e.currentTarget.dataset.index;
    const f = this.data.fields[i];
    this.setData({ [`fields[${i}].date`]: "", [`fields[${i}].time`]: "", [`values.${f.key}`]: "" });
  },
  updateDateTime(i, part, v) {
    const f = { ...this.data.fields[i], [part]: v };
    if (part === "date" && !f.time) f.time = "12:00";
    this.setData({ [`fields[${i}]`]: f, [`values.${f.key}`]: f.date ? `${f.date}T${f.time || "00:00"}` : "" });
  },
  onStop(e) { const i = +e.detail.value; this.setData({ stopIndex: i, "values.stopId": this.data.stops[i].id }); },
  onCurrency(e) { const i = +e.detail.value; this.setData({ curIndex: i, "values.currency": F.CURRENCY_CODES[i] }); },

  async save() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      await api.editRecord(this.data.tripId, this.data.kind, this.data.refId, this.data.version, this.data.values);
      getApp().globalData.tripDirty = this.data.tripId;
      getApp().markDirty();
      wx.showToast({ title: "已保存", icon: "success" });
      this.load();
    } catch (e) {
      if (e.status === 409) { wx.showToast({ title: "记录刚被别人改过，已刷新", icon: "none" }); this.load(); }
      else wx.showToast({ title: e.message || "保存失败", icon: "none" });
    } finally { this.setData({ busy: false }); }
  },
  remove() {
    wx.showModal({
      title: `删除${this.data.label}`, content: "删除后无法恢复，操作历史会保留。", confirmText: "删除", confirmColor: "#FF3B30",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await api.removeRecord(this.data.tripId, this.data.kind, this.data.refId, this.data.version);
          getApp().globalData.tripDirty = this.data.tripId;
          getApp().markDirty();
          wx.navigateBack();
        } catch (e) {
          if (e.status === 409) { wx.showToast({ title: "记录刚被改过，已刷新", icon: "none" }); this.load(); }
          else wx.showToast({ title: e.message || "删除失败", icon: "none" });
        }
      },
    });
  },
  async confirm() {
    try {
      await api.confirmRecord(this.data.tripId, this.data.kind, this.data.refId, this.data.version);
      wx.showToast({ title: "已核对", icon: "success" });
      this.load();
    } catch (e) { /* toast */ }
  },
  undo(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: "撤销这次 AI 写入", content: "会把记录恢复到写入前的状态。", confirmText: "撤销",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await api.undoActivity(this.data.tripId, id);
          getApp().globalData.tripDirty = this.data.tripId;
          wx.showToast({ title: "已撤销", icon: "success" });
          this.load();
        } catch (e) { /* toast */ }
      },
    });
  },
  preview() { if (this.data.image) wx.previewImage({ urls: [this.data.image] }); },
});

const FIELD_LABELS = { title: "名称", name: "地点", note: "备注", content: "日记", caption: "照片说明", currency: "币种", amountMinor: "金额", paidAt: "付款时间", arriveAt: "到达", leaveAt: "离开", startAt: "开始", endAt: "结束", at: "记录时间", stopId: "关联地点", category: "分类", isBaby: "宝宝相关", text: "内容", checked: "已完成", address: "地址", city: "城市", lat: "纬度", lng: "经度", firstMoment: "第一次", takenAt: "拍摄时间", type: "类型" };
function describeChanges(before, after) {
  if (!before && !after) return "";
  if (!before) return "";
  if (!after) return "";
  const keys = Object.keys(FIELD_LABELS).filter((k) => JSON.stringify(before[k] == null ? null : before[k]) !== JSON.stringify(after[k] == null ? null : after[k]));
  return keys.map((k) => FIELD_LABELS[k]).join("、");
}
