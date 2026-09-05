# 任务计划：yukiTrace · 带娃旅行记录 Web 应用

## 目标
用 Next.js 做一个苹果风格的「带娃旅行日记 + 账本」网页应用，能记录行程（航班/租车/住宿/餐饮/游玩）、花费（多币种）、照片与备注，在高德地图上展示路线与站间距离，并内嵌 AI 助手（OpenAI 兼容接口）降低记录成本；第一版部署到阿里云 ECS（Docker Compose），后续可开放注册并演进为 App。

## 当前阶段
阶段 11 起：可靠性补课 + AI 深化（用户确认全量推进，仅备份不做）

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
- [x] 服务器勘察：Docker 26 / Compose 2.27，80/443/3000/8080 已被占用 → 用 3100；内存 3.5G → 本机 buildx 构建 amd64 镜像后传输
- [x] Dockerfile 三目标：deps/build → `runner`（standalone，236MB）与 `migrate`（prisma CLI，722MB，迁移目录挂载不必重建）
- [x] 生产 compose：postgres(healthcheck) → migrate(一次性) → app；uploads 卷；.env 注入
- [x] 服务器 `/root/docker-compose/yukiTrace`：.env（随机 AUTH_SECRET / POSTGRES_PASSWORD；AMAP/OSS/AI 已填，仍需验证）、docker-compose.yml、prisma.config.ts、prisma/schema + migrations
- [x] 镜像 docker save | gzip | ssh docker load（38s），`docker compose up -d`：迁移成功，app Ready，服务器本机 curl /login 200、/ → 307 /login
- [x] 一键脚本 `deploy/deploy.sh [--with-migrate]`
- [ ] 公网域名访问：nginx 的 `trace.aiyuki.cc` HTTP 反代已生效，等待用户新增/更新 DNS A 记录指向服务器后从公网验证
- [ ] 手机真机走一遍：新建旅程 → 录站点 → 记花费 → 传照片 → 看地图 → 看账本（需公网可达后进行）
- [ ] 校验第三方配置：高德 / OSS / AI 已填入并重启，但高德 Web 服务 API 返回 `INVALID_USER_KEY (10001)`；OSS 与 AI 尚未做真实链路验证
- [ ] 域名 + HTTPS（PWA 安装、定位、剪贴板等能力需要 HTTPS）
- [x] 配置 `trace.aiyuki.cc` HTTP 反向代理：复用 `mes-ui` 边缘 nginx，转发至 yukiTrace 3100；`nginx -t`、根路径重定向与登录页均验证通过
- **状态：** in_progress（等待用户侧操作）

### 阶段 7：设计与动效优化、文档与再部署
- [x] 从 `emilkowalski/skills` 安装仓库内全部 12 个 skills，并读取本项目相关 skill 的完整规则
- [x] 基于 design/animation skills 审计当前界面，形成明确优化清单
- [x] 实施高价值 UI、交互与动效优化，兼顾移动端、可访问性和 reduced motion
- [x] 生成并接入 yukiTrace Logo/品牌资产
- [x] 重写中文 README，包含产品介绍、功能、技术栈、架构图、配置与部署说明
- [x] 完成 typecheck、lint、build 与关键页面/交互验证
- [x] 构建 amd64 生产镜像并部署到 101.37.37.200，验证 `trace.aiyuki.cc`
- [x] 提交所有改动并推送 `origin/main`
- **状态：** complete

### 阶段 8：生产第三方服务配置
- [x] 核对 AI SDK 的 Base URL 规则及服务器现有环境变量结构
- [x] 从同级 `hopportunity-agent/.env` 复制匹配的 OSS 配置，不在日志或仓库中暴露密钥
- [x] 备份并更新 yukiTrace 生产 `.env`：AI、OSS、高德
- [x] 重建应用容器并确认配置已加载
- [x] 实测 AI 对话/图片/工具调用、高德 Web API 与 OSS 读写
- [x] 将私有 OSS 读取改为应用代理，补齐行程 owner/member 权限并部署验证
- [x] 回归应用与域名入口，更新进度记录并推送非敏感文档
- **状态：** complete

### 阶段 9：只读生产化与产品拓展评估
- [x] 检查认证、权限、上传、AI、PWA、部署与数据模型
- [x] 核对生产环境的 HTTPS、注册策略、备份、可观测性与资源占用
- [x] 形成按风险/价值排序的改进和拓展建议，未实施新代码改动
- **状态：** complete

