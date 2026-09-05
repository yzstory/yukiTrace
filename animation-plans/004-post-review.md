# 004 · 实施后动效复核

复核范围：阶段 7 的全局动效基础设施、导航、快捷记录、列表、账本、照片和认证界面。

| Before | After | Why |
|---|---|---|
| 4 类基础组件与 3 类快捷表单选项使用 `transition-all` | 搜索 `src/` 已无 `transition-all`，全部改为属性级过渡 | 通过，避免布局属性和未来新增属性被意外动画 |
| Tab Bar 按下缩到 `0.85`，侧栏与旅程 Tab 使用共享布局弹簧 | 高频导航使用静态活动态，统一 `160ms / scale(.97)` 指针反馈 | 通过，状态识别不依赖动画，切换更直接 |
| 时间线、账本、旅程卡和表单在每次加载时从下方弹入 | 高频内容直接就位，只保留登录首屏、AI 新消息和总结卡片的短进场 | 通过，保留了有意义的出现反馈并减少重复表演 |
| 快捷层级切换和消息使用 Motion `x/y/scale` 简写 | 使用完整 `transform` 字符串，180–220ms `--ease-out` | 通过，只动画合成属性且时序统一 |
| 清单进度与分类条动画 `width` | 清单进度改为 `scaleX`；静态统计条直接按最终宽度呈现 | 通过，动态状态不触发布局，数据视图稳定 |
| 无全局减少动态、减少透明度和高对比度适配 | `MotionConfig reducedMotion="user"` 与三组 CSS media query 同时覆盖 | 通过，系统偏好可以完整降级动效与材质 |
| 浮动按钮在触屏与鼠标上都触发 hover 弹簧 | CSS hover 仅在 `(hover: hover) and (pointer: fine)` 生效 | 通过，避免触控设备悬停粘滞 |

## 验证

- `git diff --check`：通过
- `pnpm typecheck`：通过
- `pnpm lint`：通过
- `pnpm build`：通过，17 个静态页面生成完成
- HTTP 冒烟：`/login`、`/manifest.webmanifest`、`/icons/icon-192.png` 返回 200；根路径返回 307 到登录页
- 浏览器 UI 自动化：当前运行环境未提供可用浏览器，未执行像素级页面截图；Logo 已分别以 1254px 与 192px 检视

**Verdict: Approve**

