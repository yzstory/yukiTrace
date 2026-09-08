# Trace 微信小程序

网页版的原生小程序客户端（WXML / WXSS / JS，无构建步骤），数据全部走同一套 `/api/v1` JSON 接口，账号、旅程、记录与网页完全互通。

## 导入与运行

1. 打开微信开发者工具 → 导入项目 → 目录选 `miniprogram/`，AppID 填自己的（或先用测试号）。
2. 开发阶段在「详情 → 本地设置」勾选 **不校验合法域名、web-view、TLS 版本以及 HTTPS 证书**。
3. 修改 `config.js` 里的 `DEFAULT_BASE_URL` 指向服务器，或在登录页 / 「我」页点「服务器地址」临时修改（存在本机）。
4. 用网页版的邮箱密码登录；未注册时可在登录页注册（服务器 `ALLOW_SIGNUP=false` 时会提示未开放）。

本地联调时把服务器地址改成 `http://<你的局域网 IP>:3000`，真机预览也能访问电脑上的 `pnpm dev`。

## 上线前必须做的

| 事项 | 说明 |
|---|---|
| HTTPS | 小程序 request / uploadFile / downloadFile 合法域名只能是 HTTPS。生产目前是 `http://trace.aiyuki.cc`，需要先配证书。 |
| 合法域名 | 微信公众平台 → 开发管理 → 开发设置：request、uploadFile、downloadFile 三类都加上服务器域名。 |
| 地图 | 使用微信内置 `<map>`（腾讯地图，GCJ-02），与高德坐标一致，不需要额外 Key。地点搜索仍走服务器 `/api/amap/search`。 |
| 定位 | `app.json` 已声明 `getLocation` 与 `scope.userLocation` 用途；上线审核需在后台开通「位置信息」接口权限。 |
| 分享 | 旅程页、护照页、年度回顾支持转发。邀请家人建议用「转发」发小程序卡片（点开直接进 `pages/invite` 加入）；复制出来的仍是网页链接，粘贴到小程序里也能识别。只读分享链接是网页链接，给不装小程序的人看。 |

## 页面

| 页面 | 路径 | 接口 |
|---|---|---|
| 登录 / 注册 | `pages/login` | `POST /auth/login`、`/auth/signup` |
| 旅程（Tab） | `pages/trips` | `GET /trips` |
| 足迹（Tab） | `pages/footprint` | `GET /footprint`（本次新增） |
| 我（Tab） | `pages/me` | `GET /me`、`/passport`、`/tokens`、`/years`、`/growth`、`/auth/wechat` |
| 旅程时间线 | `pages/trip` | `GET /trips/{id}`，整理 `/tidy`，游记 `/ai/summary` |
| 地图 / 账本 / 照片 | `pages/trip-map`、`trip-ledger`、`trip-photos` | 均由 `GET /trips/{id}` 派生 |
| 新建 / 编辑旅程 | `pages/trip-form` | `POST/PUT/DELETE /trips`，封面 `/api/upload?purpose=cover` |
| 地点 / 条目 / 花费 / 宝宝 / 日记 | `pages/stop-form`、`entry-form`、`expense-form`、`baby-log`、`note` | 对应写接口；日记 AI 草稿 `/ai/daily-draft` |
| 记录详情（改 / 删 / 历史 / 撤销） | `pages/record` | `/records/{kind}/{refId}`、`/confirm`、`/activities/{id}/undo` |
| 清单 | `pages/checklist` | `/checklist*`、`/ai/packing-list` |
| 家人与分享 | `pages/members` | `/members*`、`/invites*`、`/share-links*`；邀请可「转发」成小程序卡片 |
| 接受邀请 | `pages/invite` | `GET /invites/{token}`（免登录预览）、`POST /invites/{token}`；支持卡片进入与粘贴链接 |
| 护照 | `pages/passport` | `GET /passport`、`POST /passport/stamps` |
| AI 助手 | `pages/ai` | `POST /api/ai/chat`（`enableChunked` 流式，解析 UI Message Stream）、语音 `/api/ai/transcribe` |
| 年度回顾 / 旅程总结 | `pages/year`、`pages/summary` | `GET /years/{year}`、`GET /trips/{id}/summary` |

