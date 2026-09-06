# 进度日志

## 2026-09-06 产品能力迭代
- 功能提交 `f069434` 已推送 origin/main，阶段 20 完成。规划技能用于维护实现、测试与发布检查记录；本轮未更改 AI/OSS/高德密钥。
- 最终验证：typecheck、lint、55 项单元/数据库测试和 6 项移动端端到端测试全部通过；linux/amd64 新镜像已部署（b823a2abb85b）。
- 生产应用成功执行 Activity 迁移；域名 nginx 登录入口 HTTP 200。用短时内存会话只读验证两个新页面：已登录均 HTTP 200，未登录均 307 跳转登录；未产生测试业务记录。
- `pnpm build` 成功，产出整理和历史两个动态页面；既有 fs/zlib 非致命提示仍在。
- 生产备份：`backups/before-organize-20260906-1125.dump`（52 KB、600 权限）；旧镜像保留为 `yukitrace:before-organize-20260906-1125`。
- 55 项单元/数据库测试通过，移动端整理全流程通过。首次 E2E 遇到 Prisma ESM 加载问题，改用参数化 SQL 夹具；随后发现 pg 时间解析与 Prisma UTC 语义不一致，固定测试解析器后撤销验证通过。
- 照片无 updatedAt，识别后台写入改用状态/说明/第一次字段的乐观条件，避免覆盖用户已整理的内容。
- 续接时按真实工作区核对：基础审计服务已在当前 HEAD，本轮补 AI 卡片入口、整理中心、历史页面与回归保护。
- 本地 9 个迁移已全部应用；类型检查、lint、原有 47 项测试通过。修复 effect 检查、表单版本刷新、非 AI 撤销按钮和旅程范围同步。
- 新增真实 PostgreSQL 事务测试，覆盖权限、并发版本保护、关联保护、重复撤销及日记还原。
- 本轮按评估中三个产品拓展实施；统一操作历史支撑 AI 卡片、撤销和家庭协作。
- 现有 AI 工具及普通表单直接写库，无完整历史；以受控事务客户端记录业务快照。
- 文档旧路径不存在，改用 Next 当前 `07-mutating-data.md`；首次规划补丁锚点失配未生效，改为按实际标题更新。

### 阶段 19：高德 JS API Key 生产配置
- 用户提供新的高德 JS API Key，要求替换生产配置
- 已核对 Next.js 16 包内文档：`NEXT_PUBLIC_*` 在构建期间内联并冻结，服务器运行时 `.env` 不能补进已经生成的客户端代码
- 已确认当前 `.dockerignore` 排除 `.env`，Dockerfile 与部署脚本也未传 build arg；这是此前页面持续显示“未配置高德 Key”的直接原因
- 已修改 Dockerfile 与 `deploy/deploy.sh`：构建阶段接收高德公开变量，部署脚本优先使用本地显式值，否则从服务器 `.env` 读取；Key 本身不进入仓库
- 服务器原 `.env` 已备份为 `.env.bak-amap-js-20260905-211455`，新 JS Key 已写入，权限保持 `600 root:root`
- `NEXT_PUBLIC_AMAP_SECURITY_CODE` 当前是空字符串；部署脚本会正确视为空值，不传入构建
- `pnpm typecheck`、`pnpm lint`、`pnpm test` 全部通过；Vitest 6 个文件、47 个用例通过
- 本机 buildx 成功构建 linux/amd64 runner，镜像已传输并重建生产 `yukitrace-app`
- 生产验证：容器 running；静态 bundle 能匹配容器环境中的 JS Key；高德 JS API 2.0 脚本 HTTP 200、响应约 966 KB，未出现常见 Key 错误标识；应用 3100 与 nginx 域名入口均返回 200
- 待外部条件：安全密钥未提供，无法验证需要 `securityJsCode` 的新制高德 JS Key；DNS/登录后的真实地图画布仍需用户侧最终确认

## 会话：2026-09-05

### 阶段 10：AI 本地照片上传
- **状态：** in_progress
- 用户要求 AI 窗口在现有“拍照识别”之外支持本地照片/相册选择，完成后部署并推送
- 已按 `planning-with-files-zh` 恢复项目状态，并根据 `ai-sdk` 规则查阅当前本地 SDK 文档与源码
- 现有入口为 `accept="image/*" capture="environment"`，选图后走 `/api/ai/receipt` 结构化识别，再将识别结果转为文本发给旅程 AI
- 已在 AI 输入区保留后置相机 input，并新增不带 `capture` 的本地照片 input；两个入口都会清空 input value，支持连续重选同一张照片
- 客户端与 `/api/ai/receipt` 同步增加图片 MIME 和 15MB 大小校验，服务端将无法解码的图片返回可读 400 错误
- 修改文件：`src/components/ai/ai-chat.tsx`、`src/app/api/ai/receipt/route.ts`
- `git diff --check`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 全部通过；构建仍有已知 `Couldn't load fs/zlib` 提示，不影响成功产出 17 个页面
- 生产新镜像已部署；非图片表单测试正确返回 415，但首次真实 PNG 识别返回 500，正在检查 `qwen3.7-plus` 与 `generateObject` 结构化输出的兼容性
- 容器日志确认 500 根因：网关在 `response_format=json_object` 时要求 messages 显式包含 `json`；同时 AI SDK 警告 `image` content part 已弃用
- 已在提示词中明确要求 JSON 对象，并按当前 AI SDK 源码将图片改为 `{ type: "file", data, mediaType }`
- 直接网关测试发现 `json_schema` 虽返回 200，但模型仍可能将对象包成数组；改用 `json_object` + 明确的完整字段模板后，相同模型返回单个对象且 10 个必需字段齐全
- 最终镜像已部署到 101.37.37.200；生产 `/api/ai/receipt` 通过本地 JPEG + `FormData` 端到端测试，返回 HTTP 200、`kind=other`、title 与全部 10 个字段
- 边界验证：非图片返回 415，生产登录页返回 200，视觉模型保持 `qwen3.7-plus`
- **状态：** complete