### 阶段 10：AI 本地照片上传
- [x] 核对 AI 窗口、`useChat` 与票据识别路由现状
- [x] 保留后置相机入口，新增本地照片/相册选择入口
- [x] 补充图片类型、大小、重复选择与错误处理
- [x] 修正 `qwen3.7-plus` 结构化识别的 JSON 兼容性与 SDK 弃用图片格式
- [x] 完成 typecheck、lint、build 与生产路由冒烟验证
- [x] 部署生产服务器并推送 `origin/main`
- **状态：** complete

### 阶段 11：可靠性补课 A（时区 / 币种 / 图片格式）
- [x] 时区：Trip.timezone（默认 Asia/Shanghai）+ Stop.timezone 覆盖；date-fns-tz 重写 `fmt`（全部接受 tz 参数）；新增 `parseInTz` 让 datetime-local 按旅程时区解析；dayIndex 按时区分组；容器 TZ 环境变量
- [x] 时区选择器：旅程表单 22 个常用时区；站点表单可覆盖并提示，跨时区站点在时间线显示时区名
- [x] 全局账本统一 CNY：Expense.amountCnyMinor + 迁移内回填（CNY 旅程直接沿用，其他按兜底汇率换算）；所有写入路径（表单 / AI 工具）同步落库
- [x] HEIC / 客户端压缩：`src/lib/client-image.ts`（heic-to 转 JPEG + browser-image-compression 保留 EXIF），照片上传与 AI 票据均接入；服务端解码失败返回可读错误
- [x] 验证：以 TZ=UTC 启动服务端，上海站显示 07:30、东京站 14:10、账本 19:00，全部正确
- **状态：** complete

### 阶段 12：协作与成员邀请
- [x] TripInvite 模型：token / 角色 / 有效期 / 可用次数
- [x] 成员页 `/trips/[id]/members`：成员列表、所有者可改权限与移出、非所有者可退出旅程
- [x] 邀请链接生成（可编辑/只读 × 1/7/30 天/长期 × 1/5/不限次）、复制、撤销
- [x] 邀请落地页 `/invite/[token]`：免登录可见旅程卡片，未登录引导登录/注册并带 next 回跳；无效/过期/用尽三种状态
- [x] 接受邀请事务：建成员 + 次数自增；已是成员或所有者直接进入
- [x] 验证：所有者看到管理界面、外婆加入前 307、加入后 200 且可记录、邀请用尽显示「已用完」、成员数变 2
- **状态：** complete

### 阶段 13：工程质量
- [x] error.tsx / global-error.tsx / not-found.tsx / loading.tsx（列表页与旅程详情骨架屏）
- [x] Vitest：currency / geo / date / rate-limit / logger 共 40 个用例
- [x] Playwright（WebKit + iPhone 14 profile）5 条冒烟：注册建旅程、站点+日元花费+账本折算、地图与总结、成员与邀请、退出后重定向
- [x] 结构化 JSON 日志 `src/lib/logger.ts`（敏感字段脱敏、Error 展开、timer 计时）
- [x] 限流 `src/lib/rate-limit.ts`：AI 对话/票据/生成、上传、登录注册
- [x] 异步算路改用 `after()` 并记录失败日志，不再 `void` 吞错
- [x] 浏览器测试发现并修复两个真实缺陷：TripHero 的成员入口从未渲染（补丁锚点失配）；dev 环境从 127.0.0.1 访问被 Next 拦截 `/_next` 导致页面不 hydrate（补 `allowedDevOrigins`）
- **状态：** complete

### 阶段 14：离线记录队列
- [ ] IndexedDB 写队列 + 联网重放 + 待同步标记
- **状态：** pending

### 阶段 15：地图与外观
- [ ] 海外坐标切 MapLibre；深色模式跟随系统
- [ ] 部署体积：去掉独立 migrate 镜像
- **状态：** pending

### 阶段 16：AI 第一档（随身助理）
- [ ] 语音记录（OpenAI 兼容 transcriptions）
- [ ] 照片智能：caption / 第一次识别 / 精选封面
- [ ] 早晚简报 + Web Push；宝宝作息提醒
- **状态：** pending

### 阶段 17：AI 第二档（跨旅程记忆）
- [ ] pgvector + embeddings，全局问答
- [ ] 那年今日；消费洞察；智能导入（邮件/截图）
- **状态：** pending

