const api = require("../../utils/api");
const F = require("../../utils/format");

const { money, fmt, dayIndex, tripDays, EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ORDER } = F;

Page({
  data: { id: "", home: "CNY", tz: "", total: "", kpis: [], foreign: [], cats: [], days: [], list: [], filter: "ALL", filters: [], canEdit: false, loading: true, all: [] },

  onLoad(q) { this.setData({ id: q.id }); this.load(); },
  onShow() { if (this.data.all.length && getApp().globalData.tripDirty === this.data.id) this.load(); },

  async load() {
    try {
      const d = await api.tripDetail(this.data.id);
      const t = d.trip, tz = t.timezone, home = t.homeCurrency;
      const n = tripDays(t.startDate, t.endDate);
      const all = [];
      const push = (e, stopName) => all.push({ ...e, stopName, day: Math.min(Math.max(dayIndex(t.startDate, e.paidAt, tz), 1), n), time: fmt.dateTime(e.paidAt, tz), amount: money(e.amountMinor, e.currency, { showCode: true }), home: e.currency !== home ? money(e.amountHomeMinor, home) : "", cat: EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.OTHER });
      d.stops.forEach((s) => { s.expenses.forEach((e) => push(e, s.name)); s.entries.forEach((en) => en.expenses.forEach((e) => push(e, s.name))); });
      d.looseEntries.forEach((en) => en.expenses.forEach((e) => push(e, "")));
      d.looseExpenses.forEach((e) => push(e, ""));
      all.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));
      wx.setNavigationBarTitle({ title: `${t.title} · 账本` });
      this.setData({ all, home, tz, n, canEdit: t.role !== "VIEWER", loading: false });
      this.compute();
    } catch (e) { this.setData({ loading: false }); }
  },

  compute() {
    const { all, home, filter, n } = this.data;
    const shown = filter === "ALL" ? all : filter === "BABY" ? all.filter((e) => e.isBaby) : all.filter((e) => e.category === filter);
    const total = shown.reduce((a, e) => a + e.amountHomeMinor, 0);
    const baby = all.filter((e) => e.isBaby).reduce((a, e) => a + e.amountHomeMinor, 0);
    const allTotal = all.reduce((a, e) => a + e.amountHomeMinor, 0);
    // 外币明细
    const byCur = {};
    shown.forEach((e) => { if (e.currency !== home) byCur[e.currency] = (byCur[e.currency] || 0) + e.amountMinor; });
    const foreign = Object.keys(byCur).map((c) => money(byCur[c], c, { showCode: true }));
    // 分类
    const byCat = {};
    shown.forEach((e) => (byCat[e.category] = (byCat[e.category] || 0) + e.amountHomeMinor));
    const max = Math.max(1, ...Object.values(byCat));
    const cats = EXPENSE_CATEGORY_ORDER.filter((k) => byCat[k]).map((k) => ({ key: k, ...EXPENSE_CATEGORIES[k], value: money(byCat[k], home), pct: Math.round((byCat[k] / max) * 100), share: allTotal ? Math.round((byCat[k] / total) * 100) : 0 }));
    // 按天
    const byDay = Array.from({ length: n }, () => 0);
    shown.forEach((e) => (byDay[e.day - 1] += e.amountHomeMinor));
    const dmax = Math.max(1, ...byDay);
    const days = byDay.map((v, i) => ({ index: i + 1, value: v ? money(v, home, { compact: true }) : "", h: Math.round((v / dmax) * 100) }));
    // 明细按天分组
    const groups = {};
    shown.forEach((e) => { (groups[e.day] = groups[e.day] || []).push(e); });
    const list = Object.keys(groups).map(Number).sort((a, b) => b - a).map((day) => ({ day, items: groups[day], sum: money(groups[day].reduce((a, e) => a + e.amountHomeMinor, 0), home) }));
    const usedCats = EXPENSE_CATEGORY_ORDER.filter((k) => all.some((e) => e.category === k));
    this.setData({
      total: money(total, home), foreign, cats, days, list,
      filters: [{ key: "ALL", label: "全部" }, ...(baby ? [{ key: "BABY", label: "🍼 宝宝" }] : []), ...usedCats.map((k) => ({ key: k, label: `${EXPENSE_CATEGORIES[k].emoji} ${EXPENSE_CATEGORIES[k].label}` }))],
      kpis: [
        { label: "日均", value: money(Math.round(allTotal / n), home, { compact: true }) },
        { label: "宝宝相关", value: allTotal ? `${Math.round((baby / allTotal) * 100)}%` : "0%" },
        { label: "笔数", value: String(all.length) },
      ],
    });
  },
  setFilter(e) { this.setData({ filter: e.currentTarget.dataset.key }); this.compute(); },
  open(e) { wx.navigateTo({ url: `/pages/record/record?tripId=${this.data.id}&kind=expense&refId=${e.currentTarget.dataset.id}` }); },
  add() { wx.navigateTo({ url: `/pages/expense-form/expense-form?id=${this.data.id}` }); },
  exportCsv() {
    wx.setClipboardData({ data: `${require("../../utils/request").baseUrl()}/api/export/${this.data.id}?kind=expenses`, success: () => wx.showToast({ title: "CSV 链接已复制，登录网页后打开", icon: "none" }) });
  },
});
