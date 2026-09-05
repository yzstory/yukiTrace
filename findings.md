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
- 边缘 nginx 实际属于 `/root/docker-compose/mes-demo` 的 `mes-ui` 容器，不存在 `/root/docker-compose/kmj-mes`；配置文件为 `nginx/default.conf`，只读挂载到容器 `/etc/nginx/conf.d/default.conf`
- `mes-ui` 与 yukiTrace 分属不同 Compose 网络；现有 `agent.aiyuki.cc` 通过宿主机内网地址访问另一栈的已发布端口，因此 `trace.aiyuki.cc` 可沿用同一模式回源宿主机 3100
- nginx 单文件 bind mount 若通过 `install`/原子替换改变宿主文件 inode，运行中容器不会自动看到新文件；需重建容器重新挂载，或未来采用保持 inode 的原地写入方式
- `agent.aiyuki.cc` 当前 502 的直接原因是宿主机 8000 无监听、agent 容器未运行；其 nginx 配置未被本次变更修改
- `trace.aiyuki.cc` HTTP 反代已在 `mes-ui` 生效，回源 `172.26.42.141:3100`；根路径 307 到登录页、登录页 200
- yukiTrace 生产 `APP_URL` 已改为 `http://trace.aiyuki.cc` 并重建 app 容器；公网无需开放 3100，只需 DNS A 记录指向 101.37.37.200 后走 80

## 版本库现状（2026-09-05）
- 阶段 1—6 均有提交记录；阶段 7 开始前 HEAD 为 `b663c17`
- `origin` 为 `git@github.com:yzstory/yukiTrace.git`，本地 `main` 正常跟踪 `origin/main`

## Emil Kowalski skills（外部仓库）
- `emilkowalski/skills` 是公开的设计与工程 skill 集合，不是单一 skill
- 仓库包含 12 个：`animate-expo`、`animate`、`animation-vocabulary`、`apple-design`、`ask-sonner`、`emil-design-eng`、`find-animation-opportunities`、`improve-animations`、`pick-ui-library`、`prototype`、`review-animations`、`write-swift`；已全部安装到 `~/.codex/skills`
- 当前 Next.js Web 项目优先采用 `emil-design-eng`、`apple-design`、`animate`、`find-animation-opportunities`、`improve-animations`、`review-animations`；Expo/Swift 规则不适用
- 适用于本项目的核心规则：高频导航只做极轻反馈或不动画；按钮按下用 100–160ms、`scale(0.97)`；UI 入场/退出用强 `ease-out` 且通常小于 300ms；只动画 transform/opacity（必要时 clip-path）；避免 `transition: all`、`scale(0)`、Motion `x/y/width`；弹层从触发点/自身路径出现；动效必须附带 reduced-motion 与 hover pointer gating

## 阶段 7 设计结论
- 最值得保留的动效是快捷记录内部层级切换、AI 新消息、灯箱和总结卡片滚动揭示，它们都在解释对象的出现或空间关系
- 底部导航、桌面侧栏、旅程四 Tab、时间线站点和账本数据属于高频或数据密集界面，静态状态比弹簧过渡更清晰、更快
- Motion 13 的 `MotionConfig` 类型明确支持 `reducedMotion: "always" | "never" | "user"`；根布局采用 `user` 后，CSS 仍需覆盖非 Motion 的 transition、animation 与玻璃材质
- 最终 Logo 必须为全幅方形底图，让 iOS/Android/PWA 自己应用蒙版；预先绘制圆角会在不同蒙版下露出四角底色
- 当前自动化环境没有可用 CUA 浏览器；页面视觉走查受限，但生产构建和 HTTP 资源链路可验证，Logo 可通过原图与 192px 资源单独检查

