"use client";

import { ComicCue, TutorialStep } from "./ComicUI";

type GuideStep = {
  number: string;
  title: string;
  description: string;
};

const teacherSteps: GuideStep[] = [
  {
    number: "01",
    title: "수업과 문항 설정",
    description:
      "수업·문항 설정에서 학년, 반, 날짜, 시간과 학생이 풀 문제를 등록합니다.",
  },
  {
    number: "02",
    title: "학생 설문 확인",
    description:
      "학급 명단 확인에서 수업별 가입 학생과 문제 풀이 설문 제출 현황을 확인합니다.",
  },
  {
    number: "03",
    title: "배움짝 자동 매칭",
    description:
      "짝 매칭 관리에서 서로 도움을 주고받기 좋은 학생을 자동으로 연결합니다.",
  },
  {
    number: "04",
    title: "활동 전후 변화 확인",
    description:
      "학생들이 활동 후 결과를 제출하면 학급 대시보드에서 해결률 변화를 확인합니다.",
  },
];

const studentSteps: GuideStep[] = [
  {
    number: "01",
    title: "내 수업 선택",
    description:
      "로그인한 학년과 반에 맞는 수업을 선택하고 문제별 현재 풀이 상태를 입력합니다.",
  },
  {
    number: "02",
    title: "문제풀이 결과 입력",
    description:
      "각 문항을 해결했는지 선택한 뒤 응답을 저장하면 선생님이 매칭을 진행합니다.",
  },
  {
    number: "03",
    title: "배움짝 확인",
    description:
      "배움짝 결과 입력 화면에서 연결된 친구와 서로 설명하거나 질문할 문제를 확인합니다.",
  },
  {
    number: "04",
    title: "배움짝 결과 입력",
    description:
      "배움짝 활동이 끝나면 다시 해결 여부를 체크하고 활동 소감을 저장합니다.",
  },
];

export default function UsageGuide({ isTeacher }: { isTeacher: boolean }) {
  const steps = isTeacher ? teacherSteps : studentSteps;

  return (
    <section className="guide-page">
      <div className="guide-hero">
        <div>
          <p className="overline">BAEMJJAK USER GUIDE</p>
          <h1>{isTeacher ? "교사" : "학생"}용 배움짝 사용 가이드</h1>
          <p>
            처음부터 활동 결과 확인까지, 아래 순서대로 진행하면 됩니다.
          </p>
        </div>
        <span className="guide-role">{isTeacher ? "교사 관리자" : "학생"}</span>
        <ComicCue label="HOW TO" accent="yellow" mood="explain" prop="note">
          네 컷을 순서대로 따라오면 준비 완료!
        </ComicCue>
      </div>

      <div className="guide-steps">
        {steps.map((step, index) => (
          <TutorialStep
            key={step.number}
            number={step.number}
            title={step.title}
            accent={(["blue", "yellow", "pink", "mint"] as const)[index]}
          >
            {step.description}
          </TutorialStep>
        ))}
      </div>

      <section className="guide-tip-panel">
        <div>
          <span aria-hidden="true">✦</span>
          <div>
            <h2>알림은 언제 표시되나요?</h2>
            <p>
              교사 화면에서는 수업에 가입한 학생 전원이 설문을 제출했을 때와,
              매칭된 학생 전원이 배움짝 활동 결과를 제출했을 때 새 알림이
              표시됩니다.
            </p>
          </div>
        </div>
        <div>
          <span aria-hidden="true">✓</span>
          <div>
            <h2>입력한 내용은 자동으로 연결돼요</h2>
            <p>
              학생의 설문, 매칭 결과, 활동 후 결과는 같은 수업을 기준으로
              대시보드에 반영됩니다.
            </p>
          </div>
        </div>
      </section>
    </section>
  );
}
