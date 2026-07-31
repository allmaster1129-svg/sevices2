"use client";

import { useEffect, useMemo, useState } from "react";
import type { AccountProfile } from "./ClerkDatabaseSetup";
import { formatLessonPeriod } from "./lesson-period";
import { getRememberedLesson, rememberLesson } from "./lesson-selection";

type AnswerStatus = "solved" | "unsolved";

type LessonQuestion = {
  number: number;
  title: string;
};

export type StudentProgressLesson = {
  id: string;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
  questions: LessonQuestion[];
  response: {
    answers: Record<string, AnswerStatus>;
    completed_at: string | null;
  } | null;
  post_activity_response: {
    answers: Record<string, AnswerStatus>;
    reflection: string;
    completed_at: string | null;
  } | null;
  feedback: {
    feedback: string;
    source: "manual" | "gemini";
    updated_at: string;
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function answerLabel(answer?: AnswerStatus) {
  if (answer === "solved") return "해결";
  if (answer === "unsolved") return "미해결";
  return "미입력";
}

export default function StudentProgressDashboard({
  profile,
  demoLessons,
}: {
  profile: AccountProfile;
  demoLessons?: StudentProgressLesson[];
}) {
  const [lessons, setLessons] = useState<StudentProgressLesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (demoLessons) {
      setLessons(demoLessons);
      setLessonId(demoLessons[0]?.id ?? "");
      setError("");
      setLoading(false);
      return;
    }

    let active = true;
    fetch("/api/student-lessons", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          lessons?: StudentProgressLesson[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            result.error ?? "학습 현황을 불러오지 못했습니다.",
          );
        }
        if (!active) return;
        const nextLessons = result.lessons ?? [];
        setLessons(nextLessons);
        setLessonId(
          getRememberedLesson("student-progress", nextLessons)?.id ??
            nextLessons[0]?.id ??
            "",
        );
      })
      .catch((reason) => {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "학습 현황을 불러오는 중 오류가 발생했습니다.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [demoLessons]);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === lessonId) ?? null,
    [lessonId, lessons],
  );

  const result = useMemo(() => {
    if (!selectedLesson) {
      return {
        beforeSolved: 0,
        afterSolved: 0,
        beforePercent: 0,
        afterPercent: 0,
        increase: 0,
      };
    }

    const beforeSolved = selectedLesson.questions.filter(
      (question) =>
        selectedLesson.response?.answers?.[String(question.number)] ===
        "solved",
    ).length;
    const afterSolved = selectedLesson.questions.filter((question) => {
      const key = String(question.number);
      return (
        selectedLesson.response?.answers?.[key] === "solved" ||
        selectedLesson.post_activity_response?.answers?.[key] === "solved"
      );
    }).length;
    const total = Math.max(selectedLesson.question_count, 1);
    const beforePercent = Math.round((beforeSolved / total) * 100);
    const afterPercent = Math.round((afterSolved / total) * 100);

    return {
      beforeSolved,
      afterSolved,
      beforePercent,
      afterPercent,
      increase: afterPercent - beforePercent,
    };
  }, [selectedLesson]);

  const completedLessonCount = lessons.filter(
    (lesson) => lesson.post_activity_response,
  ).length;

  if (loading) {
    return (
      <section className="student-progress-dashboard">
        <div className="panel student-progress-empty">
          나의 학습 기록을 정리하고 있어요...
        </div>
      </section>
    );
  }

  if (error && !lessons.length) {
    return (
      <section className="student-progress-dashboard">
        <div className="save-message error">{error}</div>
      </section>
    );
  }

  return (
    <section className="student-progress-dashboard">
      <div className="student-progress-hero">
        <div>
          <p className="overline">MY LEARNING DASHBOARD</p>
          <h1>{profile.displayName} 님의 배움 성장을 확인해요</h1>
          <p>
            처음 문제를 풀었을 때부터 배움짝 활동 후 달라진 점과 선생님의
            피드백까지 한눈에 볼 수 있어요.
          </p>
        </div>
        <div className="student-progress-hero-summary">
          <span>활동을 마친 수업</span>
          <b>
            {completedLessonCount}
            <small> / {lessons.length}개</small>
          </b>
        </div>
      </div>

      {!lessons.length ? (
        <div className="panel student-progress-empty">
          <span>수업 준비 중</span>
          <h2>아직 확인할 수업이 없어요.</h2>
          <p>선생님이 수업을 개설하면 여기에 학습 현황이 표시됩니다.</p>
        </div>
      ) : (
        <>
          <div className="student-progress-toolbar">
            <label>
              확인할 수업
              <select
                value={lessonId}
                onChange={(event) => {
                  const nextLesson = lessons.find(
                    (lesson) => lesson.id === event.target.value,
                  );
                  setLessonId(event.target.value);
                  if (nextLesson) {
                    rememberLesson("student-progress", nextLesson);
                  }
                }}
              >
                {lessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {formatDate(lesson.learning_date)} ·{" "}
                    {formatLessonPeriod(lesson.learning_time)} ·{" "}
                    {lesson.subject}
                  </option>
                ))}
              </select>
            </label>
            {selectedLesson && (
              <div className="student-progress-lesson-chip">
                <span>{selectedLesson.subject}</span>
                <b>{selectedLesson.question_count}개 문항</b>
              </div>
            )}
          </div>

          {selectedLesson && (
            <>
              <div className="student-progress-metrics">
                <article>
                  <span>첫 결과</span>
                  <b>
                    {selectedLesson.response
                      ? `${result.beforePercent}%`
                      : "대기"}
                  </b>
                  <small>
                    {selectedLesson.response
                      ? `${result.beforeSolved}개 문항 해결`
                      : "첫 설문을 입력해 주세요"}
                  </small>
                </article>
                <article>
                  <span>배움짝 활동 후</span>
                  <b>
                    {selectedLesson.post_activity_response
                      ? `${result.afterPercent}%`
                      : "대기"}
                  </b>
                  <small>
                    {selectedLesson.post_activity_response
                      ? `${result.afterSolved}개 문항 해결`
                      : "활동 후 결과가 아직 없어요"}
                  </small>
                </article>
                <article className="student-progress-growth">
                  <span>성취도 변화</span>
                  <b>
                    {selectedLesson.post_activity_response
                      ? `${result.increase >= 0 ? "+" : ""}${result.increase}%p`
                      : "-"}
                  </b>
                  <small>
                    {result.increase > 0
                      ? "배움짝 활동으로 성장했어요"
                      : selectedLesson.post_activity_response
                        ? "꾸준히 다음 활동을 이어가요"
                        : "활동 후 결과를 기다리고 있어요"}
                  </small>
                </article>
                <article>
                  <span>선생님 피드백</span>
                  <b>{selectedLesson.feedback ? "도착" : "대기"}</b>
                  <small>
                    {selectedLesson.feedback
                      ? "아래에서 내용을 확인하세요"
                      : "선생님이 작성 중이에요"}
                  </small>
                </article>
              </div>

              <div className="student-progress-grid">
                <section className="panel student-progress-comparison">
                  <div className="student-progress-section-head">
                    <div>
                      <span>QUESTION PROGRESS</span>
                      <h2>문항별 문제 해결 현황</h2>
                    </div>
                    <div className="student-progress-legend">
                      <span>
                        <i className="solved" /> 해결
                      </span>
                      <span>
                        <i className="unsolved" /> 미해결
                      </span>
                    </div>
                  </div>
                  <div className="student-progress-question-list">
                    {selectedLesson.questions.map((question) => {
                      const key = String(question.number);
                      const before =
                        selectedLesson.response?.answers?.[key];
                      const effectiveAfter =
                        before === "solved"
                          ? "solved"
                          : selectedLesson.post_activity_response?.answers?.[
                              key
                            ];
                      return (
                        <article key={question.number}>
                          <span className="student-progress-question-number">
                            {question.number}
                          </span>
                          <h3>{question.title}</h3>
                          <div>
                            <span>
                              <small>첫 결과</small>
                              <b className={before ?? "unanswered"}>
                                {answerLabel(before)}
                              </b>
                            </span>
                            <i aria-hidden="true">→</i>
                            <span>
                              <small>활동 후</small>
                              <b className={effectiveAfter ?? "unanswered"}>
                                {selectedLesson.post_activity_response
                                  ? answerLabel(effectiveAfter)
                                  : "대기"}
                              </b>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <aside className="panel student-teacher-feedback">
                  <span className="student-feedback-label">
                    TEACHER FEEDBACK
                  </span>
                  <h2>선생님의 학습 피드백</h2>
                  {selectedLesson.feedback ? (
                    <>
                      <blockquote>
                        {selectedLesson.feedback.feedback}
                      </blockquote>
                      <small>
                        {new Intl.DateTimeFormat("ko-KR", {
                          month: "long",
                          day: "numeric",
                        }).format(
                          new Date(selectedLesson.feedback.updated_at),
                        )}{" "}
                        작성
                      </small>
                    </>
                  ) : (
                    <div className="student-feedback-waiting">
                      <i aria-hidden="true">✎</i>
                      <b>아직 도착한 피드백이 없어요.</b>
                      <p>
                        활동 후 결과를 입력하면 선생님이 성장한 점과 다음
                        학습 방향을 알려주실 거예요.
                      </p>
                    </div>
                  )}
                  {selectedLesson.post_activity_response?.reflection && (
                    <div className="student-reflection-recap">
                      <span>내가 남긴 활동 소감</span>
                      <p>
                        {selectedLesson.post_activity_response.reflection}
                      </p>
                    </div>
                  )}
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
