import type { BabyLogType, EntryType, ExpenseCategory, StopType, TravelMode } from "@/generated/prisma/enums";

export type TBabyLog = { id: string; type: BabyLogType; at: Date; note: string | null };

export type TPhoto = { id: string; url: string; thumbUrl: string; width: number | null; height: number | null; caption: string | null; takenAt: Date | null };
export type TExpense = { id: string; title: string; amountMinor: number; currency: string; amountHomeMinor: number; category: ExpenseCategory; isBaby: boolean; paidAt: Date };
export type TEntry = {
  id: string;
  type: EntryType;
  title: string;
  note: string | null;
  startAt: Date;
  endAt: Date | null;
  meta: Record<string, unknown> | null;
  expenses: TExpense[];
  photos: TPhoto[];
};
export type TLeg = { mode: TravelMode; distanceM: number; durationS: number | null };
export type TStop = {
  id: string;
  name: string;
  type: StopType;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  arriveAt: Date;
  leaveAt: Date | null;
  note: string | null;
  babyTags: string[];
  timezone: string | null;
  weather: { weather?: string; temperature?: string } | null;
  entries: TEntry[];
  expenses: TExpense[];
  photos: TPhoto[];
  /** 与上一站的距离 */
  legFromPrev: TLeg | null;
};
export type TDay = {
  index: number;
  date: Date;
  note: string | null;
  aiDraft: string | null;
  stops: TStop[];
  looseEntries: TEntry[];
  looseExpenses: TExpense[];
  loosePhotos: TPhoto[];
  babyLogs: TBabyLog[];
  totalHomeMinor: number;
};
export type TTrip = {
  id: string;
  title: string;
  homeCurrency: string;
  startDate: Date;
  endDate: Date;
  babyName: string | null;
  babyBirthDate: Date | null;
  canEdit: boolean;
  aiConfigured: boolean;
  timezone: string;
};
