import type { Metadata, Viewport } from "next";
import { Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import { ThemeProvider } from "@/components/theme-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import "./globals.css";

/** 展示字体：构建时下载并自托管，国内访问不依赖 Google 域名 */
const fraunces = Fraunces({
  subsets: ["latin"],
  // 可变字体：不指定 weight 列表即为全部权重，axes 才允许声明
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Trace · 带娃旅行记", template: "%s · Trace" },
  description: "记录带宝宝出行的每一站：行程、花费、照片与回忆。",
  applicationName: "Trace",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Trace" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/icon-180.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1917" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className={`h-full antialiased ${fraunces.variable}`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col paper">
        <ThemeProvider>
        <MotionProvider>
          {children}
          <Toaster position="top-center" />
          <RegisterSW />
        </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
