import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "짝꿍 · 중학생 멘토링 매칭", description: "나와 딱 맞는 공부 짝꿍을 찾아보세요." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
