# 发现与决策

## 需求
- 产品定位：带娃旅行的「记录」工具（日记 + 账本），不是行程规划工具
- 记录类型：航班、租车、火车/打车、住宿、餐食、游玩、购物、花费、照片、备注、「此刻」
- 地点录入 + 地图展示 + 与上一站的距离/时长
- 多币种，主币种 CNY，其他外币自动折算
- 苹果风视觉与交互，移动端优先
- 以后开放给朋友注册（多用户）；先做网页，之后可能做 App
- AI：对接 OpenAI 兼容接口即可
- 带娃专属：宝宝状态打卡、装备清单、婴儿友好标签、成长对照
- 回顾：总结页、分享链接、导出

## 研究发现
- 高德 JS API 2.0 官方推荐用 `@amap/amap-jsapi-loader` 动态加载；需在控制台申请 Web 端(JS API) Key，2021 年后新 Key 需配安全密钥（securityJsCode）
- 高德 Web 服务 API（路径规划 `/v3/direction/driving`、`/v5/direction/driving`、天气 `/v3/weather/weatherInfo`、POI 搜索）需要单独的 Web 服务 Key，应只在服务端调用
- 阿里云 OSS 浏览器直传：服务端用 STS AssumeRole 发临时凭证，前端用 `ali-oss` SDK 直传；或服务端签 PostObject policy。图片缩略图可用 OSS 图片处理参数 `?x-oss-process=image/resize,w_400`
- Vercel AI SDK 的 `@ai-sdk/openai-compatible` 可通过 `createOpenAICompatible({ baseURL, apiKey })` 接任意 OpenAI 风格接口，支持 `generateText` / `streamText` / tool calling / `generateObject`（结构化输出）
- 直接用官方 `openai` npm 包也可以，配 `baseURL` 即可，但 AI SDK 在 Next.js 流式 UI 与工具调用上封装更好
- EXIF 读取用 `exifr`，浏览器端可读 GPS 与 DateTimeOriginal，上传前就能算出归属站点
- Haversine 公式算直线距离可在前端做；实际驾车距离与时长调高德路径规划，结果按 (fromStopId, toStopId, mode) 缓存到 DB 避免重复计费
- 汇率：可用 exchangerate.host / frankfurter.app 等免费 API 每日拉一次存表；也允许用户手填当日汇率

## 研究发现（阶段 1 实施中补充）
- 脚手架装到的是 **Next.js 16.3.4**（非 15），React 19.2。重要差异：Turbopack 默认；`middleware.ts` 改名 `proxy.ts`（导出 `proxy` 函数）；`params`/`searchParams`/`cookies()`/`headers()` 只能异步访问；`next typegen` 生成全局 `PageProps<'/path'>` / `LayoutProps` 类型助手；文档在 `node_modules/next/dist/docs/`
- create-next-app 不接受含大写的目录名（yukiTrace），需在临时目录 `yukitrace` 生成后拷贝
- pnpm 10 默认忽略依赖的 build 脚本，需在 package.json `pnpm.onlyBuiltDependencies` 列出 sharp / prisma / @prisma/client / @prisma/engines / esbuild
- `pnpm add prisma` 会拉到 8.0.0-rc，需固定 `prisma@7` 与 `@prisma/client@7` 同版本；Prisma 7 使用 `prisma.config.ts` + driver adapter（`@prisma/adapter-pg` + `pg`）
- shadcn CLI 新版：`init -d -b radix --pointer`，无 `--base-color` 参数；默认 style 为 `radix-nova`，baseColor neutral，CSS 变量用 oklch
- framer-motion 已更名为 `motion` 包（`import { motion } from "motion/react"`）
- 认证决定：不用 Auth.js（与 Next 16 兼容风险），按 Next.js 官方 authentication 指南自建：bcryptjs 哈希 + jose 签发 HttpOnly 会话 cookie + DAL 层 `verifySession()`；`proxy.ts` 只做乐观重定向
- 高德 JS API 使用 GCJ-02 坐标；浏览器 Geolocation 与照片 EXIF 为 WGS-84，在中国大陆范围内需转换（已实现 wgs84ToGcj02），国外无偏移
- `@amap/amap-jsapi-types` 为全局 `declare namespace AMap`，需 triple-slash reference；MoveAnimation 的 `moving`/`movealong` 事件不在其 EventType 里
- dataviz 验证：iOS 系统色（blue/purple/orange/green/pink/teal/gray）作分类调色板不通过 CVD 检查，图表避免多序列；如未来需要堆叠图需换经验证的调色板
- AI SDK v7：`tool()` 用 `inputSchema`（zod v4 可直接传）；`generateText`/`streamText` 用 `stopWhen: stepCountIs(n)` 控制多步；`streamText().toUIMessageStreamResponse()` 配 `@ai-sdk/react` 的 `useChat({ transport: new DefaultChatTransport({ api, body }) })`；消息用 `parts`（text / tool-<name> 带 state）
- openai-compatible provider：`createOpenAICompatible({ name, baseURL, apiKey })` 后 `.chatModel(id)`；流式走 SSE chunk（tool_calls 分片 arguments），非流式 generateObject 会带 `response_format`
- 用本地 mock（/tmp/mock-openai.mjs）可离线验证整条 AI 链路，不依赖真实 Key