### 项目接续审计
- **状态：** complete
- 使用 `planning-with-files-zh` 恢复并核对 `task_plan.md`、`progress.md`、`findings.md`；session-catchup 无未同步上下文
- Git 工作区干净，HEAD 为 `e316650 docs: 阶段 6 部署记录与待办`，本地 `main` 对应的远端跟踪分支已不存在
- 只读复核生产服务器：`yukitrace-app` 正常运行，`yukitrace-pg` healthy，服务器本机访问 `/login` 返回 HTTP 200
- 服务器 `.env` 中高德、OSS、AI 必填项均已有值，`APP_URL=http://101.37.37.200:3100`，公开注册开启；端口 3100 正监听于所有网卡
- 直接从应用容器请求高德 Web 服务 API，返回 `INVALID_USER_KEY (10001)`；确认“已填配置”不等于“配置有效”
- 本地复验 `pnpm typecheck`、`pnpm lint`、`pnpm build` 全部通过；构建期间出现 `Couldn't load fs/zlib` 提示，但未影响编译、类型检查或 17 个静态页面生成
- 确认下一步仍是阶段 6：修正高德 Web 服务 Key，并打通公网/HTTPS，然后按手机验收流程逐项验证 OSS 与真实 AI

### trace.aiyuki.cc HTTP 反向代理
- **状态：** complete（服务器端已生效，等待 DNS）
- 用户授权在服务器现有 nginx 中配置 `trace.aiyuki.cc`，当前只要求 HTTP
- 初始路径 `/root/docker-compose/kmj-mes` 不存在；定位到边缘 nginx 项目 `/root/docker-compose/mes-demo`
- `mes-ui` 容器占用 80/443；宿主配置 `/root/docker-compose/mes-demo/nginx/default.conf` 以只读方式挂载到 `/etc/nginx/conf.d/default.conf`
- yukiTrace 应用在 `/root/docker-compose/yukiTrace`，宿主端口为 3100；下一步验证 nginx 容器到该端口的连通性
- 已确认 `mes-ui` 可访问 `http://172.26.42.141:3100/login`，返回 HTTP 200
- 候选 nginx 配置已在独立 `nginx:alpine` 容器、`mes-demo_default` 网络中通过 `nginx -t`
- 已备份原配置到 `/root/docker-compose/mes-demo/nginx/default.conf.bak-yukitrace-20260905`
- 首次 reload 后新域名未生效：宿主配置采用原子替换产生新 inode，运行中容器的单文件 bind mount 仍指向旧 inode；待仅重建 `mes-ui` 重新挂载
- 已仅强制重建 `mes-ui` 以重新挂载配置；生效配置中可见 `trace.aiyuki.cc` server 块，`nginx -t` 通过
- Host 头冒烟：`trace.aiyuki.cc/` 返回 307 到登录页，`/login` 返回 200；原 `mes-test.aiyuki.cc` HTTP 仍返回 301 到 HTTPS
- 回归检查发现原 `agent.aiyuki.cc` 返回 502；确认宿主机 8000 无进程监听且对应 agent 容器不在运行，属于其后端当前停机，并非本次 nginx 配置回归
- 已将生产 `APP_URL` 改为 `http://trace.aiyuki.cc`，仅重建 yukiTrace app 容器并确认环境变量生效
- 最终状态：`mes-ui` Up、`yukitrace-app` Up、`yukitrace-pg` healthy；`nginx -t` 成功
- 最终 Host 测试：根路径返回 307 到 `http://trace.aiyuki.cc/login?next=%2F`，登录页返回 200
- 原 nginx 配置备份：`/root/docker-compose/mes-demo/nginx/default.conf.bak-yukitrace-20260905`；原应用环境备份：`/root/docker-compose/yukiTrace/.env.bak-trace-domain-20260905`
- 本机 DNS 查询受 TUN/fake-IP 代理影响返回 `198.18.1.168`，不作为权威解析结论；等待用户在 DNS 服务商处配置真实 A 记录
- 尝试清理 `/tmp` 候选文件时删除命令被安全策略拒绝；未重试，不影响运行配置或服务状态

