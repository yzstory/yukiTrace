"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { verifySession, requireTripAccess } from "@/lib/dal";
import { CURRENCIES } from "@/lib/currency";
import { TIMEZONES } from "@/lib/date";

export type ActionState = { error?: string; ok?: boolean } | undefined;

const tripSchema = z.object({
  title: z.string().trim().min(1, "请填写旅程名称").max(60),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择开始日期"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "请选择结束日期"),
  homeCurrency: z.string().refine((c) => CURRENCIES.some((x) => x.code === c), "货币不支持"),
  timezone: z.string().refine((t) => TIMEZONES.some((x) => x.value === t), "时区不支持").default("Asia/Shanghai"),
  babyName: z.string().trim().max(30).optional().or(z.literal("")),
  babyBirthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  travelers: z.string().optional(),
});

function parseTrip(formData: FormData) {
  const parsed = tripSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message } as const;
  const d = parsed.data;
  if (d.endDate < d.startDate) return { error: "结束日期不能早于开始日期" } as const;
  return {
    data: {
      title: d.title,
      description: d.description || null,
      startDate: new Date(d.startDate),
      endDate: new Date(d.endDate),
      homeCurrency: d.homeCurrency,
      timezone: d.timezone,
      babyName: d.babyName || null,
      babyBirthDate: d.babyBirthDate ? new Date(d.babyBirthDate) : null,
      travelers: (d.travelers ?? "")
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    },
  } as const;
}

export async function createTrip(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { userId } = await verifySession();
  const r = parseTrip(formData);
  if ("error" in r) return { error: r.error };
  const trip = await db.trip.create({
    data: { ...r.data, ownerId: userId, members: { create: { userId, role: "OWNER" } } },
  });
  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

export async function updateTrip(tripId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireTripAccess(tripId, "EDITOR");
  const r = parseTrip(formData);
  if ("error" in r) return { error: r.error };
  await db.trip.update({ where: { id: tripId }, data: r.data });
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}`);
}

export async function deleteTrip(tripId: string) {
  await requireTripAccess(tripId, "OWNER");
  await db.trip.delete({ where: { id: tripId } });
  revalidatePath("/trips");
  redirect("/trips");
}

export async function setTripCover(tripId: string, coverKey: string | null) {
  await requireTripAccess(tripId, "EDITOR");
  await db.trip.update({ where: { id: tripId }, data: { coverKey } });
  revalidatePath("/trips");
  revalidatePath(`/trips/${tripId}`);
}
