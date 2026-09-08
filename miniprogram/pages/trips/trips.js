const api = require("../../utils/api");
const { imageSrc } = require("../../utils/request");
const { money, dateRange, tripDays, babyAge } = require("../../utils/format");

function decorate(t) {
  const days = tripDays(t.startDate, t.endDate);
  return {
    ...t,
    cover: t.coverUrl ? imageSrc(t.coverUrl) : "",
    range: dateRange(t.startDate, t.endDate),
    days,
    total: t.totalHomeMinor ? money(t.totalHomeMinor, t.homeCurrency, { compact: true }) : "",
    age: t.babyBirthDate ? babyAge(t.babyBirthDate, t.startDate) : null,
    cityText: (t.cities || []).slice(0, 3).join(" · "),
    ongoing: isOngoing(t),
  };
}
function isOngoing(t) {
  const now = Date.now();
  return new Date(t.startDate).getTime() - 86400000 <= now && now <= new Date(t.endDate).getTime() + 86400000 * 2;
}

Page({
  data: { trips: [], loading: true, loaded: false, user: null },

  onLoad() {
    this.load();
  },
  onShow() {
    const app = getApp();
    if (this.data.loaded && app.globalData.tripsDirty) {
      app.globalData.tripsDirty = false;
      this.load(true);
    }
    if (app.globalData.user) this.setData({ user: app.globalData.user });
  },
  async onPullDownRefresh() {
    await this.load(true);
    wx.stopPullDownRefresh();
  },

  async load(silent) {
    if (!silent) this.setData({ loading: true });
    try {
      const { trips } = await api.trips();
      this.setData({ trips: trips.map(decorate), loaded: true });
    } catch (e) {
      /* toast 已由 request 处理 */
    } finally {
      this.setData({ loading: false });
    }
  },

  open(e) {
    wx.navigateTo({ url: `/pages/trip/trip?id=${e.currentTarget.dataset.id}` });
  },
  create() {
    wx.navigateTo({ url: "/pages/trip-form/trip-form" });
  },
  openAi() {
    wx.navigateTo({ url: "/pages/ai/ai" });
  },
});