### 阶段 7：设计与动效优化、文档与再部署
- **状态：** in_progress
- 用户要求安装 `github.com/emilkowalski/skills`，据此优化项目，补中文 README、Logo、架构图，部署服务器并推送 origin
- 仓库为公开的 “Skills for Designers and Engineers”，包含 12 个独立 skill；已全部安装到 `~/.codex/skills`，Web 项目重点使用 design/apple/animation/review 相关规则
- 首次递归树查询因 zsh 展开 `?` 失败；改为引用 API 路径后成功
- 已完整读取 `emil-design-eng`、`apple-design`、`animate`、`find-animation-opportunities`、`improve-animations`、`review-animations` 及其 AUDIT/STANDARDS/RECIPES/PLAN 模板
- 初步 recon：项目使用 Next.js 16.3、Tailwind v4、shadcn/Radix、Motion；已有 iOS 视觉 token 和多处 spring，但存在 `transition-all`、Motion `x/y/width` 动画、缺少统一 reduced-motion/hover gating 等高价值审计点
- 按 `improve-animations` 先完成只读审计，并在 `animation-plans/` 写入审计、3 组实施计划和实施后复核；复核结论为 Approve
- 加入精确的 ease-out/ease-in-out/drawer Token、160ms pressable 反馈、精细指针 hover gating，以及 reduced motion / transparency / contrast 适配
- 高频导航改为静态活动态；移除时间线、账本和表单的重复进场；空间过渡统一为 180–220ms、完整 transform 字符串；清单进度改为 `scaleX`
- 使用 ImageGen 生成并迭代 Trace Logo，最终使用全幅蓝靛渐变、亲子脚印、路线和珊瑚色目的地图钉；接入 PWA 192/512/maskable/180、favicon、登录页、侧栏与 README
- 重写中文 README，覆盖定位、功能、Mermaid 架构图、本地开发、环境变量、Docker 部署、目录和设计原则，并明确项目无默认账号密码
- `git diff --check`、`pnpm typecheck`、`pnpm lint`、`pnpm build` 均通过；构建仍出现既有 `Couldn't load fs/zlib` 提示但不影响结果
- 首次 HTTP 冒烟因 `next build` 终止并行的 dev server 而失败；改用最新 production server 后 `/login`、manifest、icon 均 200，根路径 307 到登录页
- CUA 环境没有可用浏览器，无法执行页面截图；已用原始尺寸检查最终 192px Logo，清晰且四角无黑边
- 本机 buildx 成功构建 `linux/amd64` runner 镜像并通过 `deploy/deploy.sh` 上传；服务器迁移任务正常退出，`yukitrace-app` 重建后 Ready，PostgreSQL 保持 healthy
- 发布后 `mes-ui` 的 `nginx -t` 通过；服务器 Host 头 `/login` 200，本机绕过代理直连 `trace.aiyuki.cc` 根路径 307、登录页 200
- 生产返回的 192px 图标 SHA-256 与本地一致（`358e44c4…321c`），确认新 Logo 已进入生产镜像

### 阶段 8：生产第三方服务配置
- **状态：** complete
- 用户提供 AI 网关、模型名与新的高德 Key，并授权参考服务器同级 `hopportunity-agent/.env` 配置 OSS
- yukiTrace 当前 AI、高德和 OSS 关键凭据均为空；OSS 仅有默认 region，未实际启用
- 同级配置文件位于 `/root/docker-compose/hopportunity-agent/.env`，包含完整的 OSS Endpoint、Access Key、Secret、Bucket 与公开访问域名
- 本项目 `@ai-sdk/openai-compatible` 会自动在 `baseURL` 后追加 `/chat/completions`，因此生产 `AI_BASE_URL` 应填写用户地址去掉该尾路径后的 API 根地址
- hopportunity-agent 的 OSS endpoint 表明地域为 `oss-cn-shanghai`；其公开图片域名可映射到本项目的 `OSS_PUBLIC_BASE_URL`
- 首次远程更新脚本因服务器旧 Python 不支持 `dict[str, str]` 而在任何写入前退出；随后独立的容器重建仍执行，但只加载了原有空配置，不影响现有服务与数据
- 兼容脚本成功备份生产 `.env` 到 `.env.bak-services-20260905-101528`，写入 AI、OSS 与高德服务端配置，并保持文件权限 `600 root:root`
- 应用容器已重建；配置项状态检查全部非空（前端高德 JS Key/安全密钥按设计保持为空）
- 真实测试：高德 POI API 返回 HTTP 200、`status=1 / OK`；OSS Bucket list 返回 200；应用 3100 与 nginx Host 登录页均返回 200
- AI 网关最小对话已到达服务端，但返回 HTTP 403 `Model.AccessDenied`；需要继续确认模型授权或网关调用约定
- OSS 完整探针已验证 SDK 写入与读取成功，临时对象清理成功；但经参考项目公开域名读取返回 403，不能直接把该域名用于 yukiTrace 图片 URL
- 检查确认 `/api/files/[...key]` 已支持登录会话、分享 token、OSS `getObject` 与 sharp 缩略图；决定修正 `imageUrl()`，让私有 OSS 在未配置公开域名时复用该鉴权代理
- 私有 OSS 修复通过本地 typecheck/lint/build，已构建并部署新 amd64 镜像；生产 `OSS_PUBLIC_BASE_URL` 已清空，应用与数据库容器正常
- 首次私有代理探针因 standalone 镜像无法直接动态导入 `jose` 而中断，临时对象仍成功清理；将改用原生 HMAC 生成等价短期会话重试
- 改用 Node 原生 HMAC 后，私有 OSS 经生产 `/api/files` 鉴权代理返回 `200 image/webp`，缩略图数据有效，临时对象清理成功
- 复核发现文件路由原先只验证“存在登录会话”，未验证用户是否属于对象路径对应的旅程；私有 OSS 依赖代理后风险更高，已补充 Owner/Member 访问校验
- 用户要求将生产文本/视觉模型改为 `qwen3.7-plus`；已备份 `.env`、重建应用，普通对话、16×16 图片理解、自动 Function Calling 均返回 HTTP 200
- 重新部署私有 OSS 权限补丁；线上代理验证 owner=200/image/webp、其他登录用户=403、未登录=401，临时探针对象已删除

