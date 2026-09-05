# 003 · 空间过渡与渲染性能

## 目标

保留真正解释空间关系的过渡，同时确保动画只依赖 `transform` 与 `opacity`。

## 涉及文件

- `src/components/quick-add/quick-add.tsx`
- `src/components/ai/ai-chat.tsx`
- `src/components/checklist/checklist.tsx`
- `src/components/trips/trip-card.tsx`
- `src/components/trips/trip-hero.tsx`
- `src/components/trips/trip-form.tsx`
- `src/components/summary/summary-slides.tsx`
- `src/components/photos/photo-grid.tsx`
- `src/components/timeline/photo-strip.tsx`

## 实施

1. 快捷添加器内部层级切换保留水平空间关系，使用完整 `transform: translateX(...)`，180ms `--ease-out`。
2. 浮动操作按钮、照片缩略图和卡片按压统一用 CSS `pressable`；悬停反馈仅在 `(hover: hover) and (pointer: fine)` 下启用。
3. AI 消息和必要页面进场从 `x/y/scale` 简写改为完整 `transform`，并把装饰性幅度压缩到 6–12px。
4. 清单进度和统计条改用 `transform: scaleX(...)`，设置左侧 `transform-origin`；清单删除的高度收拢保留为可接受例外。
5. 灯箱只动画遮罩透明度和内容 transform，不动画布局属性。

## 验收

- `rg 'animate=\{\{[^}]*width|initial=\{\{[^}]*(x|y|scale)' src/components` 不再发现计划范围内的高风险用法。
- hover 动效只对精细指针生效。
- 开启减少动态效果时，空间过渡退化为淡入或即时切换。
- 在移动端连续打开快捷添加器、照片灯箱与清单操作时无明显掉帧。
