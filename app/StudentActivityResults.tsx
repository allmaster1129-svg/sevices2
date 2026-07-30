"use client";

import { useEffect, useMemo, useState } from "react";
import type { AccountProfile } from "./ClerkDatabaseSetup";
import { ComicCue } from "./ComicUI";
import { formatLessonPeriod } from "./lesson-period";

type AnswerStatus = "solved" | "unsolved";

type LessonQuestion = {
  number: number;
  title: string;
  content: string;
  image_url?: string | null;
  image_alt?: string | null;
};

type StudentLesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
  questions: LessonQuestion[];
  response: {
    answers: Record<string, AnswerStatus>;
  } | null;
  pairing: {
    partner_name: string;
    partner_student_number: number | null;
  } | null;
  post_activity_response: {
    answers: Record<string, AnswerStatus>;
    reflection: string;
    completed_at: string | null;
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

export default function StudentActivityResults({
  profile,
}: {
  profile: AccountProfile;
}) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerStatus>>({});
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student-lessons", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          lessons?: StudentLesson[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "수업을 불러오지 못했습니다.");
        }
        const nextLessons = data.lessons ?? [];
        const firstMatched =
          nextLessons.find((lesson) => lesson.pairing) ?? nextLessons[0];
        setLessons(nextLessons);
        if (firstMatched) selectLesson(firstMatched);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "수업을 불러오는 중 오류가 발생했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === lessonId) ?? null,
    [lessonId, lessons],
  );
  const activityQuestions = useMemo(
    () =>
      selectedLesson?.questions.filter(
        (question) =>
          selectedLesson.response?.answers?.[String(question.number)] !==
          "solved",
      ) ?? [],
    [selectedLesson],
  );
  const answeredCount = selectedLesson
    ? activityQuestions.filter(
        (question) => answers[String(question.number)],
      ).length
    : 0;
  const solvedCount = Object.values(answers).filter(
    (answer) => answer === "solved",
  ).length;
  const complete =
    Boolean(selectedLesson?.pairing) &&
    answeredCount === activityQuestions.length;

  function selectLesson(lesson: StudentLesson) {
    const activityQuestionNumbers = new Set(
      lesson.questions
        .filter(
          (question) =>
            lesson.response?.answers?.[String(question.number)] !== "solved",
        )
        .map((question) => String(question.number)),
    );
    const savedAnswers = Object.fromEntries(
      Object.entries(lesson.post_activity_response?.answers ?? {}).filter(
        ([number]) => activityQuestionNumbers.has(number),
      ),
    ) as Record<string, AnswerStatus>;
    setLessonId(lesson.id);
    setAnswers(savedAnswers);
    setReflection(lesson.post_activity_response?.reflection ?? "");
    setMessage("");
    setError("");
  }

  async function saveResult() {
    if (!selectedLesson || !complete) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/student-activity-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLesson.id,
          answers,
          reflection,
        }),
      });
      const data = (await response.json()) as {
        postActivityResponse?: StudentLesson["post_activity_response"];
        error?: string;
      };
      if (!response.ok || !data.postActivityResponse) {
        throw new Error(data.error ?? "활동 결과를 저장하지 못했습니다.");
      }
      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === selectedLesson.id
            ? {
                ...lesson,
                post_activity_response: data.postActivityResponse ?? null,
              }
            : lesson,
        ),
      );
      setMessage("배움짝 활동 후 문제풀이 결과를 저장했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "활동 결과 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="activity-results-page">
      <div className="activity-results-hero">
        <div>
          <p className="overline">AFTER PEER LEARNING</p>
          <h1>{profile.displayName} 님, 활동 후 달라진 점을 알려주세요</h1>
          <p>
            배움짝과 공부한 뒤 각 문항을 해결할 수 있게 되었는지 다시
            확인해요.
          </p>
        </div>
        <span>
          활동 결과 <b>{lessons.filter((lesson) => lesson.post_activity_response).length}개 저장</b>
        </span>
        <ComicCue
          label="FINAL CHECK"
          accent="mint"
          mood="celebrate"
          prop="checklist"
        >
          새롭게 해결한 문제를 체크하고 변화를 기록해요!
        </ComicCue>
      </div>

      {loading ? (
        <div className="panel activity-results-empty">수업을 확인하고 있어요...</div>
      ) : error && !lessons.length ? (
        <p className="save-message error">{error}</p>
      ) : !lessons.length ? (
        <div className="panel activity-results-empty">
          <h2>입력할 수업이 아직 없어요.</h2>
          <p>교사가 수업을 개설하면 이곳에 표시됩니다.</p>
        </div>
      ) : (
        <div className="activity-results-layout">
          <aside className="panel activity-lesson-picker">
            <div className="lesson-picker-head">
              <span>수업 선택</span>
              <b>{lessons.length}</b>
            </div>
            <div className="lesson-picker-list">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  className={
                    lesson.id === lessonId
                      ? "lesson-choice selected"
                      : "lesson-choice"
                  }
                  onClick={() => selectLesson(lesson)}
                >
                  <span>{formatDate(lesson.learning_date)}</span>
                  <b>{lesson.subject}</b>
                  <small>
                    {formatLessonPeriod(lesson.learning_time)} ·{" "}
                    {lesson.pairing
                      ? `${lesson.pairing.partner_name} 학생과 활동`
                      : "매칭 대기 중"}
                  </small>
                  <i>
                    {lesson.post_activity_response ? "결과 저장" : "미입력"}
                  </i>
                </button>
              ))}
            </div>
          </aside>

          {selectedLesson && (
            <section className="panel activity-result-card">
              <div className="activity-result-head">
                <div>
                  <span>
                    {formatDate(selectedLesson.learning_date)} ·{" "}
                    {formatLessonPeriod(selectedLesson.learning_time)} ·{" "}
                    {selectedLesson.subject}
                  </span>
                  <h2>배움짝 활동 후 문제풀이 결과</h2>
                  <p>
                    활동 전 응답을 참고해 지금의 해결 여부를 선택하세요.
                  </p>
                </div>
                <div>
                  <b>{answeredCount} / {activityQuestions.length}</b>
                  <span>입력 완료</span>
                </div>
              </div>

              {!selectedLesson.pairing ? (
                <div className="activity-lock">
                  <i>♧</i>
                  <div>
                    <b>배움짝 매칭 후 결과를 입력할 수 있어요.</b>
                    <span>교사가 이 수업의 짝을 정하면 메뉴가 열립니다.</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="activity-partner-chip">
                    <span>함께 활동한 배움짝</span>
                    <b>
                      {selectedLesson.pairing.partner_student_number ?? "-"}번{" "}
                      {selectedLesson.pairing.partner_name}
                    </b>
                  </div>
                  <div className="activity-question-list">
                    {activityQuestions.map((question) => {
                      const key = String(question.number);
                      const before = selectedLesson.response?.answers?.[key];
                      return (
                        <article key={key}>
                          <span>{question.number}</span>
                          <div>
                            <h3>{question.title}</h3>
                            {question.image_url && (
                              <img
                                className="activity-question-image"
                                src={question.image_url}
                                alt={
                                  question.image_alt ??
                                  `${question.number}번 문항 이미지`
                                }
                              />
                            )}
                            <small>
                              활동 전:{" "}
                              {before === "solved"
                                ? "풀었어요"
                                : before === "unsolved"
                                  ? "못 풀었어요"
                                  : "미응답"}
                            </small>
                          </div>
                          <div>
                            <button
                              className={
                                answers[key] === "solved"
                                  ? "post-solved selected"
                                  : "post-solved"
                              }
                              onClick={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [key]: "solved",
                                }))
                              }
                            >
                              ✓ 이제 해결했어요
                            </button>
                            <button
                              className={
                                answers[key] === "unsolved"
                                  ? "post-unsolved selected"
                                  : "post-unsolved"
                              }
                              onClick={() =>
                                setAnswers((current) => ({
                                  ...current,
                                  [key]: "unsolved",
                                }))
                              }
                            >
                              아직 어려워요
                            </button>
                          </div>
                        </article>
                      );
                    })}
                    {!activityQuestions.length && (
                      <div className="activity-all-solved">
                        <b>처음부터 모든 문제를 해결했어요.</b>
                        <span>
                          활동 후 다시 확인할 문항이 없어 소감만 입력할 수
                          있습니다.
                        </span>
                      </div>
                    )}
                  </div>
                  <label className="activity-reflection">
                    배움짝 활동 소감 <small>선택 입력</small>
                    <textarea
                      value={reflection}
                      maxLength={1000}
                      onChange={(event) => setReflection(event.target.value)}
                      placeholder="친구의 설명으로 새롭게 이해한 점을 적어보세요."
                    />
                  </label>
                  {message && <p className="save-message success">{message}</p>}
                  {error && <p className="save-message error">{error}</p>}
                  <div className="activity-result-footer">
                    <span>
                      활동 후 해결 <b>{solvedCount}개</b> · 아직 어려움{" "}
                      <b>{answeredCount - solvedCount}개</b>
                    </span>
                    <button
                      className="primary"
                      disabled={!complete || saving}
                      onClick={saveResult}
                    >
                      {saving ? "저장 중..." : "활동 후 결과 저장하기 →"}
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