### 阶段 9：只读项目评估
- **状态：** complete（未实施新优化代码）
- 代码与生产环境检查：功能面已覆盖时间线、地图、账本、照片、宝宝记录、AI、分享、导出与 PWA
- 生产匿名数据量：1 用户、1 旅程，尚无站点/条目/花费/照片；数据库约 8 MB，应用/数据库内存约 60/36 MiB，当前容量充足
- 高优先级生产缺口：HTTPS、数据库备份、限流与收紧公开注册、自动化测试/CI、监控告警
- 高价值产品拓展：离线写入与恢复同步、真正的成员邀请/角色管理、全量 JSON/ZIP/PDF 导出、跨旅程家庭成长回顾

### 阶段 0：需求与规划
- **状态：** in_progress（规划文件已建，待用户确认）
- **开始时间：** 2026-09-05
- 执行的操作：
  - 测试 SSH 连接服务器 101.37.37.200 成功；目标目录为空
  - 与用户讨论产品定位、功能清单、AI 元素
  - 用户确认：高德地图、OSS、多用户可注册、CNY 主币种+外币、OpenAI 兼容 AI
  - 创建 task_plan.md / findings.md / progress.md
- 创建/修改的文件：
  - task_plan.md
  - findings.md
  - progress.md

### 阶段 1：项目骨架与基础设施
- **状态：** complete
- 执行的操作：
  - 脚手架 Next.js 16.3.4（pnpm），阅读 node_modules/next/dist/docs 升级指南（proxy.ts、异步 params、Turbopack）
  - 安装依赖，配置 pnpm onlyBuiltDependencies，shadcn init + 20 个基础组件
  - Prisma 7 schema（13 个模型）+ prisma.config.ts，本地 docker Postgres，`migrate dev --name init`
  - 自建会话认证（jose + bcryptjs）、DAL、proxy.ts、登录/注册页与 Server Actions
  - 苹果风设计 token 与布局壳（侧边栏 / 底部 Tab / 大标题）
  - Dockerfile + entrypoint（migrate deploy）+ 生产 compose + .env.example
  - typecheck / lint / build 全绿；curl 冒烟测试通过
- 创建/修改的文件：
  - prisma/schema.prisma, prisma.config.ts, prisma/migrations/20260905001510_init
  - src/lib/{db,session,dal}.ts, src/proxy.ts
  - src/app/globals.css, src/app/layout.tsx, src/app/page.tsx
  - src/app/(auth)/{layout.tsx,actions.ts,login/page.tsx,signup/page.tsx}, src/components/auth/auth-form.tsx
  - src/app/(app)/{layout.tsx,trips,map,ledger,me}/page.tsx
  - src/components/layout/{nav-items.ts,tab-bar.tsx,sidebar.tsx,page-header.tsx}
  - Dockerfile, .dockerignore, deploy/entrypoint.sh, docker-compose.yml, docker-compose.dev.yml, .env.example, next.config.ts

### 阶段 2：核心记录功能
- **状态：** complete
- 执行的操作：
  - 共享库：currency（18 币种/最小单位/格式化/折算）、geo（Haversine/格式化/模式推荐）、amap（服务端 POI/逆地理/路径/天气）、storage（OSS/本地抽象 + imageUrl）、entry-types（类型配置/图标/颜色/字段）、date
  - 旅程 actions + 列表/新建/编辑页 + TripCard/TripForm/TripHero
  - 旅程详情 actions：createStop/updateStop/deleteStop（含 leg 计算）、createEntry（可附花费）、createExpense（getRate）、deletePhoto、upsertDailyNote
  - 路由：/api/upload、/api/files/[...key]、/api/amap/search
  - 时间线组件 8 个 + 快速记录组件 7 个
  - 种子脚本造了「北海道 · 秋」示例旅程（4 站/2 条目/3 花费/1 日记），curl 验证渲染与上传
- 创建/修改的文件：
  - src/lib/{currency,geo,amap,storage,entry-types,date}.ts
  - src/app/(app)/trips/{actions.ts,page.tsx,new/page.tsx,[tripId]/page.tsx,[tripId]/actions.ts,[tripId]/edit/page.tsx}
  - src/app/api/{upload,files/[...key],amap/search}/route.ts
  - src/components/trips/{trip-card,trip-form,trip-hero,delete-trip-button}.tsx
  - src/components/timeline/{types,timeline,stop-card,entry-row,leg-divider,daily-note,photo-strip,expense-chip,item-menu}.tsx
  - src/components/quick-add/{quick-add,stop-form,entry-form,expense-form,photo-uploader,place-search,form-bits}.tsx
  - src/components/layout/back-button.tsx

