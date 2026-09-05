# 002 · 高频导航与列表克制化

## 目标

移除每天会重复触发的装饰性动画，让导航、时间线和数据页响应更直接。

## 涉及文件

- `src/components/layout/tab-bar.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/trips/trip-tabs.tsx`
- `src/components/timeline/stop-card.tsx`
- `src/components/ledger/ledger-view.tsx`

## 实施

1. 底部标签栏删除 Motion `scale(.85)`，改为静态选中态和统一 `pressable` 反馈。
2. 侧栏及旅程详情标签移除 `layoutId` 弹簧滑块；活动项直接通过背景、颜色、字重呈现。
3. 时间线停靠卡片不再逐项从下方弹入；数据出现即就位。
4. 账本概览与分类统计不再每次加载动画数值条；保持数据稳定、便于比较。
5. 保留抽屉、模态层和明确空间导航所需的动效。

## 验收

- 快速切换导航无等待、无布局滑块追赶。
- 页面数据不会在每次访问时重复播放进场。
- 所有活动态在不依赖动画时仍清晰可辨。
