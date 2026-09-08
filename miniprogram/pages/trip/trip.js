const api = require("../../utils/api");
const { imageSrc } = require("../../utils/request");
const F = require("../../utils/format");
const { pickAndUpload } = require("../../utils/upload");
const offline = require("../../utils/offline");

const { money, fmt, dayIndex, dayKey, tripDays, dateRange, babyAge, distance, duration, ENTRY_TYPES, STOP_TYPES, EXPENSE_CATEGORIES, BABY_TAGS, BABY_LOG_TYPES } = F;

function viewExpense(e, tz, home) {
  return { ...e, amount: money(e.amountMinor, e.currency, { showCode: true }), home: e.currency !== home ? money(e.amountHomeMinor, home) : "", cat: EXPENSE_CATEGORIES[e.category] || EXPENSE_CATEGORIES.OTHER, time: fmt.time(e.paidAt, tz) };
}
function viewPhoto(p) {
  return { ...p, thumb: imageSrc(p.thumbUrl), full: imageSrc(p.url) };
}
function viewEntry(e, tz, home) {
  const t = ENTRY_TYPES[e.type] || ENTRY_TYPES.MOMENT;
  const metaText = e.meta ? Object.keys(e.meta).filter((k) => e.meta[k] !== "" && e.meta[k] != null).map((k) => `${(t.fields.find((f) => f.key === k) || { label: k }).label}：${e.meta[k]}`).join(" · ") : "";
  return { ...e, cfg: t, time: fmt.time(e.startAt, tz), endTime: e.endAt ? fmt.time(e.endAt, tz) : "", metaText, expenses: e.expenses.map((x) => viewExpense(x, tz, home)), photos: e.photos.map(viewPhoto) };
}
function viewStop(s, tripTz, home) {
  const tz = s.timezone || tripTz;
  return {
    ...s,
    cfg: STOP_TYPES[s.type] || STOP_TYPES.OTHER,
    arrive: fmt.time(s.arriveAt, tz),
    leave: s.leaveAt ? fmt.time(s.leaveAt, tz) : "",
    tags: (s.babyTags || []).map((k) => BABY_TAGS[k] || k),
    weatherText: s.weather && s.weather.weather ? `${s.weather.weather}${s.weather.temperature ? ` ${s.weather.temperature}°` : ""}` : "",
    leg: s.legFromPrev ? `${s.legFromPrev.mode === "WALKING" ? "🚶" : s.legFromPrev.mode === "DRIVING" ? "🚗" : "📏"} ${distance(s.legFromPrev.distanceM)}${s.legFromPrev.durationS ? ` · ${duration(s.legFromPrev.durationS)}` : ""}` : "",
    entries: s.entries.map((e) => viewEntry(e, tz, home)),
    expenses: s.expenses.map((e) => viewExpense(e, tz, home)),
    photos: s.photos.map(viewPhoto),
  };
}
function sumExpenses(list) {
  return list.reduce((a, e) => a + e.amountHomeMinor, 0);
}

/** 把详情拆成按天的时间线 */
function buildDays(d) {
  const trip = d.trip;
  const tz = trip.timezone;
  const n = tripDays(trip.startDate, trip.endDate);
  const notes = {};
  d.dailyNotes.forEach((x) => (notes[F.dateOnly(x.date).key] = x));
  const days = [];
  for (let i = 1; i <= n; i++) {
    const key = dayKey(trip.startDate, i);
    const dateUtc = new Date(`${key}T00:00:00Z`);
    days.push({ index: i, key, label: `${F.dateOnly(dateUtc).m}月${F.dateOnly(dateUtc).d}日`, weekday: fmt.weekday(new Date(`${key}T12:00:00Z`), "UTC"), note: notes[key] ? notes[key].content : "", aiDraft: notes[key] ? notes[key].aiDraft : "", stops: [], entries: [], expenses: [], photos: [], babyLogs: [], subtotal: 0 });
  }
  const other = { index: 0, key: "", label: "旅程之外", weekday: "", note: "", stops: [], entries: [], expenses: [], photos: [], babyLogs: [], subtotal: 0 };
  const bucket = (at, zone) => {
    const idx = dayIndex(trip.startDate, at, zone || tz);
    return idx >= 1 && idx <= n ? days[idx - 1] : other;
  };
  d.stops.forEach((s) => {
    const v = viewStop(s, tz, trip.homeCurrency);
    const day = bucket(s.arriveAt, s.timezone || tz);
    day.stops.push(v);
    day.subtotal += sumExpenses(s.expenses) + s.entries.reduce((a, e) => a + sumExpenses(e.expenses), 0);
  });
  d.looseEntries.forEach((e) => {
    const day = bucket(e.startAt);
    day.entries.push(viewEntry(e, tz, trip.homeCurrency));
    day.subtotal += sumExpenses(e.expenses);
  });
  d.looseExpenses.forEach((e) => {
    const day = bucket(e.paidAt);
    day.expenses.push(viewExpense(e, tz, trip.homeCurrency));
    day.subtotal += e.amountHomeMinor;
  });
  d.loosePhotos.forEach((p) => bucket(p.takenAt || p.createdAt || trip.startDate).photos.push(viewPhoto(p)));
  d.babyLogs.forEach((b) => bucket(b.at).babyLogs.push({ ...b, cfg: BABY_LOG_TYPES[b.type] || BABY_LOG_TYPES.OTHER, time: fmt.time(b.at, tz) }));
  const all = [...days, other].map((day) => ({
    ...day,
    subtotalText: day.subtotal ? money(day.subtotal, trip.homeCurrency) : "",
    empty: !day.stops.length && !day.entries.length && !day.expenses.length && !day.photos.length && !day.babyLogs.length && !day.note,
  }));
  return all.filter((day) => day.index > 0 || !day.empty);
}

