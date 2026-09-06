import { Map, Footprints, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: "/trips" | "/map" | "/me"; label: string; icon: LucideIcon };

/** 三个主入口就够：账本在旅程里，AI 助手是全站悬浮按钮 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/trips", label: "旅程", icon: Footprints },
  { href: "/map", label: "地图", icon: Map },
  { href: "/me", label: "我", icon: UserRound },
];
