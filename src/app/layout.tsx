import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import { RegisterSW } from "@/components/pwa/register-sw";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f4f4f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" />
        <RegisterSW />
      </body>
    </html>
  );
}
