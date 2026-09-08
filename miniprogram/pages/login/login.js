const api = require("../../utils/api");
const { setToken, baseUrl } = require("../../utils/request");
const { DEFAULT_BASE_URL } = require("../../config");

Page({
  data: { mode: "login", email: "", password: "", name: "", busy: false, error: "", server: "", statusBarHeight: 44 },

  onLoad() {
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ statusBarHeight: sys.statusBarHeight || 44, server: baseUrl() });
  },

  onInput(e) {
    this.setData({ [e.currentTarget.dataset.key]: e.detail.value, error: "" });
  },
  switchMode() {
    this.setData({ mode: this.data.mode === "login" ? "signup" : "login", error: "" });
  },

  async submit() {
    const { mode, email, password, name, busy } = this.data;
    if (busy) return;
    if (!email.trim() || !password) return this.setData({ error: "请填写邮箱和密码" });
    if (mode === "signup" && !name.trim()) return this.setData({ error: "请填写昵称" });
    this.setData({ busy: true, error: "" });
    try {
      // 登录时顺便带上 wx.login 的 code，服务端绑定微信后下次可一键登录
      const wxCode = mode === "login" ? await new Promise((resolve) => wx.login({ success: (r) => resolve(r.code), fail: () => resolve("") })) : "";
      const r = mode === "login" ? await api.login(email.trim(), password, "微信小程序", wxCode) : await api.signup(email.trim(), password, name.trim());
      setToken(r.token);
      if (r.wechatBound) wx.showToast({ title: "已绑定微信，下次自动登录", icon: "none" });
      getApp().globalData.user = r.user;
      wx.reLaunch({ url: "/pages/trips/trips" });
    } catch (e) {
      this.setData({ error: e.message || "登录失败" });
    } finally {
      this.setData({ busy: false });
    }
  },

  changeServer() {
    wx.showModal({
      title: "服务器地址",
      editable: true,
      placeholderText: DEFAULT_BASE_URL,
      content: this.data.server,
      success: (r) => {
        if (!r.confirm) return;
        const v = (r.content || "").trim().replace(/\/$/, "");
        if (v && !/^https?:\/\//.test(v)) return wx.showToast({ title: "请以 http(s):// 开头", icon: "none" });
        if (v) wx.setStorageSync("baseUrl", v);
        else wx.removeStorageSync("baseUrl");
        this.setData({ server: baseUrl() });
      },
    });
  },
});
