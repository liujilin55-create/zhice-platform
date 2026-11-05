import type { Metadata } from "next";
import "./globals.css";
import { VerificationProvider } from "@/modules/verification";

export const metadata: Metadata = { title: "知策台 · AI 项目执行系统", description: "从一份赛题到一套可执行的项目计划" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}<VerificationProvider /></body></html>;
}