### 阶段 3：地图与账本视图
- **状态：** complete
- 执行的操作：
  - 调用 dataviz skill，按其流程选型：分类用条形列表（直接标注 + 图标第二编码），按天用单序列柱状图；用 validate_palette.js 验证 iOS 7 色作分类色**不通过**（CVD ΔE 5.9、青色亮度越界、灰色饱和度不足），因此避免堆叠/多序列图，颜色只做装饰性身份
  - 地图：AMapView（loader + 标记 + 折线 + moveAlong 回放 + 降级 SVG）、TripMap、FootprintMap、两个页面
  - 账本：LedgerView 客户端组件（筛选/汇总/图表/明细），两个页面
  - 照片：PhotoGrid + 页面（删除 / 设为封面）
  - 编辑：updateEntry action；StopForm / EntryForm 支持 initial；EditDrawer
  - geo.ts 新增 wgs84ToGcj02 与 DAY_COLORS
- 创建/修改的文件：
  - src/components/map/{types,amap-view,route-sketch,trip-map,footprint-map}.tsx
  - src/components/ledger/ledger-view.tsx, src/components/photos/photo-grid.tsx
  - src/components/trips/trip-tabs.tsx, src/components/timeline/edit-drawer.tsx
  - src/app/(app)/trips/[tripId]/{map,ledger,photos}/page.tsx, src/app/(app)/{map,ledger}/page.tsx
  - src/lib/geo.ts, src/app/globals.css（.yt-marker / .yt-mover）

### 阶段 4：AI 助手
- **状态：** complete
- 执行的操作：
  - 读 ai@7 / @ai-sdk/openai-compatible@3 / @ai-sdk/react d.ts 确认 API：tool({inputSchema, execute})、stepCountIs、convertToModelMessages、toUIMessageStreamResponse、useChat({transport})、sendMessage({text})、ImagePart {type:"image", image, mediaType}
  - 写 model / tools / chat route / receipt route / ai-actions / AiChat / DailyNote(AI) / Checklist
  - /tmp/mock-openai.mjs 模拟 OpenAI SSE 与非流式响应，验证完整工具循环与结构化输出
- 创建/修改的文件：
  - src/lib/ai/{model,tools}.ts
  - src/app/api/ai/{chat,receipt}/route.ts
  - src/app/(app)/trips/[tripId]/{ai-actions.ts,checklist/actions.ts,checklist/page.tsx}
  - src/components/ai/ai-chat.tsx, src/components/checklist/checklist.tsx, src/components/timeline/daily-note.tsx
  - src/components/timeline/{types,timeline}.tsx, src/components/trips/trip-hero.tsx, src/app/(app)/trips/[tripId]/page.tsx

### 阶段 5：带娃专属与回顾分享
- **状态：** complete
- 执行的操作：
  - Stop.adcode 迁移；amap.reverseGeocode 返回 adcode；createStop 补天气
  - 宝宝状态：createBabyLog/deleteBabyLog、BabyLogForm、BabyStrip、TDay.babyLogs
  - 分享：share-actions、ShareSettings、/share/[token]、/api/files token 校验
  - 总结：SummarySlides + summary/page.tsx（统计、「第一次」抽取、最丰富一天）
  - 成长对照：/me 重写
  - CSV：/api/export/[tripId]
  - PWA：manifest.ts、public/sw.js、offline.html、icons、RegisterSW；proxy matcher 排除