### 阶段 18：AI 第三档（生成与开放）
- [ ] 年度 Wrapped；回放视频；PDF 相册；MCP Server；家庭日记合成
- **状态：** pending

## 关键问题
0. **DNS：为 `trace.aiyuki.cc` 添加 A 记录指向 101.37.37.200**；无需对公网放行 3100，流量统一走 nginx 的 80
1. **HTTPS：** 当前仍为 HTTP，登录凭据、Secure Cookie、PWA 安装和浏览器定位都受影响
2. **数据备份：** 生产 PostgreSQL 尚无定时 `pg_dump` 或异地备份
3. **访问防护：** 生产 `ALLOW_SIGNUP=true`，登录、注册、AI、高德和上传端点尚无限流
4. **前端地图凭据：** 高德 Web 服务 Key 已验证可用，但 JS API Key 与安全密钥仍未配置
5. **工程保障：** 当前无自动化测试、CI、应用健康检查和告警

## 已做决策
| 决策 | 理由 |
|------|------|
| Next.js 16.3 App Router + TS | 实际脚手架版本；Server Actions 简化 CRUD，并按包内文档适配异步 API 与 `proxy.ts` |
| Tailwind + shadcn/ui + Motion | 苹果风 UI；高频交互克制，空间过渡使用短时长强 ease-out |
| PostgreSQL + Prisma | 关系型数据、docker 部署简单、多租户易做 |
| 高德地图 | 用户选择；国内数据准确 |
| 阿里云 OSS + 前端直传 | 用户选择；减轻服务器带宽 |
| bcryptjs + jose 自建会话认证 | 避免 Auth.js 与 Next.js 16 的兼容风险，同时支持以后开放注册 |
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
| 服务器高德 Web 服务 Key 已填但 API 返回 `INVALID_USER_KEY (10001)` | 1 | 待在高德控制台确认使用的是“Web 服务”Key，替换服务器环境变量并重启应用 |
| 用户提供的 nginx 目录 `/root/docker-compose/kmj-mes` 不存在 | 1 | 在 `/root/docker-compose` 下定位到实际目录 `/root/docker-compose/mes-demo` |
| 原子替换 nginx 单文件 bind mount 后 reload 仍读取旧配置 | 1 | Docker 挂载仍指向旧 inode；保留已验证候选与备份，改为仅强制重建 `mes-ui` 以重新挂载 |
| 清理 `/tmp` 候选文件的删除命令被安全策略拒绝 | 1 | 不重试删除；临时文件不影响服务，由系统临时目录清理机制处理 |
| `gh api` URL 中的 `?` 被 zsh 当作通配符 | 1 | 用单引号包住 API 路径后成功获取仓库树 |
| `next build` 与已运行的 `next dev` 共用 `.next`，构建后 HTTP 冒烟连接失败 | 1 | 改为基于最新构建单独启动 production server，四个 HTTP 冒烟项全部通过 |
| 服务器 Python 版本不支持 `dict[str, str]` 类型标注，首次 `.env` 更新脚本未执行 | 1 | 配置保持未变；改用兼容旧 Python 的无泛型标注脚本后再重建应用 |
| AI 网关最小对话请求返回 HTTP 403 `Model.AccessDenied` | 1 | 网络、路径和鉴权已到达网关；继续核对同级项目调用格式、可用模型列表及错误详情，不重复相同请求 |
| OSS SDK 写入/读取成功，但参考项目公开域名读取测试对象返回 403 | 1 | 临时对象已删除；检查现有鉴权文件路由，改用私有 Bucket 的应用代理或签名 URL，避免上传后图片不可见 |
| standalone 容器内的独立探针无法动态导入 `jose`，私有代理首次端到端测试中断 | 1 | 临时 OSS 对象已删除；改用 Node 原生 HMAC 生成兼容 HS256 测试会话，不重复模块导入方案 |
| AI 本地 PNG 经 `/api/ai/receipt` 真实测试返回 500 | 2 | 首次在提示词增加 JSON 关键字；第二次确认空对象不满足 schema，改为 `json_object` + 完整字段模板并直接网关验证通过 |

## 备注
- 服务器：101.37.37.200，root，密钥 ~/Downloads/ipad.pem，目录 /root/docker-compose/yukiTrace（已部署运行）
- 记录成本尽量低，回顾体验尽量美，是所有 UI 决策的第一原则
- 外部内容（网页/API 结果）只写入 findings.md
