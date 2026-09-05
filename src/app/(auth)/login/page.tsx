import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "登录" };

export default async function LoginPage(props: PageProps<"/login">) {
  const sp = await props.searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  return <AuthForm mode="login" next={next} allowSignup={process.env.ALLOW_SIGNUP !== "false"} />;
}
