import {
  Plane,
  Car,
  TrainFront,
  CarTaxiFront,
  BedDouble,
  UtensilsCrossed,
  Ticket,
  ShoppingBag,
  Sparkles,
  MapPin,
  Building2,
  PlaneTakeoff,
  Landmark,
  TreePine,
  Store,
  Wallet,
  Baby,
  type LucideIcon,
} from "lucide-react";
import type { EntryType, StopType, ExpenseCategory } from "@/generated/prisma/enums";

export type FieldDef = { key: string; label: string; placeholder?: string; type?: "text" | "number" | "datetime-local" };

export type EntryTypeConfig = {
  label: string;
  icon: LucideIcon;
  color: string; // tailwind text color class
  bg: string; // tailwind bg class
  defaultCategory: ExpenseCategory;
  fields: FieldDef[];
};

export const ENTRY_TYPES: Record<EntryType, EntryTypeConfig> = {
  FLIGHT: {
    label: "航班",
    icon: Plane,
    color: "text-ios-blue",
    bg: "bg-ios-blue/12",
    defaultCategory: "TRANSPORT",
    fields: [
      { key: "flightNo", label: "航班号", placeholder: "CA1234" },
      { key: "airline", label: "航空公司", placeholder: "国航" },
      { key: "from", label: "出发机场", placeholder: "PVG 浦东 T2" },
      { key: "to", label: "到达机场", placeholder: "CTS 新千岁" },
      { key: "seat", label: "座位", placeholder: "23A" },
    ],
  },
  CAR_RENTAL: {
    label: "租车",
    icon: Car,
    color: "text-ios-indigo",
    bg: "bg-ios-indigo/12",
    defaultCategory: "TRANSPORT",
    fields: [
      { key: "company", label: "租车公司", placeholder: "Toyota Rent a Car" },
      { key: "carModel", label: "车型", placeholder: "Sienta" },
      { key: "pickupPlace", label: "取车地点" },
      { key: "returnPlace", label: "还车地点" },
      { key: "plate", label: "车牌" },
      { key: "startKm", label: "取车里程 (km)", type: "number" },
      { key: "endKm", label: "还车里程 (km)", type: "number" },
    ],
  },
  TRAIN: {
    label: "火车",
    icon: TrainFront,
    color: "text-ios-teal",
    bg: "bg-ios-teal/15",
    defaultCategory: "TRANSPORT",
    fields: [
      { key: "trainNo", label: "车次", placeholder: "G1234" },
      { key: "from", label: "出发站" },
      { key: "to", label: "到达站" },
      { key: "seat", label: "座位" },
    ],
  },
  TAXI: {
    label: "打车",
    icon: CarTaxiFront,
    color: "text-ios-yellow",
    bg: "bg-ios-yellow/20",
    defaultCategory: "TRANSPORT",
    fields: [
      { key: "from", label: "起点" },
      { key: "to", label: "终点" },
    ],
  },
  HOTEL: {
    label: "住宿",
    icon: BedDouble,
    color: "text-ios-purple",
    bg: "bg-ios-purple/12",
    defaultCategory: "ACCOMMODATION",
    fields: [
      { key: "roomType", label: "房型", placeholder: "家庭房" },
      { key: "bookingRef", label: "预订号" },
      { key: "hasCrib", label: "婴儿床 (有/无)" },
    ],
  },
  MEAL: {
    label: "餐食",
    icon: UtensilsCrossed,
    color: "text-ios-orange",
    bg: "bg-ios-orange/15",
    defaultCategory: "FOOD",
    fields: [{ key: "dishes", label: "吃了什么", placeholder: "汤咖喱、成吉思汗烤肉" }],
  },
  ACTIVITY: {
    label: "游玩",
    icon: Ticket,
    color: "text-ios-green",
    bg: "bg-ios-green/15",
    defaultCategory: "ACTIVITY",
    fields: [{ key: "ticket", label: "门票信息" }],
  },
  SHOPPING: {
    label: "购物",
    icon: ShoppingBag,
    color: "text-ios-pink",
    bg: "bg-ios-pink/12",
    defaultCategory: "SHOPPING",
    fields: [{ key: "items", label: "买了什么" }],
  },
  MOMENT: {
    label: "此刻",
    icon: Sparkles,
    color: "text-ios-gray",
    bg: "bg-fill",
    defaultCategory: "OTHER",
    fields: [],
  },
};

export const ENTRY_TYPE_ORDER: EntryType[] = ["MOMENT", "MEAL", "ACTIVITY", "HOTEL", "FLIGHT", "CAR_RENTAL", "TRAIN", "TAXI", "SHOPPING"];

export const STOP_TYPES: Record<StopType, { label: string; icon: LucideIcon }> = {
  CITY: { label: "城市", icon: Building2 },
  AIRPORT: { label: "机场", icon: PlaneTakeoff },
  STATION: { label: "车站", icon: TrainFront },
  HOTEL: { label: "酒店", icon: BedDouble },
  RESTAURANT: { label: "餐厅", icon: UtensilsCrossed },
  ATTRACTION: { label: "景点", icon: Landmark },
  SHOP: { label: "商店", icon: Store },
  PARK: { label: "公园", icon: TreePine },
  OTHER: { label: "地点", icon: MapPin },
};

export const EXPENSE_CATEGORIES: Record<ExpenseCategory, { label: string; icon: LucideIcon; color: string }> = {
  TRANSPORT: { label: "交通", icon: Plane, color: "var(--ios-blue)" },
  ACCOMMODATION: { label: "住宿", icon: BedDouble, color: "var(--ios-purple)" },
  FOOD: { label: "餐饮", icon: UtensilsCrossed, color: "var(--ios-orange)" },
  ACTIVITY: { label: "游玩", icon: Ticket, color: "var(--ios-green)" },
  SHOPPING: { label: "购物", icon: ShoppingBag, color: "var(--ios-pink)" },
  BABY: { label: "宝宝", icon: Baby, color: "var(--ios-teal)" },
  OTHER: { label: "其他", icon: Wallet, color: "var(--ios-gray)" },
};

export const BABY_TAGS: Record<string, string> = {
  nursing_room: "母婴室",
  changing_table: "尿布台",
  high_chair: "儿童座椅",
  stroller_ok: "推车友好",
  kids_menu: "儿童餐",
  crib: "婴儿床",
  play_area: "游乐区",
};
