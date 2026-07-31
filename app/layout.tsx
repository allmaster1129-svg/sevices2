import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jjakkung-mentoring.lumiolab-4734.chatgpt.site"),
  title: "배움짝 · 스마트 피어 매칭",
  description:
    "학생은 함께 문제를 해결하고, 교사는 학급의 배움 변화를 확인하는 협력 학습 서비스",
  openGraph: {
    title: "배움짝 · 함께 배우고, 더 깊이 이해해요",
    description:
      "학생의 문제 풀이 결과를 바탕으로 서로 도움을 주고받는 스마트 피어 매칭 서비스입니다.",
    images: [
      {
        url: "/og-tesla.png",
        alt: "배움짝 스마트 피어 매칭 서비스",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "배움짝 · 함께 배우고, 더 깊이 이해해요",
    description: "중학생을 위한 스마트 피어 매칭 협력 학습 서비스",
    images: ["/og-tesla.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
