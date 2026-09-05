"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * 当前站点 origin。服务端渲染为空串，客户端挂载后给出真实值，
 * 通过 useSyncExternalStore 保证两端首屏一致，避免 hydration 文本不匹配。
 */
export function useOrigin() {
  return useSyncExternalStore(
    subscribe,
    () => window.location.origin,
    () => ""
  );
}
