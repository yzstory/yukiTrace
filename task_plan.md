# 任务计划：yukiTrace · 带娃旅行记录 Web 应用

## 目标
用 Next.js 做一个苹果风格的「带娃旅行日记 + 账本」网页应用，能记录行程（航班/租车/住宿/餐饮/游玩）、花费（多币种）、照片与备注，在高德地图上展示路线与站间距离，并内嵌 AI 助手（OpenAI 兼容接口）降低记录成本；第一版部署到阿里云 ECS（Docker Compose），后续可开放注册并演进为 App。

## 当前阶段
阶段 5 完成，进入阶段 6（部署与验证）

## 各阶段

### 阶段 0：需求与规划
- [x] 理解用户意图，梳理功能清单与产品定位
- [x] 确认关键决策：高德地图 / OSS / 多用户 / CNY 主币种+外币 / OpenAI 兼容 AI
- [x] 创建规划文件（task_plan / findings / progress）
- [x] 用户确认计划
- **状态：** complete

### 阶段 1：项目骨架与基础设施
- [x] `create-next-app`：Next.js 16.3 + App Router + TypeScript + Tailwind v4 + ESLint（装到的是 16，非 15）
- [x] 安装 shadcn/ui（radix-nova）、motion、lucide-react、zod、date-fns、recharts、ai SDK、exifr、ali-oss、amap loader
- [x] Prisma 7 + PostgreSQL 16（docker-compose.dev.yml 本地起库），@prisma/adapter-pg
- [x] 数据模型落地并完成首个迁移：User / TripMember / Trip / Stop / StopLeg / Entry / Expense / ExchangeRate / Photo / DailyNote / BabyLog / ChecklistItem / ShareLink
- [x] 自建认证：bcryptjs + jose HttpOnly cookie，`src/lib/session.ts` / `src/lib/dal.ts`（verifySession / getCurrentUser / requireTripAccess），`src/proxy.ts` 乐观重定向，登录/注册 Server Actions
- [x] 设计系统：`globals.css` iOS 系统色 oklch token、分层背景、系统字体栈、iOS 字号 utility、glass / card-shadow / safe-area utility
- [x] 布局：`(app)/layout.tsx` 桌面侧边栏 + 移动端毛玻璃底部 Tab（旅程/地图/账本/我），PageHeader 大标题
- [x] Dockerfile（standalone + entrypoint 自动 migrate deploy）+ 生产 docker-compose.yml + .env.example
- [x] 验证：typecheck / lint / `next build` 通过；curl 验证未登录重定向、带会话访问 /trips /me、已登录访问 /login 反向重定向
- **状态：** complete

### 阶段 2：核心记录功能（第一版可用）
- [x] 旅程 CRUD：标题、描述、日期范围、主币种、同行人、宝宝昵称+生日（月龄自动算）、封面上传、删除确认
- [x] 首页旅程卡片流（封面/渐变 + 日期 + 天数 + 站数 + 总花费 + 宝宝月龄 + 城市）
- [x] 站点 Stop：POI 搜索（/api/amap/search 代理，未配 Key 时降级为定位/手填坐标）、类型、到达/离开时间、婴儿友好标签、备注；逆地理编码补地址
- [x] 站点间距离：Haversine 直线 + 高德驾车/步行路径（<2km 步行，<500km 驾车，否则直线），结果缓存 StopLeg；改坐标/删站点自动重算
- [x] 条目 Entry：9 种类型（航班/租车/火车/打车/住宿/餐食/游玩/购物/此刻），类型特定 meta 字段，可关联站点，可顺手记一笔花费
- [x] 花费 Expense：多币种、最小单位整数、汇率 DB 缓存 → frankfurter API → 离线兜底、自动折算主币、分类、宝宝相关标记
- [x] 照片：/api/upload（sharp 压缩 webp 2400px、exifr 读拍摄时间+GPS、500m 内自动匹配站点）、存储抽象 OSS/本地、/api/files 鉴权读取 + 缩略图
- [x] 时间线视图：按 Day 分组、日记（内联编辑）、站点卡片、站间距离分隔、条目行、花费 chip、照片条 + 灯箱、每日小计
- [x] 快速记录浮钮 `+`：底部抽屉，地点/花费/照片 3 个大入口 + 9 种条目，表单 3 步内完成
- [x] 验证：typecheck / lint / build 通过；种子数据 + curl 验证列表页、详情页、编辑页、上传、缩略图、鉴权
- **状态：** complete

