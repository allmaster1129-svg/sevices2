"use client";

import { useEffect, useMemo, useState } from "react";
import { ComicCue } from "./ComicUI";

type QuestionDraft = {
  number: number;
  title: string;
  content: string;
};

type SavedLesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function makeQuestion(number: number): QuestionDraft {
  return { number, title: "", content: "" };
}

export default function TeacherLessonSettings({
  databaseSynced,
  syncWarning,
}: {
  databaseSynced: boolean;
  syncWarning?: string;
}) {
  const [grade, setGrade] = useState(2);
  const [classNumber, setClassNumber] = useState(3);
  const [learningDate, setLearningDate] = useState(today());
  const [learningTime, setLearningTime] = useState("09:00");
  const [subject, setSubject] = useState("수학");
  const [questionCount, setQuestionCount] = useState(3);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    makeQuestion(1),
    makeQuestion(2),
    makeQuestion(3),
  ]);
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/lesson-settings", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          lessons?: SavedLesson[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "저장된 수업을 불러오지 못했습니다.");
        }
        setLessons(result.lessons ?? []);
      })
      .catch((reason) => {
        setError(
          reason instanceof Error
            ? reason.message
            : "수업 정보를 불러오는 중 오류가 발생했습니다.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setQuestions((current) =>
      Array.from(
        { length: questionCount },
        (_, index) => current[index] ?? makeQuestion(index + 1),
      ).map((question, index) => ({ ...question, number: index + 1 })),
    );
  }, [questionCount]);

  const ready = useMemo(
    () =>
      questions.length === questionCount &&
      questions.every(
        (question) => question.title.trim() && question.content.trim(),
      ),
    [questionCount, questions],
  );

  function updateQuestion(
    index: number,
    field: "title" | "content",
    value: string,
  ) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, [field]: value } : question,
      ),
    );
  }

  async function saveLesson() {
    if (!ready) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/lesson-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade,
          classNumber,
          learningDate,
          learningTime,
          subject,
          questionCount,
          questions,
        }),
      });
      const result = (await response.json()) as {
        lesson?: SavedLesson;
        error?: string;
      };

      if (!response.ok || !result.lesson) {
        throw new Error(result.error ?? "수업 설정을 저장하지 못했습니다.");
      }

      setLessons((current) => [result.lesson!, ...current]);
      setMessage("수업과 문항 정보가 Supabase에 저장되었습니다.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "수업 설정을 저장하는 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-page lesson-builder">
      <div className="settings-hero">
        <div>
          <p className="overline">TEACHER ADMIN / LESSON SETUP</p>
          <h1>수업과 풀이 문항을 설정해요</h1>
          <p>
            학급과 수업 시간을 지정하고 학생이 풀 문항 정보를 입력해 주세요.
          </p>
        </div>
        <span className="settings-count">
          저장된 수업 <b>{lessons.length}개</b>
        </span>
        <ComicCue
          label="TEACHER TIP"
          accent="yellow"
          mood="explain"
          prop="note"
        >
          학급과 날짜를 적고, 학생이 볼 문항을 차례로 작성하세요.
        </ComicCue>
      </div>

      {!databaseSynced && (
        <div className="database-sync-warning" role="status">
          <b>관리자 화면은 열렸지만 Supabase 동기화 설정이 필요합니다.</b>
          <span>
            {syncWarning ??
              "Supabase Third-Party Auth 또는 서버 Secret Key를 설정해 주세요."}
          </span>
        </div>
      )}

      <div className="lesson-layout">
        <section className="panel lesson-form-card">
          <div className="panel-head">
            <div>
              <h2>수업 기본 정보</h2>
              <p>학년·반·날짜·시간을 기준으로 학생 화면과 연결됩니다.</p>
            </div>
            <span className="teacher-only-badge">교사 전용</span>
          </div>

          <div className="lesson-meta-grid">
            <label>
              학년
              <select
                value={grade}
                onChange={(event) => setGrade(Number(event.target.value))}
              >
                <option value={1}>1학년</option>
                <option value={2}>2학년</option>
                <option value={3}>3학년</option>
              </select>
            </label>
            <label>
              반
              <input
                type="number"
                min={1}
                max={50}
                value={classNumber}
                onChange={(event) => setClassNumber(Number(event.target.value))}
              />
            </label>
            <label>
              수업 날짜
              <input
                type="date"
                value={learningDate}
                onChange={(event) => setLearningDate(event.target.value)}
              />
            </label>
            <label>
              시작 시간
              <input
                type="time"
                value={learningTime}
                onChange={(event) => setLearningTime(event.target.value)}
              />
            </label>
            <label>
              과목
              <input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="예: 수학"
              />
            </label>
            <label>
              문항 수
              <input
                type="number"
                min={1}
                max={50}
                value={questionCount}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  setQuestionCount(Math.min(50, Math.max(1, next || 1)));
                }}
              />
            </label>
          </div>

          <div className="question-editor-head">
            <div>
              <h2>문항 정보</h2>
              <p>학생에게 보여줄 문항 이름과 풀이 안내를 입력하세요.</p>
            </div>
            <span>{questionCount}개 문항</span>
          </div>

          <div className="question-editor-list">
            {questions.map((question, index) => (
              <article className="question-editor" key={question.number}>
                <span className="question-index">{question.number}</span>
                <div>
                  <label>
                    문항 이름
                    <input
                      value={question.title}
                      onChange={(event) =>
                        updateQuestion(index, "title", event.target.value)
                      }
                      placeholder={`예: ${question.number}번 비례식 계산`}
                    />
                  </label>
                  <label>
                    문항 정보
                    <textarea
                      value={question.content}
                      onChange={(event) =>
                        updateQuestion(index, "content", event.target.value)
                      }
                      placeholder="교재 페이지, 문제 내용 또는 풀이 안내를 입력하세요."
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>

          {message && <p className="save-message success">{message}</p>}
          {error && <p className="save-message error">{error}</p>}
          <div className="settings-actions">
            <button
              className="secondary"
              onClick={() =>
                setQuestions((current) =>
                  current.map((_, index) => makeQuestion(index + 1)),
                )
              }
            >
              문항 내용 초기화
            </button>
            <button
              className="primary"
              disabled={saving || !ready}
              onClick={saveLesson}
            >
              {saving ? "저장 중..." : "Supabase에 수업 저장하기 →"}
            </button>
          </div>
        </section>

        <aside className="lesson-summary">
          <span>수업 미리보기</span>
          <h3>
            {grade}학년 {classNumber}반
          </h3>
          <p>
            {learningDate} · {learningTime}
            <br />
            {subject} · {questionCount}개 문항
          </p>
          <div className="summary-question-list">
            {questions.slice(0, 5).map((question) => (
              <div key={question.number}>
                <b>{question.number}</b>
                <span>{question.title.trim() || "문항 이름 입력 전"}</span>
              </div>
            ))}
            {questionCount > 5 && <small>외 {questionCount - 5}개 문항</small>}
          </div>

          <div className="saved-lessons">
            <h4>최근 저장한 수업</h4>
            {loading ? (
              <p>불러오는 중...</p>
            ) : lessons.length ? (
              lessons.slice(0, 4).map((lesson) => (
                <div key={lesson.id}>
                  <b>
                    {lesson.grade}학년 {lesson.class_number}반
                  </b>
                  <span>
                    {lesson.learning_date} {lesson.learning_time.slice(0, 5)}
                  </span>
                  <small>{lesson.question_count}개 문항</small>
                </div>
              ))
            ) : (
              <p>아직 저장된 수업이 없습니다.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
