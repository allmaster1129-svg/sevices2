import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jjakkung-mentoring.lumiolab-4734.chatgpt.site"),
  title: "배움짝 · 스마트 피어 매칭",
  description: "학생은 진단하고, 교사는 학급 전체를 한눈에 확인하는 협력 학습 서비스",
  openGraph: {
    title: "배움짝 · 학생 맞춤 학습과 교사 수업 설정",
    description: "학생은 역할에 맞는 학습 화면으로, 교사는 수업과 문항 설정 화면으로 바로 시작합니다.",
    images: [{ url: "/og.png", alt: "배움짝 학생 맞춤 학습과 교사 수업 설정" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "배움짝 · 학생 맞춤 학습과 교사 수업 설정",
    description: "Clerk 인증과 Supabase 저장을 사용하는 중학생 협력 학습 서비스",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body><ClerkProvider>{children}</ClerkProvider></body></html>;
}