## 阶段 8 生产配置发现
- `@ai-sdk/openai-compatible@3.0.44` 的 Chat 模型固定将 `/chat/completions` 拼到 `baseURL` 后；用户给出的完整端点必须裁剪为 API 根路径，避免最终请求出现重复路径
- `hopportunity-agent/.env` 使用 `OSS_ENDPOINT` / `OSS_PUBLIC_ENDPOINT` 命名；yukiTrace 使用 `OSS_REGION` / `OSS_PUBLIC_BASE_URL`，需做字段映射而不是整段原样复制
- 参考 OSS endpoint 的地域是 `oss-cn-shanghai`，公开图片入口是独立域名；Access Key、Secret 与 Bucket 可直接复用，但不得写入仓库或进度文件
- 高德前端 JS API 与 Web 服务使用不同类型的 Key；用户本次只提供一个 Key，应先作为 `AMAP_WEB_SERVICE_KEY` 实测。若成功，它不能替代浏览器端的 JS Key 与安全密钥
- 新高德 Key 已经通过 `/v3/place/text` 真实验证，确定是可用的 Web 服务 Key；浏览器地图仍需独立的 JS API Key 与安全密钥
- 复用的 OSS 配置可通过 ali-oss `list(max-keys=1)`，证明 region、Bucket 与 Access Key 组合有效
- AI 网关对给定模型返回 `Model.AccessDenied`；该错误来自业务网关而非 DNS/TLS/404，优先排查 Key 对模型的授权或实际模型标识
- 同级 `hopportunity-agent` 目录只有 Compose 与环境文件，没有可参考的 AI 网关客户端代码或额外鉴权头配置
- 阿里云官方 2026-09 文档确认 `qwen3.8-flash` 是有效模型 ID，并支持文本、视觉与 Function Calling；因此当前 403 不是模型名拼写问题，更可能是这枚网关 Key 未获该模型/路由授权（https://help.aliyun.com/en/model-studio/qwen3-8-flash）
- 企业网关的 API 根路径不提供 `/models`（HTTP 404），无法通过模型列表自动发现该 Key 可用的替代模型
- OSS Bucket 是私有读：ali-oss 凭据可 list/put/get/delete，但公开域名对新对象返回 403；yukiTrace 当前 `imageUrl()` 在 OSS 模式下直接拼公开 URL，与“私有 bucket 则签名 URL”的注释不一致，需通过受鉴权的 `/api/files` 代理或签名 URL修正
- `/api/files` 原实现对登录用户只验证 JWT 存在，未验证用户对 `trips/{tripId}/...` 的旅程权限；启用私有 OSS 代理前必须补充 owner/member 查询，否则多用户之间存在越权读取风险
- `qwen3.7-plus` 在当前企业网关与 Key 下可用：普通 Chat Completions、16×16 图片理解、自动 Function Calling 均实测 HTTP 200；已同时配置为文本和视觉模型
- 该模型的 thinking mode 不接受将 `tool_choice` 强制设为 object/required，但项目当前使用的自动工具选择能正常返回 `tool_calls`
- 当前生产仅有 1 用户、1 旅程和约 8 MB 数据库，容量不是近期瓶颈；更急迫的是 HTTP、无备份、公开注册无限流、无测试/CI/监控
- 数据模型已有 `TripMember` 与 OWNER/EDITOR/VIEWER，但业务层没有成员邀请、加入和角色管理流程；README 中的“多用户与权限”更准确地说是底层已具备、产品流程待补
- PWA 当前是读缓存，没有离线写入队列、冲突处理和恢复同步；旅行场景的网络不稳定，这是产品差异化价值最高的扩展之一

## 阶段 10 AI 本地照片上传发现
- AI 窗口的图片入口不是通用聊天附件，而是“票据/订单图片 → 视觉模型结构化识别 → 文本发给工具型 AI”链路
- 限制选图来源的直接原因是唯一 file input 带 `capture="environment"`；同时保留两个 input（相机与本地照片）可在不改服务端 AI 协议的前提下完成需求
- 当前 AI SDK 的模型消息中 `image` part 已弃用，本地源码建议使用 `{ type: "file", data: Buffer, mediaType: "image/jpeg" }`
- `qwen3.7-plus` 网关在 `response_format=json_object` 时要求消息文本显式出现 `json`；这是票据识别首次真实端到端测试才暴露的兼容条件
- 当前企业网关对 `json_schema` 的 strict 约束不完全可靠，实测将要求的对象包装为数组；`json_object` 配合提示词内完整字段模板能稳定返回可校验对象

## 资源
- 服务器：101.37.37.200（阿里云 ECS，Alibaba Cloud Linux 8），目录 /root/docker-compose/yukiTrace
- 高德开放平台：https://lbs.amap.com/
- 阿里云 OSS 文档：https://help.aliyun.com/zh/oss/
- Vercel AI SDK：https://sdk.vercel.ai/
- Auth.js：https://authjs.dev/

## 视觉/浏览器发现
- 第一版生成 Logo 在 192px 下留白过多；第二版主体比例合格但预绘圆角外有黑角；第三版改为全幅渐变方形，192px 下脚印、路线和目的地图钉均保持清晰

---
*每执行2次查看/浏览器/搜索操作后更新此文件*
