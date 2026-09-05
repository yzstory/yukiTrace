import { Map, Footprints, Wallet, UserRound, Sparkles, type LucideIcon } from "lucide-react";

export type NavItem = { href: "/trips" | "/map" | "/ledger" | "/ask" | "/me"; label: string; icon: LucideIcon };

export const NAV_ITEMS: NavItem[] = [
  { href: "/trips", label: "旅程", icon: Footprints },
  { href: "/map", label: "地图", icon: Map },
  { href: "/ledger", label: "账本", icon: Wallet },
  { href: "/ask", label: "问问", icon: Sparkles },
  { href: "/me", label: "我", icon: UserRound },
];
