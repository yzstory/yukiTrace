import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "注册" };

export default function SignupPage() {
  if (process.env.ALLOW_SIGNUP === "false") redirect("/login");
  return <AuthForm mode="signup" allowSignup />;
}
