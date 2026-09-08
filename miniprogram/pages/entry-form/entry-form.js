const api = require("../../utils/api");
const F = require("../../utils/format");
const offline = require("../../utils/offline");

Page({
  data: {
    id: "", tz: "Asia/Shanghai", home: "CNY", busy: false,
    type: "MOMENT", cfg: F.ENTRY_TYPES.MOMENT,
    types: F.ENTRY_TYPE_ORDER.map((k) => ({ key: k, ...F.ENTRY_TYPES[k] })),
    stops: [], stopIndex: 0,
    form: { title: "", startDate: "", startTime: "", endDate: "", endTime: "", note: "", meta: {}, amount: "", currency: "CNY", category: "OTHER", isBaby: false },
    curLabels: F.CURRENCY_CODES, curIndex: 0,
    cats: F.EXPENSE_CATEGORY_ORDER.map((k) => ({ key: k, ...F.EXPENSE_CATEGORIES[k] })),
  },

  async onLoad(q) {
    const type = F.ENTRY_TYPES[q.type] ? q.type : "MOMENT";
    this.setData({ id: q.id, type, cfg: F.ENTRY_TYPES[type], "form.category": F.ENTRY_TYPES[type].defaultCategory });
    wx.setNavigationBarTitle({ title: `记一条 · ${F.ENTRY_TYPES[type].label}` });
    try {
      const d = await api.tripDetail(q.id);
      const tz = d.trip.timezone;
      const now = F.nowInput(tz).split("T");
      const stops = [{ id: "", name: "不关联地点" }, ...d.stops.map((s) => ({ id: s.id, name: s.name }))];
      // 默认关联最近到达的一站
      let stopIndex = 0;
      const nowMs = Date.now();
      d.stops.forEach((s, i) => { if (new Date(s.arriveAt).getTime() <= nowMs) stopIndex = i + 1; });
      if (q.stopId) { const i = stops.findIndex((s) => s.id === q.stopId); if (i > 0) stopIndex = i; }
      this.setData({ tz, home: d.trip.homeCurrency, stops, stopIndex, "form.startDate": now[0], "form.startTime": now[1], "form.currency": d.trip.homeCurrency, curIndex: Math.max(0, F.CURRENCY_CODES.indexOf(d.trip.homeCurrency)) });
    } catch (e) { /* */ }
  },

  setType(e) {
    const type = e.currentTarget.dataset.key;
    this.setData({ type, cfg: F.ENTRY_TYPES[type], "form.category": F.ENTRY_TYPES[type].defaultCategory, "form.meta": {} });
    wx.setNavigationBarTitle({ title: `记一条 · ${F.ENTRY_TYPES[type].label}` });
  },
  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onMeta(e) { this.setData({ [`form.meta.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onPick(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onStop(e) { this.setData({ stopIndex: +e.detail.value }); },
  onCurrency(e) { const i = +e.detail.value; this.setData({ curIndex: i, "form.currency": F.CURRENCY_CODES[i] }); },
  setCat(e) { this.setData({ "form.category": e.currentTarget.dataset.key }); },
  toggleBaby() { this.setData({ "form.isBaby": !this.data.form.isBaby }); },
  clearEnd() { this.setData({ "form.endDate": "", "form.endTime": "" }); },

  async submit() {
    const { form, id, type, stops, stopIndex, busy } = this.data;
    if (busy) return;
    if (!form.title.trim()) return wx.showToast({ title: "请填写标题", icon: "none" });
    if (form.amount && !(Number(form.amount) > 0)) return wx.showToast({ title: "金额不正确", icon: "none" });
    this.setData({ busy: true });
    try {
      const meta = {};
      Object.keys(form.meta).forEach((k) => { if (String(form.meta[k]).trim()) meta[k] = form.meta[k]; });
      const payload = {
        type, title: form.title.trim(), stopId: stops[stopIndex] ? stops[stopIndex].id : "",
        startAt: `${form.startDate}T${form.startTime}`, endAt: form.endDate ? `${form.endDate}T${form.endTime || "23:59"}` : "",
        note: form.note, meta,
        amount: form.amount, currency: form.currency, category: form.category, isBaby: form.isBaby,
      };
      try {
        await api.createEntry(id, payload);
      } catch (e) {
        if (!offline.isOffline(e)) {
          wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
          return;
        }
        offline.enqueue("entry", id, payload, form.title.trim());
        wx.showToast({ title: "没有网络，已存到本机，联网后自动同步", icon: "none", duration: 2500 });
      }
      getApp().markDirty();
      getApp().globalData.tripDirty = id;
      wx.navigateBack();
    } catch (e) {
      wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
    } finally { this.setData({ busy: false }); }
  },
});
