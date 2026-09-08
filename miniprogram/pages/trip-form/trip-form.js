const api = require("../../utils/api");
const F = require("../../utils/format");
const { uploadImage } = require("../../utils/upload");
const { imageSrc } = require("../../utils/request");

const CUR_LABELS = F.CURRENCIES.map((c) => `${c.code} ${c.name}`);
const TZ_LABELS = F.TIMEZONES.map((t) => t.label);

Page({
  data: {
    id: "", form: { title: "", startDate: "", endDate: "", homeCurrency: "CNY", timezone: "Asia/Shanghai", babyName: "", babyBirthDate: "", travelers: "", description: "" },
    curIndex: 0, tzIndex: 0, curLabels: CUR_LABELS, tzLabels: TZ_LABELS, busy: false, isOwner: false, cover: "", coverKey: undefined,
  },

  async onLoad(q) {
    if (q.id) {
      this.setData({ id: q.id });
      wx.setNavigationBarTitle({ title: "编辑旅程" });
      wx.showLoading({ title: "读取中" });
      try {
        const { trip } = await api.tripDetail(q.id);
        this.setData({
          form: { title: trip.title, startDate: F.dateOnly(trip.startDate).key, endDate: F.dateOnly(trip.endDate).key, homeCurrency: trip.homeCurrency, timezone: trip.timezone, babyName: trip.babyName || "", babyBirthDate: trip.babyBirthDate ? F.dateOnly(trip.babyBirthDate).key : "", travelers: (trip.travelers || []).join("、"), description: trip.description || "" },
          curIndex: Math.max(0, F.CURRENCY_CODES.indexOf(trip.homeCurrency)),
          tzIndex: Math.max(0, F.TIMEZONES.findIndex((t) => t.value === trip.timezone)),
          isOwner: trip.role === "OWNER",
          cover: trip.coverUrl ? imageSrc(trip.coverUrl) : "",
        });
      } finally {
        wx.hideLoading();
      }
    } else {
      wx.setNavigationBarTitle({ title: "新建旅程" });
      const today = F.fmt.inputDate(new Date());
      this.setData({ "form.startDate": today, "form.endDate": today });
    }
  },

  onInput(e) { this.setData({ [`form.${e.currentTarget.dataset.key}`]: e.detail.value }); },
  onDate(e) {
    const key = e.currentTarget.dataset.key;
    const patch = { [`form.${key}`]: e.detail.value };
    if (key === "startDate" && this.data.form.endDate < e.detail.value) patch["form.endDate"] = e.detail.value;
    this.setData(patch);
  },
  onCurrency(e) { const i = +e.detail.value; this.setData({ curIndex: i, "form.homeCurrency": F.CURRENCY_CODES[i] }); },
  onTimezone(e) { const i = +e.detail.value; this.setData({ tzIndex: i, "form.timezone": F.TIMEZONES[i].value }); },

  async submit() {
    const { form, id, busy } = this.data;
    if (busy) return;
    if (!form.title.trim()) return wx.showToast({ title: "请填写旅程名称", icon: "none" });
    this.setData({ busy: true });
    try {
      const payload = { ...form, travelers: form.travelers.split(/[,，、\s]+/).filter(Boolean) };
      const r = id ? await api.updateTrip(id, payload) : await api.createTrip(payload);
      getApp().markDirty();
      getApp().globalData.tripDirty = r.id;
      if (id) wx.navigateBack();
      else wx.redirectTo({ url: `/pages/trip/trip?id=${r.id}` });
    } catch (e) {
      /* toast 已显示 */
    } finally {
      this.setData({ busy: false });
    }
  },

  changeCover() {
    if (!this.data.id) return wx.showToast({ title: "先保存旅程再设置封面", icon: "none" });
    wx.chooseMedia({
      count: 1, mediaType: ["image"], sizeType: ["compressed"],
      success: async (r) => {
        wx.showLoading({ title: "上传中" });
        try {
          const up = await uploadImage(r.tempFiles[0].tempFilePath, { tripId: this.data.id, purpose: "cover" });
          const key = up.results && up.results[0] && up.results[0].key;
          if (!key) throw new Error((up.failures && up.failures[0]) || "上传失败");
          this.setData({ cover: r.tempFiles[0].tempFilePath });
          getApp().markDirty();
          getApp().globalData.tripDirty = this.data.id;
          wx.showToast({ title: "封面已更新", icon: "success" });
        } catch (e) {
          wx.showToast({ title: e.message, icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  remove() {
    wx.showModal({
      title: "删除旅程", content: "旅程里的地点、花费、照片会一起删除，且无法恢复。", confirmText: "删除", confirmColor: "#FF3B30",
      success: async (r) => {
        if (!r.confirm) return;
        try {
          await api.deleteTrip(this.data.id);
          getApp().markDirty();
          wx.reLaunch({ url: "/pages/trips/trips" });
        } catch (e) { /* toast */ }
      },
    });
  },
});
