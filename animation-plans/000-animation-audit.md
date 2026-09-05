# Trace 动效审计

审计基线：`b663c17`

采用 `improve-animations` 与 `review-animations` 的双阶段流程：先判断动效是否值得存在，再检查交互时序、性能与无障碍。

| Before | After | Why |
|---|---|---|
| 底部导航、侧栏和详情页标签通过 `scale(.85)` 或共享布局弹簧强调每次切换 | 高频导航改为静态选中态，仅保留轻微按压反馈 | 导航属于每天高频操作，持续的布局动画会拖慢感知速度；选中状态本身已经足够清晰 |
| 通用按钮、开关、徽章、标签和快捷表单选项使用 `transition-all` | 只过渡 `transform`、`opacity`、颜色、背景色和阴影等明确属性 | 避免意外动画和布局相关属性抖动，提高可预测性与渲染性能 |
| 多处 Motion 使用 `x`、`y`、`scale` 简写，清单进度和统计条直接动画 `width` | 位移动画改用完整 `transform` 字符串；进度条改用 `scaleX` | 合并变换可减少 Motion 的 transform 组装开销；`scaleX` 不触发布局重排 |
| 页面、卡片和列表普遍使用弹簧式进场，时间与缓动缺少统一语义 | 只在建立空间关系、抽屉/模态层和状态变化时保留动效，并统一到三组缓动 Token | 让产品更克制、更接近 Apple 平台的响应节奏，避免所有元素“从外面飞入” |
| Motion 组件和玻璃材质没有全局减少动态/透明度策略 | 根布局启用 `MotionConfig reducedMotion="user"`，CSS 增加 reduced-motion、reduced-transparency 和 more-contrast 兜底 | 尊重系统辅助功能设置，保证动画不是理解界面的前提 |

结论：**Needs changes**。优先执行 3 组高收益修复：动效基础设施、高频导航去动效、GPU 友好的状态与空间过渡。

