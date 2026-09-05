# 001 · 动效基础设施与交互反馈

## 目标

建立全局统一、可访问的动效基线，消除 `transition-all`，并让触控反馈在 160ms 内完成。

## 涉及文件

- `src/app/globals.css`
- `src/app/layout.tsx`
- `src/components/motion/motion-provider.tsx`（新增）
- `src/components/ui/button.tsx`
- `src/components/ui/switch.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/tabs.tsx`
- `src/components/quick-add/form-bits.tsx`
- `src/components/quick-add/expense-form.tsx`
- `src/components/quick-add/baby-log-form.tsx`

## 实施

1. 在全局主题中加入精确 Token：
   - `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
   - `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)`
   - `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`
2. 增加 `pressable` 工具类：只过渡 `transform`，160ms，指针按下 `scale(.97)`；禁用态不响应。
3. 将 UI 基础组件和快捷表单中的 `transition-all` 替换为明确属性。
4. 新增客户端 `MotionProvider`，使用 `MotionConfig reducedMotion="user"` 包裹应用。
5. 增加系统偏好兜底：
   - `prefers-reduced-motion: reduce` 时取消非必要时长和滚动行为；
   - `prefers-reduced-transparency: reduce` 时将玻璃层变为不透明表面；
   - `prefers-contrast: more` 时增强边框与标签对比度。

## 验收

- `rg 'transition-all' src` 无结果。
- 键盘激活不会触发位移动画。
- 开启“减少动态效果”时，没有位移和缩放动画。
- `pnpm typecheck`、`pnpm lint`、`pnpm build` 通过。