## 技术决策
| 决策 | 理由 |
|------|------|
| Next.js 16.3 App Router + Server Actions | 减少 API 样板，同时保留 `/api/*` Route Handlers 供未来 App 调用 |
| Prisma + PostgreSQL 16 | 关系模型清晰，docker 部署简单 |
| bcryptjs + jose 自建会话认证 | 多用户注册，先做最简邮箱密码；避免 Auth.js 与 Next.js 16 的兼容风险 |
| 金额存整数 minor unit（分/円/cent）+ currency + amountCny | 避免浮点误差，报表统一 |
| 高德 JS API 2.0 + 服务端代理 Web 服务 API | Key 不暴露，服务端缓存 |
| OSS STS 直传 | 服务器不承担图片流量 |
| Vercel AI SDK + openai-compatible | 一处配置切换任意模型服务商 |
| Motion Spring 预设：stiffness 300 / damping 30 | 接近 iOS 系统动效手感 |
| 移动端底部 Tab + 桌面侧边栏 | 记录场景在手机，回顾场景在电脑 |

## 数据模型草案
```
User(id, email, passwordHash, name, avatar, createdAt)
Trip(id, ownerId, title, cover, startDate, endDate, homeCurrency='CNY', babyBirthDate?, description)
TripMember(tripId, userId, role: owner|editor|viewer)
Stop(id, tripId, name, lat, lng, address, amapPoiId?, arriveAt, leaveAt, type, dayIndex, order, weather?)
StopLeg(fromStopId, toStopId, mode, distanceM, durationS, polyline?)   // 缓存路径
Entry(id, tripId, stopId?, type: flight|car_rental|train|taxi|hotel|meal|activity|shopping|moment, title, note, startAt, endAt, meta JSON)
Expense(id, tripId, stopId?, entryId?, amountMinor, currency, amountCnyMinor, rate, category, isBaby, paidAt, note)
Photo(id, tripId, stopId?, entryId?, ossKey, width, height, takenAt?, lat?, lng?, caption)
BabyLog(id, tripId, type: feed|diaper|sleep, at, note)
ChecklistItem(id, tripId, text, checked, group)
ExchangeRate(date, base, quote, rate)
ShareLink(id, tripId, token, hideExpense, expiresAt)
```

## 遇到的问题
| 问题 | 解决方案 |
|------|---------|
|      |         |

## 服务器现状（2026-09-05）
- Docker 26.1.3 / Compose v2.27.0，无 rsync，node v10（无用），git 2.43
- 已占用端口：80/443（mes-ui nginx）、8080（mes-server）、3000（frps）、13306、16379 → 本项目用 **3100**
- 内存 3.5 GB（可用约 1.8 GB），磁盘 49 GB 用 39%；在服务器上跑 Next 构建有 OOM 风险 → **本机 buildx 构建 linux/amd64 镜像后 docker save/load 传输**
- 无域名、无 HTTPS：通过 IP:3100 访问，cookie 不能带 Secure（已改为按 APP_URL 判断）；PWA 安装与 Geolocation 需要 HTTPS，后续配域名 + 反代（现有 nginx 占 80/443，可在 mes-ui 里加 server 块或换 Caddy）
- 公网 3100 端口 curl 超时 → 阿里云安全组很可能未放行，需要用户在控制台放行 TCP 3100
- 本次接续核查时 `yukitrace-app` 为 Up、`yukitrace-pg` 为 healthy，服务器本机 `http://127.0.0.1:3100/login` 返回 200；应用本身与容器内链路正常，剩余问题集中在公网入口/安全组/反向代理
- 服务器高德、OSS、AI 环境变量均已有非空值，容器也已重启加载；但容器内直接请求高德 POI API 返回 `INVALID_USER_KEY (10001)`，需替换为有效的“Web 服务”Key。OSS 与 AI 仅确认已配置，尚未做真实调用验证

## 版本库现状（2026-09-05）
- 工作区无未提交改动；阶段 1—6 均有独立提交记录
- 当前 HEAD：`e316650 docs: 阶段 6 部署记录与待办`
- `main` 显示 `origin/main [gone]`，继续协作前应确认或重新配置 Git 远端跟踪分支

## 资源
- 服务器：101.37.37.200（阿里云 ECS，Alibaba Cloud Linux 8），目录 /root/docker-compose/yukiTrace
- 高德开放平台：https://lbs.amap.com/
- 阿里云 OSS 文档：https://help.aliyun.com/zh/oss/
- Vercel AI SDK：https://sdk.vercel.ai/
- Auth.js：https://authjs.dev/

## 视觉/浏览器发现
-

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
