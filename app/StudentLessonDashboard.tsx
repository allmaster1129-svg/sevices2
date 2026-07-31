"use client";

import { useEffect, useMemo, useState } from "react";
import type { AccountProfile } from "./SupabaseAuthSetup";
import { ComicCue } from "./ComicUI";
import { formatLessonPeriod } from "./lesson-period";
import { getRememberedLesson, rememberLesson } from "./lesson-selection";

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
    completed_at: string | null;
    updated_at: string;
  } | null;
  pairing: {
    partner_user_id: string;
    partner_name: string;
    partner_student_number: number | null;
    score: number;
    helps_with: number[];
    partner_helps_with: number[];
    generated_at: string;
  } | null;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export default function StudentLessonDashboard({
  profile,
}: {
  profile: AccountProfile;
}) {
  const [lessons, setLessons] = useState<StudentLesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerStatus>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student-lessons", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          lessons?: StudentLesson[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "수업을 불러오지 못했습니다.");
        }
        const nextLessons = result.lessons ?? [];
        setLessons(nextLessons);
        if (nextLessons.length) {
          const nextLesson =
            getRememberedLesson("student-learning", nextLessons) ??
            nextLessons[0];
          setSelectedLessonId(nextLesson.id);
          setAnswers(nextLesson.response?.answers ?? {});
        }
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "수업을 불러오는 중 오류가 발생했습니다.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => lesson.id === selectedLessonId) ?? null,
    [lessons, selectedLessonId],
  );
  const answeredCount = selectedLesson
    ? selectedLesson.questions.filter((question) => answers[String(question.number)])
        .length
    : 0;
  const solvedCount = Object.values(answers).filter(
    (answer) => answer === "solved",
  ).length;
  const complete =
    Boolean(selectedLesson) &&
    answeredCount === selectedLesson?.question_count;

  function selectLesson(lesson: StudentLesson) {
    setSelectedLessonId(lesson.id);
    rememberLesson("student-learning", lesson);
    setAnswers(lesson.response?.answers ?? {});
    setMessage("");
    setError("");
  }

  async function saveAnswers() {
    if (!selectedLesson || !complete) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/student-lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: selectedLesson.id, answers }),
      });
      const result = (await response.json()) as {
        response?: StudentLesson["response"];
        error?: string;
      };
      if (!response.ok || !result.response) {
        throw new Error(result.error ?? "풀이 여부를 저장하지 못했습니다.");
      }

      setLessons((current) =>
        current.map((lesson) =>
          lesson.id === selectedLesson.id
            ? { ...lesson, response: result.response ?? null }
            : lesson,
        ),
      );
      setMessage("문항별 풀이 여부를 저장했습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "풀이 여부를 저장하는 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="student-lessons-page">
      <div className="student-lessons-hero">
        <div>
          <p className="overline">MY CLASS / LESSON CHECK</p>
          <h1>{profile.displayName} 님의 배움짝과 학습을 확인해요</h1>
          <p>
            {profile.grade}학년 {profile.classNumber}반에 등록된 수업만
            보여드려요. 수업을 고른 뒤 나의 짝과 문항별 풀이 여부를
            확인하세요.
          </p>
        </div>
        <span className="student-class-badge">
          {profile.grade}학년 {profile.classNumber}반
          <b>{lessons.length}개 수업</b>
        </span>
        <ComicCue label="MISSION 01" accent="blue" mood="explain" prop="note">
          수업을 고르고 지금 풀 수 있는 문제를 체크해요.
        </ComicCue>
      </div>

      {loading ? (
        <div className="panel student-empty">수업을 확인하고 있어요...</div>
      ) : error && !lessons.length ? (
        <div className="save-message error">{error}</div>
      ) : !lessons.length ? (
        <div className="panel student-empty">
          <span>수업 준비 중</span>
          <h2>아직 선택할 수 있는 수업이 없어요.</h2>
          <p>
            교사가 {profile.grade}학년 {profile.classNumber}반 수업을
            등록하면 이곳에 자동으로 표시됩니다.
          </p>
        </div>
      ) : (
        <div className="student-lesson-layout">
          <aside className="panel lesson-picker">
            <div className="lesson-picker-head">
              <span>수업 선택</span>
              <b>{lessons.length}</b>
            </div>
            <div className="lesson-picker-list">
              {lessons.map((lesson) => (
                <button
                  key={lesson.id}
                  className={
                    selectedLessonId === lesson.id
                      ? "lesson-choice selected"
                      : "lesson-choice"
                  }
                  onClick={() => selectLesson(lesson)}
                >
                  <span>{formatDate(lesson.learning_date)}</span>
                  <b>{lesson.subject}</b>
                  <small>
                    {formatLessonPeriod(lesson.learning_time)} ·{" "}
                    {lesson.question_count}개 문항
                  </small>
                  <i>{lesson.response ? "저장 완료" : "미응답"}</i>
                </button>
              ))}
            </div>
          </aside>

          {selectedLesson && (
            <div className="student-learning-column">
              <section className="panel student-pairing-card">
                <div className="student-pairing-head">
                  <div>
                    <span>MY LEARNING PARTNER</span>
                    <h2>나의 배움짝</h2>
                  </div>
                  {selectedLesson.pairing && (
                    <b>보완 점수 {selectedLesson.pairing.score}</b>
                  )}
                </div>
                {selectedLesson.pairing ? (
                  <>
                    <div className="student-pair-people">
                      <div>
                        <i>{profile.displayName.slice(0, 1)}</i>
                        <b>{profile.displayName}</b>
                        <small>{profile.studentNumber}번 · 나</small>
                      </div>
                      <strong>↔</strong>
                      <div>
                        <i>
                          {selectedLesson.pairing.partner_name.slice(0, 1)}
                        </i>
                        <b>{selectedLesson.pairing.partner_name}</b>
                        <small>
                          {selectedLesson.pairing.partner_student_number ?? "-"}
                          번 · 배움짝
                        </small>
                      </div>
                    </div>
                    <div className="student-pair-tasks">
                      <div>
                        <span>내가 친구에게 설명해요</span>
                        <div>
                          {selectedLesson.pairing.helps_with.length ? (
                            selectedLesson.pairing.helps_with.map((number) => (
                              <b key={number}>{number}번</b>
                            ))
                          ) : (
                            <small>설명할 문항이 없어요.</small>
                          )}
                        </div>
                      </div>
                      <div>
                        <span>친구에게 도움을 받아요</span>
                        <div>
                          {selectedLesson.pairing.partner_helps_with.length ? (
                            selectedLesson.pairing.partner_helps_with.map(
                              (number) => <b key={number}>{number}번</b>,
                            )
                          ) : (
                            <small>도움받을 문항이 없어요.</small>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="student-pairing-waiting">
                    <i>♧</i>
                    <div>
                      <b>아직 이 수업의 배움짝이 정해지지 않았어요.</b>
                      <span>
                        문제 해결 여부를 모두 저장한 뒤 교사가 매칭하면
                        이곳에서 바로 확인할 수 있어요.
                      </span>
                    </div>
                  </div>
                )}
              </section>

              <section className="panel student-question-card">
              <div className="student-question-head">
                <div>
                  <span>
                    {formatDate(selectedLesson.learning_date)} ·{" "}
                    {formatLessonPeriod(selectedLesson.learning_time)}
                  </span>
                  <h2>{selectedLesson.subject} 수업</h2>
                  <p>
                    각 문항을 확인하고 지금 풀이했는지 선택해 주세요.
                  </p>
                </div>
                <div className="student-progress">
                  <b>
                    {answeredCount} / {selectedLesson.question_count}
                  </b>
                  <span>선택 완료</span>
                  <div>
                    <i
                      style={{
                        width: `${
                          (answeredCount / selectedLesson.question_count) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="student-question-list">
                {selectedLesson.questions.map((question) => {
                  const key = String(question.number);
                  return (
                    <article className="student-question-item" key={key}>
                      <span className="student-question-number">
                        {question.number}
                      </span>
                      <div className="student-question-copy">
                        <h3>{question.title}</h3>
                        <p>{question.content}</p>
                        {question.image_url && (
                          <img
                            className="student-question-image"
                            src={question.image_url}
                            alt={
                              question.image_alt ??
                              `${question.number}번 문항 이미지`
                            }
                          />
                        )}
                      </div>
                      <div className="answer-toggle">
                        <button
                          className={
                            answers[key] === "solved"
                              ? "answer-solved selected"
                              : "answer-solved"
                          }
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [key]: "solved",
                            }))
                          }
                        >
                          ✓ 풀었어요
                        </button>
                        <button
                          className={
                            answers[key] === "unsolved"
                              ? "answer-unsolved selected"
                              : "answer-unsolved"
                          }
                          onClick={() =>
                            setAnswers((current) => ({
                              ...current,
                              [key]: "unsolved",
                            }))
                          }
                        >
                          아직 못 풀었어요
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>

              {message && <p className="save-message success">{message}</p>}
              {error && <p className="save-message error">{error}</p>}
              <div className="student-answer-footer">
                <span>
                  풀었어요 <b>{solvedCount}개</b> · 미완료{" "}
                  <b>{answeredCount - solvedCount}개</b>
                </span>
                <button
                  className="primary"
                  disabled={!complete || saving}
                  onClick={saveAnswers}
                >
                  {saving ? "저장 중..." : "풀이 여부 저장하기 →"}
                </button>
              </div>
              </section>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