### 阶段 3：地图与账本视图
- [x] 高德 JS API 2.0 集成（@amap/amap-jsapi-loader 动态 import，安全密钥，whitesmoke 样式，自定义 HTML 数字标记）
- [x] 无 Key 降级：RouteSketch SVG 路线示意图（等距投影），页面结构不变
- [x] 旅程地图页 `/trips/[id]/map`：全屏地图、按天着色路线、Day 筛选 chip、底部横向站点卡片、点击弹非模态抽屉（地址/条目/照片/跳时间线）
- [x] 路线「回放」：AMap.MoveAnimation moveAlong，红点沿路线移动并跟随视角，结束回到全览
- [x] 全局足迹页 `/map`：所有旅程站点按旅程着色，KPI（旅程/城市/直线里程），点击跳到对应旅程地图
- [x] 旅程账本页 `/trips/[id]/ledger`：英雄总额、外币明细、KPI（日均/宝宝相关占比/笔数）、单行筛选 chip、分类条形列表（图标+文字第二编码）、按天单序列柱状图（recharts，hover tooltip）、按天分组明细可删
- [x] 全局账本页 `/ledger`：本年花费英雄数字、累计/宝宝/旅程数、累计按分类、按旅程列表
- [x] 照片页 `/trips/[id]/photos`：按天网格、全屏灯箱（上一张/下一张/删除/设为封面）
- [x] 旅程四 Tab 分段导航（时间线/地图/账本/照片，motion layoutId 滑动指示）
- [x] 站点/条目编辑：ItemMenu「编辑」打开抽屉，复用 StopForm/EntryForm（initial 模式），新增 updateEntry action
- [x] WGS-84 → GCJ-02 转换：浏览器定位与照片 EXIF GPS 在中国大陆范围内转高德坐标
- [x] 验证：typecheck / lint / build 通过；curl 验证 6 个页面渲染
- **状态：** complete

### 阶段 4：AI 助手（OpenAI 兼容）
- [x] `src/lib/ai/model.ts`：`@ai-sdk/openai-compatible` createOpenAICompatible，AI_BASE_URL / AI_API_KEY / AI_MODEL / AI_VISION_MODEL 全环境变量
- [x] `src/lib/ai/tools.ts`：10 个工具（listStops / listEntries / queryExpenses / searchPlace / getTripSummary 只读；createStop / createEntry(+expense) / addExpense / logBaby / saveDailyNote 写入，VIEWER 角色只拿只读工具），系统提示词
- [x] `/api/ai/chat`：streamText + stopWhen(stepCountIs(6)) 多步工具循环，toUIMessageStreamResponse 流式；鉴权 + 旅程归属校验
- [x] `/api/ai/receipt`：generateObject + 视觉模型，收据/航班/酒店/租车/车票 → 结构化 JSON；sharp 预处理
- [x] AI 抽屉 `AiChat`（useChat + DefaultChatTransport）：快捷问题、工具调用 chip、拍票据识别后自动转成一句话让模型记录、停止按钮、完成后 router.refresh
- [x] 每日日记 AI 草稿 generateDailyDraft（默认 / 写给宝宝口吻），存 aiDraft，用户「采用」后才写入正文
- [x] 旅程游记 generateTripSummary（300 字）；装备清单 generatePackingList（按目的地/月龄，写入 ChecklistItem）
- [x] 出行清单页 `/trips/[id]/checklist`：模板 / AI 生成 / 勾选（useOptimistic）/ 增删 / 重置，进度条
- [x] 验证：用本地 mock OpenAI 服务端到端测试 chat（tool_call → addExpense 写库 → 二次调用 → 文本）与 receipt（response_format → JSON）；build 通过
- **状态：** complete

### 阶段 5：带娃专属与回顾分享
- [x] 宝宝状态打卡：喂奶/换尿布/睡/醒/吃药/其他，快速记录抽屉「宝宝」入口，时间线每日 BabyStrip（可删）
- [x] 装备清单：模板 + AI 生成 + 勾选/增删/重置（阶段 4 已完成）
- [x] 站点婴儿友好标签（阶段 2 已完成）
- [x] 照片 EXIF 自动归位（阶段 2 已完成）+ WGS-84→GCJ-02
- [x] 天气：高德逆地理拿 adcode，到达时间在 ±12h 内自动补实况天气，StopCard 显示
- [x] 成长对照：/me 「同一个地方，不同的年纪」——同一城市在不同旅程各取一张照片并排，标出当时月龄
- [x] 旅程总结页 `/trips/[id]/summary`：Wrapped 风格 4:5 卡片（封面/足迹/花费/宝宝/最丰富的一天/照片），html-to-image 保存长图，Web Share
- [x] 只读分享链接：ShareLink 生成/撤销/隐藏花费开关（编辑页），公开页 `/share/[token]`（免登录，含路线示意图与照片），`/api/files` 支持 `?t=token` 校验旅程归属
- [x] 导出：CSV 花费明细（UTF-8 BOM，Excel 可直接打开），账本页「导出 CSV」；PDF 相册未做（用长图 + 分享链接替代）
- [x] PWA：manifest.ts、图标（sharp 生成 192/512/maskable/180）、sw.js（静态 cache-first / 图片 SWR / 页面 network-first / 离线页）、生产环境注册
- [x] 验证：typecheck / lint / build 通过；curl 验证分享页、token 文件鉴权、总结、成长对照、CSV、manifest/sw/offline
- **状态：** complete