- 创建/修改的文件：
  - prisma/schema.prisma, prisma/migrations/20260905004625_stop_adcode
  - src/lib/amap.ts, src/app/(app)/trips/[tripId]/{actions.ts,share-actions.ts,summary/page.tsx,edit/page.tsx,ledger/page.tsx}
  - src/components/quick-add/{baby-log-form,quick-add}.tsx, src/components/timeline/{baby-strip,types,timeline}.tsx
  - src/components/share/share-settings.tsx, src/app/share/[token]/page.tsx, src/app/api/files/[...key]/route.ts
  - src/components/summary/summary-slides.tsx, src/components/trips/trip-hero.tsx
  - src/app/(app)/me/page.tsx, src/app/api/export/[tripId]/route.ts
  - src/app/manifest.ts, public/sw.js, public/offline.html, public/icons/*, src/app/icon.png, src/components/pwa/register-sw.tsx, src/app/layout.tsx, src/proxy.ts

### 阶段 6：部署与验证
- **状态：** in_progress（服务器侧完成，等待安全组放行）
- 执行的操作：
  - 本地先用 arm64 跑通生产 compose（发现 pnpm 符号链接导致 prisma CLI 缺 @prisma/config → 拆出 npm 扁平安装的 migrate 镜像；`# syntax=` 指令拉取 docker.io 失败 → 删除）
  - buildx 构建 linux/amd64 runner + migrate，save/load 到服务器，compose up
  - 服务器本机验证：migrate 成功、/login 200、/ 307
  - 公网探测失败排查：本机 curl connect 2ms（TUN 代理劫持）；通过代理探测 80 秒回、3100/8080 5s 超时 → 安全组未放行
- 创建/修改的文件：
  - Dockerfile, docker-compose.yml, deploy/deploy.sh, .env.example, src/lib/session.ts
  - 服务器：/root/docker-compose/yukiTrace/{.env,docker-compose.yml,prisma.config.ts,prisma/}

### 阶段 11：时区 / 币种 / 图片格式
- **状态：** complete
- 关键决策：`fmt.*(date, tz?)` 保持向后兼容的可选第二参数，避免改写 28 个调用点的签名；时区解析集中在 `parseInTz`
- 迁移：`20260905043405_timezone_and_cny`（含 amountCnyMinor 回填 SQL）
- 修改文件：src/lib/{date,client-image}.ts、prisma/schema.prisma、trips 与 [tripId] 全部 actions/pages、timeline/quick-add/ledger/map/photos/summary/share 组件、api/{upload,export}、lib/ai/{tools}、api/ai/chat、docker-compose.yml、.env.example

### 阶段 12：协作与成员邀请
- **状态：** complete
- 迁移：`20260905043936_trip_invites`
- 注意：`/invite` 需加入 proxy PUBLIC_PATHS，否则未登录会被重定向而看不到邀请内容
- 新增文件：src/app/(app)/trips/[tripId]/member-actions.ts、members/page.tsx、src/app/invite/[token]/page.tsx、src/components/members/members-panel.tsx

### 阶段 13：工程质量
- **状态：** complete
- 新增：vitest.config.mts、playwright.config.ts、e2e/smoke.spec.ts、src/lib/{logger,rate-limit}.ts、src/lib/__tests__/*、src/app/{error,global-error,not-found}.tsx、(app)/loading.tsx、(app)/trips/[tripId]/loading.tsx
- 脚本：`pnpm test`（单测）、`pnpm test:e2e`（浏览器）
- 关键发现：Playwright 的 iPhone 设备档使用 WebKit，正好是本项目的目标浏览器；dev server 必须用与 webServer 相同的 host（localhost）访问，否则 Next 16 拦截 /_next 资源导致不 hydrate

### 阶段 14：离线记录队列
- **状态：** complete
- 设计取舍：不自己实现一套离线校验逻辑，`/api/sync` 直接把 JSON 还原成 FormData 调用原 Server Action，避免在线/离线两套规则漂移
- 新增：src/lib/offline/{types,queue,sync,use-offline-form}.ts、src/app/api/sync/route.ts、src/components/offline/sync-badge.tsx、e2e/offline.spec.ts

### 阶段 15：地图与外观
- **状态：** complete
- 坑：psql 不接受 Prisma 连接串里的 `?schema=public`，migrate.sh 需要先剥掉查询串
- 坑：`docker compose down -v` 会连开发库一起停（同一 CLI 不同 compose 文件），之后要记得 `docker compose -f docker-compose.dev.yml up -d`
- 新增：src/components/map/{map-view,maplibre-view,map-view-types}.tsx、src/components/{theme-provider,theme-toggle}.tsx、deploy/migrate.sh、e2e/theme-map.spec.ts

### 阶段 16：AI 第一档
- **状态：** complete
- 迁移：`20260905050523_photo_ai`、`20260905050744_push_subscriptions`
- 设计：作息提醒用中位间隔而非平均，避免一次异常喂奶拉偏基线；简报在接口内按旅程时区判断小时，crontab 只需每小时调一次
- 新增：src/lib/ai/{photo,briefing}.ts、src/lib/push.ts、src/app/api/ai/transcribe、api/push/subscribe、api/cron/briefing、src/components/ai/voice-button.tsx、src/components/pwa/push-toggle.tsx、deploy/crontab.example
- 坑：tsx 脚本里 import 带 `server-only` 的模块会失败，需要打桩 `_resolveFilename`

### 阶段 17：跨旅程记忆
- **状态：** complete
- 迁移：`20260905051155_embeddings`
- 取舍：pgvector 需要换数据库镜像（alpine 不带），而本项目数据量在千级，`Float[]` + 应用层余弦足够；若将来数据量上量再迁 pgvector
- 洞察刻意用统计而非模型：结果稳定、零成本、可解释，AI 只在用户主动提问时介入
- 新增：src/lib/ai/{memory,global-tools,on-this-day,insights}.ts、src/app/api/ai/{ask,import}、src/app/(app)/ask、src/components/ai/global-ask.tsx、src/components/trips/on-this-day-card.tsx、src/components/ledger/insights-row.tsx、src/components/quick-add/import-form.tsx

### 阶段 18：生成与开放
- **状态：** complete
- 迁移：`20260905052048_mcp_tokens`
- 取舍：PDF 用打印样式而非 PDF 库（中文字体、排版复用 CSS 都更省事）；MCP 手写 JSON-RPC 而非引 SDK（SDK 的 HTTP transport 需要 Node 原生 req/res，与 Route Handler 不合）
- 未做：地图回放录制成视频（成本高、替代方案已够用），已在计划中说明
- 新增：src/lib/ai/year-review.ts、src/lib/mcp-tokens.ts、src/app/api/mcp、src/app/(app)/year/[year]、settings/mcp、trips/[tripId]/album、src/components/summary/year-slides.tsx、src/components/settings/mcp-panel.tsx、src/components/photos/print-button.tsx

### 部署（2026-09-05）
- 生产原状：仅 2 个迁移、1 用户 1 旅程，数据量极小
- 迁移前做了一次性快照 `pre-deploy-20260905-1339.sql`（23K，非备份系统）
- 补齐生产 .env：TZ、VAPID 三项、CRON_SECRET（新生成）；AI_TRANSCRIBE_MODEL / AI_EMBEDDING_MODEL 留空待填
- 本机 buildx 构建 amd64（runner 254MB / migrate 294MB），gzip 流式传输约 20 秒
- 6 个迁移一次性应用成功，表数 15 → 18，原有数据完好
- 发现 alpine 缺 tzdata 导致 TZ 不生效，已在 runner 镜像补上并重新部署，容器时间为 CST
- 已安装 crontab：每小时调用 /api/cron/briefing

## 测试结果
| 测试 | 输入 | 预期结果 | 实际结果 | 状态 |
|------|------|---------|---------|------|
| 跨时区渲染 | 服务端 TZ=UTC，旅程 Tokyo + 站点 Shanghai 覆盖 | 07:30 / 14:10 / 19:00 | 完全一致（UTC 值仅出现在 RSC 序列化负载中） | ✅ |
| 全局账本 CNY 汇总 | 混合币种 | 按 amountCnyMinor 求和 | ¥7,246.66 | ✅ |
| 邀请链接全流程 | 生成→未登录查看→登录→加入→用尽 | 各状态正确 | 全部符合预期，成员数 1→2，角色 EDITOR | ✅ |
| 权限边界 | 非所有者访问成员页 | 无管理入口、有退出按钮 | 一致 | ✅ |
| 离线记账全链路 | Playwright setOffline | 入队→回放→落库 | 通过（含浮条状态与自动刷新） | ✅ |
| 迁移脚本（psql 版） | 全新库执行 + 重复执行 | 4 个迁移 / 0 个 | 一致，15 张表 | ✅ |
| 深色模式 | 系统深色 + 手动切浅色 + 刷新 | 类与背景亮度随之变化并持久 | 通过 | ✅ |
| 境外地图 | 东京站点 | 加载 MapLibre canvas | 通过 | ✅ |
| 照片视觉分析 | mock 网关 + 上传 | caption/tags/score/firstMoment 落库 | 全部写入，aiStatus=done | ✅ |
| 自动封面 | 分析后无封面旅程 | 选中高分照片 | hasCover=true | ✅ |
| 语音转写 | mock /audio/transcriptions | 返回文本 | 200 + 中文文本 | ✅ |
| 简报生成 | 三类简报 | 内容贴合数据 | 早/晚/作息均正确，喂奶间隔按中位数 3.0 小时 | ✅ |
| 简报接口鉴权 | 无 token / 错 token | 401 | 401 | ✅ |
| 真机推送送达 | iPhone 添加到主屏幕 | 收到通知 | 未测（需 HTTPS 与真机） | ⏳ |
| 向量索引与增量 | reindexTrip 连跑两次 | 首次建索引，第二次 0 条 | 一致 | ✅ |
| 语义搜索 | searchMemories | 返回带分数的结果 | 返回并排序（mock 向量为字符哈希，排序无语义意义） | ✅ |
| 智能导入 | 粘贴航班+酒店文本 | 解析出 2 条草稿 | FLIGHT + HOTEL，meta 字段齐全 | ✅ |
| 那年今日 | 去年今天的站点 | 卡片显示地点与月龄 | 「1 年前的今天 小樽运河 1 岁 2 个月」 | ✅ |
| 消费洞察 | 有花费的旅程 | 分类占比等 | 洞察/日均/餐饮占了/宝宝相关 | ✅ |
| MCP 协议 | initialize / tools/list / tools/call | 符合 JSON-RPC 与 MCP 规范 | 握手成功，5 个工具带 JSON Schema，listTrips 返回真实数据 | ✅ |
| MCP 鉴权 | 无令牌 / 错令牌 | 401 | 401 + WWW-Authenticate | ✅ |
| 年度回顾 | 当年数据 | 统计 + 给宝宝的信 | 全部渲染 | ✅ |
| 打印相册 | /album | 打印样式与照片 | 200，含导出按钮与内容 | ✅ |
| 生产部署 | 6 个迁移 + 新镜像 | 迁移成功、数据完好、页面正常 | 迁移 8 条记录、18 张表、1 用户 1 旅程保留 | ✅ |
| 生产鉴权边界 | 未登录访问各页 | 受保护 307、公开 200 | 完全符合 | ✅ |
| 生产 cron 与 MCP | 无口令 / 有口令 | 401 / 200 | 401 / {"ok":true} | ✅ |
| 单元测试 | pnpm test | 全绿 | 40 passed | ✅ |
| 浏览器冒烟 | pnpm test:e2e（WebKit/iPhone 14） | 5 条主线通过 | 5 passed | ✅ |
| 快速记录抽屉真机交互 | 浏览器点击 FAB → 地点/花费 | 抽屉打开并提交成功 | 通过 | ✅ |
| 跨时区渲染（浏览器） | 服务器 TZ=UTC，旅程 Tokyo | 显示 14:10 | 通过 | ✅ |
| 结构化日志 | 真实上传请求 | JSON 行含 userId/tripId | upload.done 输出正确 | ✅ |
| SSH 连接 | ssh root@101.37.37.200 | 连接成功 | CONNECTED，Alibaba Cloud Linux 8 | ✅ |
| 类型检查 | pnpm typecheck | 0 错误 | 0 错误 | ✅ |
| Lint | pnpm lint | 0 错误 | 0 错误 | ✅ |
| 生产构建 | pnpm build | 成功 | 成功，8 个路由 + Proxy | ✅ |
| 未登录访问 / 和 /trips | curl | 307 → /login?next=… | 307 → /login?next=%2Ftrips | ✅ |
| 带会话访问 /trips /me | curl + jose 签发 cookie | 200 且渲染用户名 | 200，渲染「测试妈妈」「test@example.com」 | ✅ |
| 已登录访问 /login | curl | 307 → /trips | 307 → /trips | ✅ |
| 伪造 cookie 访问 /trips | curl | 307 → /login | 307 → /login | ✅ |
| 旅程列表渲染 | 种子 1 个旅程 | 标题/站数/总花费 | 「北海道 · 秋」「4 站」「¥6,992」 | ✅ |
| 旅程详情时间线 | 4 站 2 条目 3 花费 | Day 1-5、站点、距离、月龄、外币折算 | 全部出现：驾车 43/55 km、直线 2,180 km、1 岁 3 个月、¥2,800 JPY ≈¥134 | ✅ |
| 照片上传 | curl multipart 640x480 jpg | 200，写入 uploads/，关联站点 | 200，webp 640x480，stopId 正确 | ✅ |
| 缩略图读取 | /api/files/…?w=300 | 200 image/webp 300px | 200 image/webp 300x225 | ✅ |
| 文件路由鉴权 | 无 cookie | 401 | 401 | ✅ |
| 高德搜索未配置降级 | /api/amap/search?q=札幌 | configured:false | {"results":[],"configured":false} | ✅ |
| 阶段 3 六个页面 | curl + 会话 | 全部 200 且含关键文案 | map/ledger/photos/全局 map/全局 ledger/时间线 全 200，文案齐全 | ✅ |
| AI chat 工具循环 | mock OpenAI，"刚吃了拉面 2800 日元" | tool_call addExpense → 写库 → 文本回复 | 流中出现 tool-input/output-available、text-delta；账本出现「拉面 ¥2,800 JPY」 | ✅ |
| AI receipt 识别 | mock + 测试图片 | 返回结构化 JSON | 200，kind/title/amount/items 齐全 | ✅ |
| AI 未配置 / 未登录 | POST /api/ai/chat | 503 / 401 | 401（未登录）；503 分支代码存在未单测 | ✅ |
| 分享页免登录 | /share/testtoken123 | 200 且隐藏花费 | 200，含站点/日记/路线图，无花费 | ✅ |
| 分享 token 文件鉴权 | /api/files/…?t=正确/错误 | 200 / 401 | 200 / 401 | ✅ |
| 总结页 | /trips/[id]/summary | 统计与「第一次」 | 200，坐了 1 次飞机、第一次坐飞机、最丰富的一天 | ✅ |
| CSV 导出 | /api/export/[id] | 200 text/csv 带 BOM | 200，3 行含表头，中文文件名 | ✅ |
| PWA 资产 | manifest / sw.js / offline.html / icon | 全 200 | 修 proxy 后全 200 | ✅ |
| 生产镜像本地启动 | compose up (arm64) | migrate 成功 + /login 200 | 成功；runner 232MB | ✅ |
| 服务器部署 | compose up (amd64) | 同上 | migrate 成功；本机 curl /login 200 | ✅ |
| 公网访问 http://101.37.37.200:3100 | 本机 curl | 200 | 无法判定（本机代理劫持）；推断安全组未放行 | ⏳ |
| 长图生成 / 离线 SW 行为 | 浏览器 | 下载 PNG / 离线可看 | 未测（无浏览器） | ⏳ |
| 真实模型对话/视觉/工具 | `qwen3.7-plus` | 普通对话、图片理解、自动工具调用成功 | 三项均 HTTP 200 | ✅ |
| 高德真实地图渲染 / 回放动画 | 浏览器 + Key | 显示地图 | 未测（无 Key、无浏览器），降级 SVG 已验证 | ⏳ |
| 高德 Web 服务 Key | 容器内直接请求 POI API | status=1 | status=1 / info=OK | ✅ |
| 私有 OSS 文件权限 | owner / 其他用户 / 匿名 | 200 / 403 / 401 | 200 / 403 / 401，探针已删除 | ✅ |
| 注册/登录 Server Action 端到端 | Playwright WebKit | 成功注册并登录 | 通过 | ✅ |

## 错误日志
| 时间戳 | 错误 | 尝试次数 | 解决方案 |
|--------|------|---------|---------|
| 2026-09-05 | `qwen3.7-plus` 1×1 图片测试不满足模型尺寸限制 | 1 | 改用 16×16 图片后返回 200，识别为白色 |
| 2026-09-05 | thinking mode 拒绝 object 形式的强制 `tool_choice` | 1 | 按项目实际用法改测自动选择，正常返回 `tool_calls` |
| 2026-09-05 | 首次读取 Next.js 环境变量文档使用了旧目录结构 | 1 | 从 `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md` 读取 Next 16 当前文档 |
| 2026-09-05 | 远程配置长度检查的 shell 引号嵌套被本地 zsh 拒绝 | 1 | 改用 awk 检查原始值长度，不重复复杂 case 引号方案 |

## 五问重启检查
| 问题 | 答案 |
|------|------|
| 我在哪里？ | 阶段 6：已部署，等待用户放行安全组并真机走查 |
| 我要去哪里？ | 阶段 1 搭骨架 → 阶段 2 核心记录 → 阶段 3 地图账本 → 阶段 4 AI → 阶段 5 带娃/回顾 → 阶段 6 部署 |
| 目标是什么？ | 苹果风带娃旅行记录 + 账本 Web 应用，含高德地图与 AI 助手，部署到阿里云 |
| 我学到了什么？ | 见 findings.md |
| 我做了什么？ | 见上方记录 |

---
*每个阶段完成后或遇到错误时更新此文件*
