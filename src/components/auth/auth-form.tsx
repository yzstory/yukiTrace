"use client";

import { useActionState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "motion/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, signup, type AuthState } from "@/app/(auth)/actions";

type Props = { mode: "login" | "signup"; next?: string; allowSignup: boolean };

export function AuthForm({ mode, next, allowSignup }: Props) {
  const action = mode === "login" ? login : signup;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, undefined);

  return (
    <motion.div
      initial={{ opacity: 0, transform: "translateY(10px) scale(0.98)" }}
      animate={{ opacity: 1, transform: "translateY(0px) scale(1)" }}
      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <Image src="/icons/icon-192.png" alt="Trace" width={64} height={64} className="mb-4 size-16 rounded-2xl float-shadow" priority />
        <p className="eyebrow mb-1">Trace · Journal</p>
        <h1 className="font-display text-title-1">{mode === "login" ? "欢迎回来" : "创建账号"}</h1>
        <p className="mt-1 text-subhead text-muted-foreground">
          {mode === "login" ? "继续记录你们的旅程" : "开始记录带宝宝出行的每一站"}
        </p>
      </div>

      <form action={formAction} className="rounded-3xl bg-card p-5 card-shadow">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="flex flex-col gap-4">
          {mode === "signup" && (
            <Field label="昵称" name="name" placeholder="比如：妈妈" autoComplete="nickname" />
          )}
          <Field label="邮箱" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
          <Field
            label="密码"
            name="password"
            type="password"
            placeholder="至少 6 位"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>

        {state?.error && (
          <motion.p
            initial={{ opacity: 0, transform: "translateY(-4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-footnote text-destructive"
          >
            {state.error}
          </motion.p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="mt-6 h-12 w-full rounded-xl text-body font-semibold">
          {pending ? <Loader2 className="size-5 animate-spin" /> : mode === "login" ? "登录" : "注册"}
        </Button>
      </form>

      <p className="mt-6 text-center text-subhead text-muted-foreground">
        {mode === "login" ? (
          allowSignup ? (
            <>
              还没有账号？{" "}
              <Link href="/signup" className="font-medium text-primary">
                注册
              </Link>
            </>
          ) : (
            "当前未开放注册"
          )
        ) : (
          <>
            已有账号？{" "}
            <Link href="/login" className="font-medium text-primary">
              登录
            </Link>
          </>
        )}
      </p>
    </motion.div>
  );
}

function Field({
  label,
  name,
  ...rest
}: { label: string; name: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name} className="text-footnote font-medium text-muted-foreground">
        {label}
      </Label>
      <Input id={name} name={name} required className="h-11 rounded-xl bg-fill-secondary text-body" {...rest} />
    </div>
  );
}