### 阶段 6：部署与验证
- [ ] 服务器 `/root/docker-compose/yukiTrace` 部署 docker-compose（app + postgres + 可选 caddy 反代 HTTPS）
- [ ] 环境变量：DATABASE_URL、AUTH_SECRET、AMAP_KEY(web/js)、OSS_*、AI_BASE_URL/AI_API_KEY/AI_MODEL
- [ ] 数据库迁移、种子数据、备份策略
- [ ] 手机端真机走一遍：新建旅程 → 录站点 → 记花费 → 传照片 → 看地图 → 看账本
- [ ] 记录测试结果到 progress.md
- **状态：** pending

## 关键问题
1. 高德 Key 是否已申请？需要 Web 端（JS API）Key + Web 服务 Key 各一个（路径规划/天气用服务 Key）
2. OSS Bucket 名称与地域？是否已开通 STS 角色（用于前端直传）
3. AI 服务商与模型名（例如 DeepSeek / 通义 / OpenRouter / 自建），是否支持图片输入
4. 域名与 HTTPS：有现成域名指向 101.37.37.200 吗？OSS 直传与 PWA 都需要 HTTPS
5. 第一版是否需要注册功能，还是先手动建账号

## 已做决策
| 决策 | 理由 |
|------|------|
| Next.js 15 App Router + TS | 用户指定；Server Actions 简化 CRUD |
| Tailwind + shadcn/ui + Framer Motion | 苹果风 UI 与弹簧动效 |
| PostgreSQL + Prisma | 关系型数据、docker 部署简单、多租户易做 |
| 高德地图 | 用户选择；国内数据准确 |
| 阿里云 OSS + 前端直传 | 用户选择；减轻服务器带宽 |
| Auth.js v5 多用户 | 以后开放注册 |
| Vercel AI SDK + openai-compatible provider | 兼容任意 OpenAI 风格接口，支持 tool calling 与流式 |
| 金额存 minor unit 整数 + 货币码，另存折算 CNY 金额 | 避免浮点误差；报表统一按 CNY |
| 移动端优先 + PWA，API 层与 UI 分离 | 为以后做 App（Capacitor 或 RN）铺路 |
| 三层模型 Trip → Stop → Entry，Expense/Photo 可挂任意层 | 时间线、地图、账本共享同一份数据 |

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| create-next-app 拒绝大写目录名 yukiTrace | 1 | 在 /tmp/yukitrace 生成后拷贝进项目目录 |
| shadcn init 无 `--base-color` 参数 | 1 | 改用 `init -d -b radix --pointer` |
| `pnpm add prisma` 装到 8.0.0-rc 与 client 7 不匹配 | 1 | 固定 `prisma@7`，移到 devDependencies |
| Docker daemon 未运行 | 1 | `open -a OrbStack` 后重试 |
| `PageProps<"/login">` 类型报错 | 1 | 运行 `pnpm next typegen` 重新生成路由类型 |
| proxy matcher 未排除 sw.js / offline.html 导致 307 到登录页 | 1 | matcher 增加排除项 |
| 加字段后 typecheck 报 adcode 不存在 | 1 | 手动 `prisma generate`（migrate dev 后客户端未刷新） |
| zsh 中用 `path` 做循环变量覆盖了 $PATH，后续命令全部找不到 | 1 | 改用其他变量名 |
| @amap/amap-jsapi-types 是全局声明，未被 tsc 拾取 | 1 | 文件头加 `/// <reference types>`；去掉自定义 Window.AMap 声明 |
| React Compiler lint：effect 内 setState / map 回调里修改闭包变量 | 1 | 搜索改由 onChange 触发；里程改为 reduce 计算 |
| Prisma Json 字段类型不接受 Record<string, unknown> | 1 | 断言为 InputJsonValue |
| 用 curl 直接 POST Server Action 测注册返回 500 | 1 | useActionState 表单不渲染 ACTION_ID，改为 tsx 脚本种子用户 + jose 签发会话验证受保护页面 |

## 备注
- 服务器：101.37.37.200，root，密钥 ~/Downloads/ipad.pem，目录 /root/docker-compose/yukiTrace（目前为空）
- 记录成本尽量低，回顾体验尽量美，是所有 UI 决策的第一原则
- 外部内容（网页/API 结果）只写入 findings.md