## 与接口的约定

- 令牌 `tra_…` 存在 `wx.storage`，所有请求带 `Authorization: Bearer`；401 自动清除并回登录页（`utils/request.js`）。
- 图片：接口返回的 `/api/files/...` 相对地址由 `imageSrc()` 补成绝对地址并追加 `?token=`，因为 `<image>` 无法自定义 header（服务端 `/api/files` 为此接受查询参数令牌）。
- 时间：表单一律提交当地时间 `YYYY-MM-DDTHH:mm`；展示时按旅程 / 站点时区用 `Intl` 换算，无 `Intl` 的机型退回固定偏移表（`utils/format.js`）。
- 金额：提交原币常规单位，展示用服务端返回的最小单位整数换算。
- 照片上传 `wx.uploadFile` 一次一张（字段名 `files`），选图时已用微信压缩；AI 对话附图走 base64 data URL，最多 6 张。

## 目录

```text
miniprogram/
  app.js / app.json / app.wxss   入口、Tab、设计系统（iOS 系统色、圆角卡片、字号）
  config.js                      服务器地址
  utils/request.js               请求封装、令牌、图片地址
  utils/api.js                   /api/v1 接口一览
  utils/format.js                币种 / 类型 / 分类常量与时区格式化
  utils/upload.js                选图上传、图片转 data URL
  utils/stream.js                AI 对话 SSE 解析
  utils/offline.js               离线队列（/api/sync 回放）
  utils/voice.js                 按住说话（录音 → 转写）
  theme.json                     深色 / 浅色导航栏与 Tab 配色
  pages/…                        22 个页面
  assets/                        Tab 图标与地图标记
```

## 补齐的能力

| 能力 | 实现 |
|---|---|
| 微信一键登录 | 启动时 `wx.login` → `POST /auth/wechat`；首次用邮箱密码登录时附带 `wxCode` 自动绑定；「我」页可解绑。服务器需配置 `WECHAT_APPID / WECHAT_SECRET` |
| 年度回顾 | `pages/year`，`GET /years`、`/years/{year}`（含 AI 写给宝宝的信） |
| 旅程总结长图 | `pages/summary`，`GET /trips/{id}/summary`；Canvas 2D 画 1080×1350 卡片保存到相册（图片域名需加入 downloadFile 合法域名） |
| 成长对照 | 「我」页，`GET /growth` |
| 语音输入 | AI 页 🎤 切换后按住说话，`RecorderManager`（mp3）→ `POST /api/ai/transcribe`；服务器需配置 `AI_TRANSCRIBE_MODEL` |
| 离线队列 | `utils/offline.js`：地点 / 条目 / 花费 / 宝宝状态提交遇到无网络时存本机，网络恢复自动回放 `POST /api/sync`；旅程页显示待同步数，可手动同步、查看被拒原因并删除 |
| 深色模式 | `darkmode: true` + `theme.json`（导航栏 / Tab）+ `app.wxss` 里 `prefers-color-scheme: dark` 只换 CSS 变量 |

## 仍未覆盖（有意为之）

| 网页有 | 为什么不搬 |
|---|---|
| 打印版相册 `/trips/{id}/album` | 依赖浏览器「打印 / 存为 PDF」，小程序没有对应能力；总结长图已覆盖「留一份下来」的需求 |
| MCP 令牌新建 / 撤销 | 开发者功能，家人日常用不到；「我」页可只读查看已有令牌 |
| CSV 导出直接下载 | 小程序不能保存任意文件，只提供复制链接到网页打开 |
| HEIC 原图上传 | `wx.chooseMedia` 已把 iPhone 照片转成 JPG |
