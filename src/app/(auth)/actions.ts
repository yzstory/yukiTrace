"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSession, deleteSession } from "@/lib/session";
import { asActionResult } from "@/lib/api/errors";
import { fromForm } from "@/lib/services/input";
import { verifyCredentials, registerUser } from "@/lib/services/auth";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export type AuthState = { error?: string } | undefined;

function safeNext(next: unknown) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/trips";
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const r = await asActionResult(async () => verifyCredentials(fromForm(formData), await clientKey()));
  if ("error" in r) return r;
  await createSession(r.id);
  redirect(safeNext(formData.get("next")));
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const r = await asActionResult(async () => registerUser(fromForm(formData), await clientKey()));
  if ("error" in r) return r;
  await createSession(r.id);
  redirect("/trips");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
