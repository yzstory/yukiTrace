const { baseUrl, getToken } = require("./request");

/**
 * 长按录音 → /api/ai/transcribe → 文字。
 * 用法：const v = createVoice({ onText, onState }); 按下 v.start()，松开 v.stop()，滑出 v.cancel()
 */
function createVoice({ onText, onState, onError }) {
  const rm = wx.getRecorderManager();
  let cancelled = false;
  let startedAt = 0;
  const state = (s) => onState && onState(s);

  rm.onStart(() => { startedAt = Date.now(); state("recording"); });
  rm.onError((e) => { state("idle"); onError && onError((e && e.errMsg && /auth/i.test(e.errMsg)) ? "请允许小程序使用麦克风" : "录音失败"); });
  rm.onStop((res) => {
    if (cancelled) { state("idle"); return; }
    if (Date.now() - startedAt < 800 || !res.tempFilePath) { state("idle"); onError && onError("按住说话，说完再松开"); return; }
    state("transcribing");
    wx.uploadFile({
      url: `${baseUrl()}/api/ai/transcribe`,
      filePath: res.tempFilePath,
      name: "audio",
      formData: { language: "zh" },
      header: { authorization: `Bearer ${getToken()}` },
      timeout: 60000,
      success: (r) => {
        let body = r.data;
        try { body = JSON.parse(body); } catch (e) { /* */ }
        state("idle");
        if (r.statusCode >= 200 && r.statusCode < 300 && body && body.text) onText && onText(body.text);
        else onError && onError((body && body.error) || `识别失败（${r.statusCode}）`);
      },
      fail: () => { state("idle"); onError && onError("网络不可用"); },
    });
  });

  return {
    start() {
      cancelled = false;
      wx.authorize({
        scope: "scope.record",
        success: () => rm.start({ format: "mp3", duration: 60000, sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 48000 }),
        fail: () => wx.showModal({ title: "需要麦克风权限", content: "请在设置里允许小程序使用麦克风。", confirmText: "去设置", success: (r) => r.confirm && wx.openSetting() }),
      });
    },
    stop() { rm.stop(); },
    cancel() { cancelled = true; rm.stop(); },
  };
}

module.exports = { createVoice };
