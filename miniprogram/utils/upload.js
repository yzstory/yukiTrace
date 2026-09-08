const { baseUrl, getToken } = require("./request");

/**
 * 上传一张图片到 /api/upload（multipart 字段名 files）。
 * purpose: photo | cover | receipt；返回 { results, failures }
 */
function uploadImage(filePath, { tripId, stopId, entryId, purpose = "photo" }) {
  const formData = { tripId, purpose };
  if (stopId) formData.stopId = stopId;
  if (entryId) formData.entryId = entryId;
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${baseUrl()}/api/upload`,
      filePath,
      name: "files",
      formData,
      header: { authorization: `Bearer ${getToken()}` },
      timeout: 120000,
      success: (res) => {
        let body = res.data;
        try { body = JSON.parse(body); } catch (e) { /* 非 JSON */ }
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve(body);
        reject(new Error((body && body.error) || `上传失败（${res.statusCode}）`));
      },
      fail: (err) => reject(new Error(/timeout/i.test(err.errMsg || "") ? "上传超时" : "网络不可用")),
    });
  });
}

/** 选图（相册/相机）并压缩后逐张上传；onProgress(done, total) */
async function pickAndUpload(opts, { count = 9, sourceType = ["album", "camera"], onProgress } = {}) {
  const chosen = await new Promise((resolve, reject) => {
    wx.chooseMedia({ count, mediaType: ["image"], sourceType, sizeType: ["compressed"], success: resolve, fail: reject });
  }).catch((e) => {
    if (/cancel/i.test((e && e.errMsg) || "")) return null;
    throw e;
  });
  if (!chosen || !chosen.tempFiles.length) return { results: [], failures: [] };
  const all = { results: [], failures: [] };
  for (let i = 0; i < chosen.tempFiles.length; i++) {
    const f = chosen.tempFiles[i];
    try {
      const r = await uploadImage(f.tempFilePath, opts);
      all.results.push(...(r.results || []));
      all.failures.push(...(r.failures || []));
    } catch (e) {
      all.failures.push(e.message);
    }
    if (onProgress) onProgress(i + 1, chosen.tempFiles.length);
  }
  return all;
}

/** 把本地图片读成 data URL（给 AI 对话附件用），超过 6MB 的先压缩 */
function toDataUrl(filePath) {
  const fs = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    const read = (path) =>
      fs.readFile({
        filePath: path,
        encoding: "base64",
        success: (r) => resolve(`data:image/jpeg;base64,${r.data}`),
        fail: reject,
      });
    wx.compressImage({ src: filePath, quality: 70, compressedWidth: 1600, success: (r) => read(r.tempFilePath), fail: () => read(filePath) });
  });
}

module.exports = { uploadImage, pickAndUpload, toDataUrl };
