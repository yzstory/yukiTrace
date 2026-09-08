const api = require("../../utils/api");
const F = require("../../utils/format");
const offline = require("../../utils/offline");

let searchTimer = null;

Page({
  data: {
    id: "", tz: "Asia/Shanghai", busy: false,
    q: "", results: [], searching: false, configured: true,
    place: null, // { name, lat, lng, address, city, amapPoiId }
    form: { name: "", type: "OTHER", arriveDate: "", arriveTime: "", leaveDate: "", leaveTime: "", note: "", babyTags: [] },
    types: F.STOP_TYPE_ORDER.map((k) => ({ key: k, ...F.STOP_TYPES[k] })),
    tagList: Object.keys(F.BABY_TAGS).map((k) => ({ key: k, label: F.BABY_TAGS[k] })),
  },

  async onLoad(q) {
    this.setData({ id: q.id });
    try {
      const { trip } = await api.tripDetail(q.id);
      const tz = trip.timezone;
      const now = F.nowInput(tz).split("T");
      this.setData({ tz, "form.arriveDate": now[0], "form.arriveTime": now[1] });
    } catch (e) { /* */ }
  },

  // ─── 搜索 / 定位 ───
  onSearch(e) {
    const q = e.detail.value;
    this.setData({ q });
    clearTimeout(searchTimer);
    if (!q.trim()) return this.setData({ results: [] });
    searchTimer = setTimeout(() => this.search(q.trim()), 350);
  },
  async search(q) {
    this.setData({ searching: true });
    try {
      const r = await api.searchPlace(q);
      if (this.data.q.trim() !== q) return;
      this.setData({ results: r.results || [], configured: r.configured !== false });
    } catch (e) { /* */ } finally { this.setData({ searching: false }); }
  },
  pick(e) {
    const p = this.data.results[e.currentTarget.dataset.index];
    this.setData({ place: { name: p.name, lat: p.lat, lng: p.lng, address: p.address, city: p.city, amapPoiId: p.id }, "form.name": this.data.form.name || p.name, results: [], q: "" });
  },
  locate() {
    wx.getLocation({
      type: "gcj02",
      success: (r) => this.setData({ place: { name: this.data.form.name || "当前位置", lat: r.latitude, lng: r.longitude, address: "", city: "" } }),
      fail: () => wx.showModal({ title: "无法获取位置", content: "请在设置里允许小程序使用位置信息，或用搜索选择地点。", showCancel: false }),
    });
  },
  chooseOnMap() {
    wx.chooseLocation({
      success: (r) => this.setData({ place: { name: r.name || this.data.form.name, lat: r.latitude, lng: r.longitude, address: r.address || "", city: "" }, "form.name": this.data.form.name || r.name || "" }),
      fail: () => {},
    });
  },
  clearPlace() { this.setData({ place: null }); },

  // ─── 表单 ───
  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onPick(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  setType(e) { this.setData({ "form.type": e.currentTarget.dataset.key }); },
  toggleTag(e) {
    const k = e.currentTarget.dataset.key;
    const tags = this.data.form.babyTags.includes(k) ? this.data.form.babyTags.filter((x) => x !== k) : [...this.data.form.babyTags, k];
    this.setData({ "form.babyTags": tags });
  },
  clearLeave() { this.setData({ "form.leaveDate": "", "form.leaveTime": "" }); },

  async submit() {
    const { form, place, id, busy } = this.data;
    if (busy) return;
    if (!form.name.trim()) return wx.showToast({ title: "请填写地点名称", icon: "none" });
    if (!place) return wx.showToast({ title: "请搜索或定位一个位置", icon: "none" });
    this.setData({ busy: true });
    try {
      const payload = {
        name: form.name.trim(), type: form.type, lat: place.lat, lng: place.lng, address: place.address || "", city: place.city || "", amapPoiId: place.amapPoiId || "",
        arriveAt: `${form.arriveDate}T${form.arriveTime}`,
        leaveAt: form.leaveDate ? `${form.leaveDate}T${form.leaveTime || "23:59"}` : "",
        note: form.note, babyTags: form.babyTags,
      };
      try {
        await api.createStop(id, payload);
      } catch (e) {
        if (!offline.isOffline(e)) {
          wx.showToast({ title: e.message || "保存失败", icon: "none", duration: 2500 });
          return;
        }
        offline.enqueue("stop", id, payload, form.name.trim());
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
