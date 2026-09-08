const api = require("../../utils/api");
const F = require("../../utils/format");
const offline = require("../../utils/offline");

Page({
  data: {
    id: "", tz: "Asia/Shanghai", home: "CNY", busy: false,
    stops: [], stopIndex: 0, curLabels: F.CURRENCY_CODES, curIndex: 0,
    cats: F.EXPENSE_CATEGORY_ORDER.map((k) => ({ key: k, ...F.EXPENSE_CATEGORIES[k] })),
    form: { title: "", amount: "", currency: "CNY", category: "FOOD", isBaby: false, paidDate: "", paidTime: "", note: "" },
    rateText: "",
  },

  async onLoad(q) {
    this.setData({ id: q.id });
    try {
      const d = await api.tripDetail(q.id);
      const tz = d.trip.timezone;
      const now = F.nowInput(tz).split("T");
      const stops = [{ id: "", name: "不关联地点" }, ...d.stops.map((s) => ({ id: s.id, name: s.name }))];
      let stopIndex = 0;
      d.stops.forEach((s, i) => { if (new Date(s.arriveAt).getTime() <= Date.now()) stopIndex = i + 1; });
      if (q.stopId) { const i = stops.findIndex((s) => s.id === q.stopId); if (i > 0) stopIndex = i; }
      // 默认币种：上一笔花费的币种，否则主币种
      const last = d.stops.flatMap((s) => [...s.expenses, ...s.entries.flatMap((e) => e.expenses)]).concat(d.looseExpenses).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];
      const currency = last ? last.currency : d.trip.homeCurrency;
      this.setData({ tz, home: d.trip.homeCurrency, stops, stopIndex, "form.paidDate": now[0], "form.paidTime": now[1], "form.currency": currency, curIndex: Math.max(0, F.CURRENCY_CODES.indexOf(currency)) });
      this.updateRate();
    } catch (e) { /* */ }
  },

  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onPick(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onStop(e) { this.setData({ stopIndex: +e.detail.value }); },
  onCurrency(e) { const i = +e.detail.value; this.setData({ curIndex: i, "form.currency": F.CURRENCY_CODES[i] }); this.updateRate(); },
  setCat(e) { this.setData({ "form.category": e.currentTarget.dataset.key, "form.isBaby": e.currentTarget.dataset.key === "BABY" ? true : this.data.form.isBaby }); },
  toggleBaby(e) { this.setData({ "form.isBaby": e.detail.value }); },

  async updateRate() {
    const { form, home } = this.data;
    if (form.currency === home) return this.setData({ rateText: "" });
    try {
      const r = await api.rate(form.currency, home, form.paidDate);
      this.setData({ rateText: `1 ${form.currency} ≈ ${Number(r.rate).toFixed(4)} ${home}` });
    } catch (e) { this.setData({ rateText: "" }); }
  },

  async submit() {
    const { form, id, stops, stopIndex, busy } = this.data;
    if (busy) return;
    if (!form.title.trim()) return wx.showToast({ title: "请填写名称", icon: "none" });
    if (!(Number(form.amount) > 0)) return wx.showToast({ title: "请填写金额", icon: "none" });
    this.setData({ busy: true });
    try {
      const payload = {
        title: form.title.trim(), amount: form.amount, currency: form.currency, category: form.category, isBaby: form.isBaby,
        paidAt: `${form.paidDate}T${form.paidTime}`, stopId: stops[stopIndex] ? stops[stopIndex].id : "", note: form.note,
      };
      try {
        await api.createExpense(id, payload);
      } catch (e) {
        if (!offline.isOffline(e)) {
          wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
          return;
        }
        offline.enqueue("expense", id, payload, form.title.trim());
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
