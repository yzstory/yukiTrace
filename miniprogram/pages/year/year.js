const api = require("../../utils/api");
const { imageSrc } = require("../../utils/request");

Page({
  data: { year: 0, years: [], review: null, loading: true, error: "" },

  onLoad(q) {
    const year = Number(q.year) || new Date().getFullYear();
    this.setData({ year });
    api.years().then((r) => this.setData({ years: r.years || [] })).catch(() => {});
    this.load(year);
  },
  async load(year) {
    this.setData({ loading: true, error: "", review: null, year });
    wx.setNavigationBarTitle({ title: `${year} 年回顾` });
    try {
      const r = await api.yearReview(year);
      this.setData({
        review: { ...r, photos: (r.highlightPhotos || []).map(imageSrc), trips: r.trips.map((t) => ({ ...t, cover: t.cover ? imageSrc(t.cover) : "" })), cityText: r.cities.slice(0, 8).join(" · ") },
      });
    } catch (e) {
      this.setData({ error: e.message || "读取失败" });
    } finally {
      this.setData({ loading: false });
    }
  },
  pick(e) { this.load(Number(e.currentTarget.dataset.year)); },
  openTrip(e) { wx.navigateTo({ url: `/pages/trip/trip?id=${e.currentTarget.dataset.id}` }); },
  preview(e) { wx.previewImage({ current: e.currentTarget.dataset.url, urls: this.data.review.photos }); },
  copyLetter() { if (this.data.review && this.data.review.letter) wx.setClipboardData({ data: this.data.review.letter }); },
  onShareAppMessage() { return { title: `${this.data.year} 年，我们一家走过 ${this.data.review ? this.data.review.cityCount : 0} 座城市`, path: `/pages/year/year?year=${this.data.year}` }; },
});
