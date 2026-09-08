const { getToken, setToken } = require("./utils/request");
const api = require("./utils/api");
const offline = require("./utils/offline");

App({
  globalData: { user: null, tripsDirty: false, tripDirty: "" },

  onLaunch() {
    // 网络恢复时自动回放离线队列
    offline.watch((r) => {
      wx.showToast({ title: `已同步 ${r.applied} 条离线记录`, icon: "none" });
      this.markDirty();
    });
    if (getToken()) {
      this.loadUser();
      offline.replay();
      return;
    }
    this.wechatLogin();
  },

  /** 微信一键登录：已绑定直接进；未绑定或服务器未配置则去登录页 */
  async wechatLogin() {
    try {
      const code = await new Promise((resolve, reject) => wx.login({ success: (r) => resolve(r.code), fail: reject }));
      const r = await api.wechatLogin(code);
      if (r && r.bound && r.token) {
        setToken(r.token);
        this.globalData.user = r.user;
        wx.reLaunch({ url: "/pages/trips/trips" });
        return;
      }
    } catch (e) {
      /* 未配置 / 网络问题都退回邮箱登录 */
    }
    wx.reLaunch({ url: "/pages/login/login" });
  },

  async loadUser() {
    try {
      this.globalData.user = await api.me();
    } catch (e) {
      /* 401 时 request 已跳回登录页 */
    }
    return this.globalData.user;
  },

  /** 记录有变更后标记，旅程列表 onShow 时刷新 */
  markDirty() {
    this.globalData.tripsDirty = true;
  },
});
