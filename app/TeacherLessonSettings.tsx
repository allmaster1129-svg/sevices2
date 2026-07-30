"use client";

import { useEffect, useMemo, useState } from "react";
import { ComicCue } from "./ComicUI";
import { formatLessonPeriod, LESSON_PERIODS } from "./lesson-period";

type QuestionDraft = {
  number: number;
  title: string;
  content: string;
  imageUrl?: string;
  imagePath?: string;
  imageAlt?: string;
};

type SavedLesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
  questions: Array<{
    number: number;
    title: string;
    content: string;
    image_url?: string | null;
    image_path?: string | null;
    image_alt?: string | null;
  }>;
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
  subject,
}: {
  databaseSynced: boolean;
  syncWarning?: string;
  subject: string;
}) {
  const [grade, setGrade] = useState(2);
  const [classNumber, setClassNumber] = useState(3);
  const [learningDate, setLearningDate] = useState(today());
  const [learningTime, setLearningTime] = useState("09:00");
  const [questionCount, setQuestionCount] = useState(3);
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    makeQuestion(1),
    makeQuestion(2),
    makeQuestion(3),
  ]);
  const [lessons, setLessons] = useState<SavedLesson[]>([]);
  const [editingLessonId, setEditingLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingQuestion, setUploadingQuestion] = useState<number | null>(
    null,
  );
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

  function resetForm() {
    setEditingLessonId("");
    setGrade(2);
    setClassNumber(3);
    setLearningDate(today());
    setLearningTime("09:00");
    setQuestionCount(3);
    setQuestions([makeQuestion(1), makeQuestion(2), makeQuestion(3)]);
    setMessage("");
    setError("");
  }

  function editLesson(lesson: SavedLesson) {
    const lessonQuestions = Array.isArray(lesson.questions)
      ? lesson.questions
      : [];
    setEditingLessonId(lesson.id);
    setGrade(lesson.grade);
    setClassNumber(lesson.class_number);
    setLearningDate(lesson.learning_date);
    setLearningTime(lesson.learning_time);
    setQuestionCount(lesson.question_count);
    setQuestions(
      Array.from({ length: lesson.question_count }, (_, index) => {
        const question = lessonQuestions[index];
        if (!question) return makeQuestion(index + 1);
        return {
          number: index + 1,
          title: question.title ?? "",
          content: question.content ?? "",
          imageUrl: question.image_url ?? undefined,
          imagePath: question.image_path ?? undefined,
          imageAlt: question.image_alt ?? undefined,
        };
      }),
    );
    setMessage("선택한 지난 수업을 불러왔습니다. 수정 후 저장해 주세요.");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateQuestionImage(
    index: number,
    image: Pick<QuestionDraft, "imageUrl" | "imagePath" | "imageAlt">,
  ) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...image } : question,
      ),
    );
  }

  async function uploadQuestionImage(index: number, file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("문항 이미지는 5MB 이하로 올려 주세요.");
      return;
    }

    setUploadingQuestion(index);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/question-images", {
        method: "POST",
        body: formData,
      });
      const result = (await response.json()) as {
        imageUrl?: string;
        imagePath?: string;
        error?: string;
      };
      if (!response.ok || !result.imageUrl || !result.imagePath) {
        throw new Error(result.error ?? "문항 이미지를 업로드하지 못했습니다.");
      }
      updateQuestionImage(index, {
        imageUrl: result.imageUrl,
        imagePath: result.imagePath,
        imageAlt: `${index + 1}번 문항 이미지`,
      });
      setMessage(`${index + 1}번 문항 이미지가 업로드되었습니다.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "문항 이미지를 업로드하는 중 오류가 발생했습니다.",
      );
    } finally {
      setUploadingQuestion(null);
    }
  }

  async function saveLesson() {
    if (!ready) return;
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/lesson-settings", {
        method: editingLessonId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: editingLessonId || undefined,
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

      setLessons((current) =>
        editingLessonId
          ? current.map((lesson) =>
              lesson.id === result.lesson?.id ? result.lesson : lesson,
            )
          : [
              result.lesson!,
              ...current.filter((lesson) => lesson.id !== result.lesson?.id),
            ],
      );
      setMessage(
        editingLessonId
          ? "지난 수업 설정을 변경했습니다."
          : "수업과 문항 정보가 Supabase에 저장되었습니다.",
      );
      setEditingLessonId("");
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
            학급과 수업 교시를 지정하고 학생이 풀 문항 정보를 입력해 주세요.
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
              <h2>
                {editingLessonId ? "지난 수업 설정 수정" : "수업 기본 정보"}
              </h2>
              <p>학년·반·날짜·교시를 기준으로 학생 화면과 연결됩니다.</p>
            </div>
            <span className="teacher-only-badge">
              {editingLessonId ? "수정 중" : "교사 전용"}
            </span>
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
              <select
                value={classNumber}
                onChange={(event) => setClassNumber(Number(event.target.value))}
              >
                {Array.from({ length: 50 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>{value}반</option>
                  ),
                )}
              </select>
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
              교시
              <select
                value={learningTime}
                onChange={(event) => setLearningTime(event.target.value)}
              >
                {LESSON_PERIODS.map(({ period, time }) => (
                  <option key={period} value={time}>{period}교시</option>
                ))}
              </select>
            </label>
            <label>
              담당 교과목
              <div className="lesson-subject-value">
                <b>{subject}</b>
                <span>교사 프로필과 자동 연결</span>
              </div>
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
                  <div className="question-image-field">
                    <span>문항 이미지 <small>선택 · 최대 5MB</small></span>
                    {question.imageUrl ? (
                      <div className="question-image-preview">
                        <img
                          src={question.imageUrl}
                          alt={question.imageAlt ?? `${question.number}번 문항 이미지`}
                        />
                        <div>
                          <label className="question-image-replace">
                            이미지 바꾸기
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              disabled={uploadingQuestion !== null}
                              onChange={(event) =>
                                void uploadQuestionImage(
                                  index,
                                  event.target.files?.[0],
                                )
                              }
                            />
                          </label>
                          <button
                            type="button"
                            className="question-image-remove"
                            onClick={() =>
                              updateQuestionImage(index, {
                                imageUrl: undefined,
                                imagePath: undefined,
                                imageAlt: undefined,
                              })
                            }
                          >
                            이미지 제거
                          </button>
                        </div>
                      </div>
                    ) : (
                      <label className="question-image-upload">
                        <span aria-hidden="true">＋</span>
                        <b>
                          {uploadingQuestion === index
                            ? "업로드 중..."
                            : "문항 이미지 올리기"}
                        </b>
                        <small>JPG, PNG, WEBP</small>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={uploadingQuestion !== null}
                          onChange={(event) =>
                            void uploadQuestionImage(
                              index,
                              event.target.files?.[0],
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          {message && <p className="save-message success">{message}</p>}
          {error && <p className="save-message error">{error}</p>}
          <div className="settings-actions">
            {editingLessonId && (
              <button className="secondary" onClick={resetForm}>
                수정 취소
              </button>
            )}
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
              {saving
                ? "저장 중..."
                : editingLessonId
                  ? "지난 수업 변경 저장하기 →"
                  : "Supabase에 수업 저장하기 →"}
            </button>
          </div>
        </section>

        <aside className="lesson-summary">
          <span>수업 미리보기</span>
          <h3>
            {grade}학년 {classNumber}반
          </h3>
          <p>
            {learningDate} · {formatLessonPeriod(learningTime)}
            <br />
            {subject} · {questionCount}개 문항
          </p>
          <div className="summary-question-list">
            {questions.slice(0, 5).map((question) => (
              <div key={question.number}>
                <b>{question.number}</b>
                <span>{question.title.trim() || "문항 이름 입력 전"}</span>
                {question.imageUrl && <em aria-label="이미지 첨부됨">IMG</em>}
              </div>
            ))}
            {questionCount > 5 && <small>외 {questionCount - 5}개 문항</small>}
          </div>

          <div className="saved-lessons">
            <h4>지난 수업 관리</h4>
            {loading ? (
              <p>불러오는 중...</p>
            ) : lessons.length ? (
              lessons.map((lesson) => (
                <div
                  className={editingLessonId === lesson.id ? "editing" : ""}
                  key={lesson.id}
                >
                  <b>
                    {lesson.grade}학년 {lesson.class_number}반
                  </b>
                  <span>
                    {lesson.learning_date} {formatLessonPeriod(lesson.learning_time)}
                  </span>
                  <small>{lesson.question_count}개 문항</small>
                  <button
                    type="button"
                    onClick={() => editLesson(lesson)}
                  >
                    {editingLessonId === lesson.id ? "수정 중" : "수정"}
                  </button>
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
