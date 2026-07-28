import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "배움짝 · 스마트 피어 매칭",
  description: "학생은 진단하고, 교사는 학급 전체를 한눈에 확인하는 협력 학습 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