Page({
  data: { id: "", detail: null, trip: null, days: [], loading: true, canEdit: false, sheet: false, entryTypes: F.ENTRY_TYPE_ORDER.map((k) => ({ key: k, ...ENTRY_TYPES[k] })), babyTypes: F.BABY_LOG_ORDER.map((k) => ({ key: k, ...BABY_LOG_TYPES[k] })), uploading: "", pending: 0, pendingItems: [], syncing: false },

  onLoad(q) {
    this.setData({ id: q.id });
    this.load();
    this.unwatch = offline.onChange(() => this.refreshPending());
  },
  onUnload() { if (this.unwatch) this.unwatch(); },
  refreshPending() {
    const items = offline.read().filter((x) => x.tripId === this.data.id);
    this.setData({ pending: items.length, pendingItems: items });
  },
  async sync() {
    if (this.data.syncing) return;
    this.setData({ syncing: true });
    const r = await offline.replay();
    this.setData({ syncing: false });
    if (r.applied) { wx.showToast({ title: `已同步 ${r.applied} 条`, icon: "success" }); this.load(true); }
    else if (r.rejected) wx.showToast({ title: "有记录被服务器拒绝，请检查", icon: "none" });
    else if (r.stopped) wx.showToast({ title: "还没有网络", icon: "none" });
    this.refreshPending();
  },
  pendingDetail() {
    const items = this.data.pendingItems;
    wx.showActionSheet({
      itemList: items.slice(0, 6).map((x) => `${x.error ? "⚠️ " : ""}${x.label}${x.error ? `：${x.error}` : ""}`),
      success: (r) => {
        const it = items[r.tapIndex];
        wx.showModal({ title: "离线记录", content: it.error ? `服务器拒绝：${it.error}\n\n可以删除后重新填写。` : "联网后会自动同步。", confirmText: "删除", confirmColor: "#FF3B30", cancelText: "保留", success: (m) => { if (m.confirm) { offline.remove(it.clientId); } } });
      },
    });
  },
  onShow() {
    const app = getApp();
    this.refreshPending();
    if (this.data.detail && app.globalData.tripDirty === this.data.id) {
      app.globalData.tripDirty = "";
      this.load(true);
    }
  },
  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },
  onShareAppMessage() {
    return { title: this.data.trip ? this.data.trip.title : "Trace 旅程", path: `/pages/trip/trip?id=${this.data.id}` };
  },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const d = await api.tripDetail(this.data.id);
      const t = d.trip;
      const trip = {
        ...t,
        cover: t.coverUrl ? imageSrc(t.coverUrl) : "",
        range: dateRange(t.startDate, t.endDate),
        days: tripDays(t.startDate, t.endDate),
        age: t.babyBirthDate ? babyAge(t.babyBirthDate, t.startDate) : "",
        total: d.totalHomeMinor ? money(d.totalHomeMinor, t.homeCurrency, { compact: true }) : "",
        distanceText: d.totalDistanceM ? distance(d.totalDistanceM) : "",
        stopCount: d.stops.length,
      };
      wx.setNavigationBarTitle({ title: t.title });
      this.setData({ detail: d, trip, days: buildDays(d), canEdit: t.role !== "VIEWER" });
    } catch (e) {
      if (e.status === 404) setTimeout(() => wx.navigateBack(), 800);
    } finally {
      this.setData({ loading: false });
    }
  },

  // ─── 导航 ───
  go(e) {
    const { page } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/${page}/${page}?id=${this.data.id}` });
  },
  openRecord(e) {
    const { kind, ref } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/record/record?tripId=${this.data.id}&kind=${kind}&refId=${ref}` });
  },
  openNote(e) {
    const { date } = e.currentTarget.dataset;
    if (!date) return;
    wx.navigateTo({ url: `/pages/note/note?tripId=${this.data.id}&date=${date}` });
  },
  previewPhoto(e) {
    const { url, group } = e.currentTarget.dataset;
    const day = this.data.days.find((d) => d.key === group || String(d.index) === String(group));
    const urls = [];
    if (day) {
      day.stops.forEach((s) => { s.photos.forEach((p) => urls.push(p.full)); s.entries.forEach((en) => en.photos.forEach((p) => urls.push(p.full))); });
      day.entries.forEach((en) => en.photos.forEach((p) => urls.push(p.full)));
      day.photos.forEach((p) => urls.push(p.full));
    }
    wx.previewImage({ current: url, urls: urls.length ? urls : [url] });
  },
  openAi() {
    wx.navigateTo({ url: `/pages/ai/ai?tripId=${this.data.id}` });
  },
  more() {
    const items = ["编辑旅程", "出行清单", "家人与分享", "旅程总结长图", "旅程整理", "AI 写游记"];
    wx.showActionSheet({
      itemList: items,
      success: async (r) => {
        const pages = ["trip-form", "checklist", "members"];
        if (r.tapIndex < 3) return wx.navigateTo({ url: `/pages/${pages[r.tapIndex]}/${pages[r.tapIndex]}?id=${this.data.id}` });
        if (r.tapIndex === 3) return wx.navigateTo({ url: `/pages/summary/summary?id=${this.data.id}` });
        if (r.tapIndex === 4) return this.tidy();
        if (r.tapIndex === 5) return this.summary();
      },
    });
  },
  async tidy() {
    wx.showLoading({ title: "正在检查…" });
    try {
      const report = await api.tidy(this.data.id);
      wx.hideLoading();
      if (!report.count) return wx.showToast({ title: "记录很整齐，没有需要处理的", icon: "none" });
      const lines = [];
      if (report.duplicates.length) lines.push(`重复账单 ${report.duplicates.length} 组`);
      if (report.unreviewed.length) lines.push(`AI 待核对 ${report.unreviewed.length} 条`);
      if (report.missing.length) lines.push(`缺关联地点 ${report.missing.length} 条`);
      if (report.failedPhotos.length) lines.push(`照片待识别 ${report.failedPhotos.length} 张`);
      wx.showModal({
        title: "旅程整理",
        content: `${lines.join("\n")}\n\n一键整理会按时间把记录归到站点并重试照片识别。`,
        confirmText: "一键整理",
        success: async (m) => {
          if (!m.confirm) return;
          wx.showLoading({ title: "整理中…" });
          try {
            const r = await api.autoTidy(this.data.id);
            wx.hideLoading();
            wx.showToast({ title: `关联 ${r.linked} 条，重试识别 ${r.analyzed} 张`, icon: "none" });
            this.load(true);
          } catch (e) { wx.hideLoading(); }
        },
      });
    } catch (e) {
      wx.hideLoading();
    }
  },
  async summary() {
    wx.showLoading({ title: "AI 正在写…" });
    try {
      const r = await api.aiSummary(this.data.id);
      wx.hideLoading();
      wx.showModal({ title: "游记", content: r.text, confirmText: "复制", cancelText: "关闭", success: (m) => m.confirm && wx.setClipboardData({ data: r.text }) });
    } catch (e) { wx.hideLoading(); }
  },

  // ─── 快速记录 ───
  openSheet() { this.setData({ sheet: true }); },
  closeSheet() { this.setData({ sheet: false }); },
  noop() {},
  quick(e) {
    const { kind, type } = e.currentTarget.dataset;
    this.setData({ sheet: false });
    const id = this.data.id;
    if (kind === "stop") return wx.navigateTo({ url: `/pages/stop-form/stop-form?id=${id}` });
    if (kind === "expense") return wx.navigateTo({ url: `/pages/expense-form/expense-form?id=${id}` });
    if (kind === "photo") return this.uploadPhotos();
    if (kind === "baby") return wx.navigateTo({ url: `/pages/baby-log/baby-log?id=${id}` });
    if (kind === "entry") return wx.navigateTo({ url: `/pages/entry-form/entry-form?id=${id}&type=${type}` });
  },
  async uploadPhotos() {
    try {
      const r = await pickAndUpload({ tripId: this.data.id }, { onProgress: (done, total) => this.setData({ uploading: `上传中 ${done}/${total}` }) });
      this.setData({ uploading: "" });
      if (r.results.length) wx.showToast({ title: `已上传 ${r.results.length} 张`, icon: "success" });
      if (r.failures.length) wx.showToast({ title: r.failures[0], icon: "none" });
      if (r.results.length) { getApp().markDirty(); this.load(true); }
    } catch (e) {
      this.setData({ uploading: "" });
      wx.showToast({ title: e.message || "上传失败", icon: "none" });
    }
  },
});
