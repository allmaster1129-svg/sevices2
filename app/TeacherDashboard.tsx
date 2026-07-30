"use client";

import { useEffect, useMemo, useState } from "react";
import { formatLessonPeriod } from "./lesson-period";
import { ComicCue } from "./ComicUI";

type AnswerStatus = "solved" | "unsolved";

type LessonQuestion = {
  number: number;
  title: string;
  content: string;
  image_url?: string | null;
  image_alt?: string | null;
};

type Lesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
  questions: LessonQuestion[];
};

type Student = {
  user_id: string;
  display_name: string;
  grade: number;
  class_number: number;
  student_number: number | null;
};

type LessonResponse = {
  lesson_id: string;
  student_user_id: string;
  answers: Record<string, AnswerStatus>;
  completed_at: string | null;
};

type Pairing = {
  lesson_id: string;
  student_user_id: string;
  partner_user_id: string;
  partner_name: string;
  partner_student_number: number | null;
  score: number;
  helps_with: number[];
  partner_helps_with: number[];
};

type PostActivityResponse = {
  lesson_id: string;
  student_user_id: string;
  answers: Record<string, AnswerStatus>;
  reflection: string;
  completed_at: string | null;
};

type StudentFeedback = {
  lesson_id: string;
  student_user_id: string;
  feedback: string;
  source: "manual" | "gemini";
  updated_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export default function TeacherDashboard() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [responses, setResponses] = useState<LessonResponse[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [postActivityResponses, setPostActivityResponses] = useState<
    PostActivityResponse[]
  >([]);
  const [feedbacks, setFeedbacks] = useState<StudentFeedback[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedbackStudent, setFeedbackStudent] = useState<Student | null>(null);
  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [feedbackSource, setFeedbackSource] = useState<"manual" | "gemini">(
    "manual",
  );
  const [feedbackBusy, setFeedbackBusy] = useState<
    "generate" | "save" | null
  >(null);
  const [feedbackError, setFeedbackError] = useState("");

  useEffect(() => {
    fetch("/api/class-results", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          lessons?: Lesson[];
          students?: Student[];
          responses?: LessonResponse[];
          pairings?: Pairing[];
          postActivityResponses?: PostActivityResponse[];
          feedbacks?: StudentFeedback[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "대시보드 자료를 불러오지 못했습니다.");
        }
        const nextLessons = data.lessons ?? [];
        setLessons(nextLessons);
        setStudents(data.students ?? []);
        setResponses(data.responses ?? []);
        setPairings(data.pairings ?? []);
        setPostActivityResponses(data.postActivityResponses ?? []);
        setFeedbacks(data.feedbacks ?? []);
        setLessonId(nextLessons[0]?.id ?? "");
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "대시보드 자료를 불러오는 중 오류가 발생했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const selectedLesson =
    lessons.find((lesson) => lesson.id === lessonId) ?? lessons[0] ?? null;
  const classStudents = useMemo(
    () =>
      selectedLesson
        ? students.filter(
            (student) =>
              student.grade === selectedLesson.grade &&
              student.class_number === selectedLesson.class_number,
          )
        : [],
    [selectedLesson, students],
  );
  const selectedResponses = useMemo(
    () =>
      responses.filter(
        (response) => response.lesson_id === selectedLesson?.id,
      ),
    [responses, selectedLesson?.id],
  );
  const responseByStudent = useMemo(
    () =>
      new Map(
        selectedResponses.map((response) => [
          response.student_user_id,
          response,
        ]),
      ),
    [selectedResponses],
  );
  const studentById = useMemo(
    () => new Map(classStudents.map((student) => [student.user_id, student])),
    [classStudents],
  );
  const selectedPairs = useMemo(() => {
    const seen = new Set<string>();
    return pairings.filter((pairing) => {
      if (pairing.lesson_id !== selectedLesson?.id) return false;
      const key = [pairing.student_user_id, pairing.partner_user_id]
        .sort()
        .join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [pairings, selectedLesson?.id]);
  const selectedPostResponses = useMemo(
    () =>
      postActivityResponses.filter(
        (response) => response.lesson_id === selectedLesson?.id,
      ),
    [postActivityResponses, selectedLesson?.id],
  );
  const postResponseByStudent = useMemo(
    () =>
      new Map(
        selectedPostResponses.map((response) => [
          response.student_user_id,
          response,
        ]),
      ),
    [selectedPostResponses],
  );
  const feedbackByStudent = useMemo(
    () =>
      new Map(
        feedbacks
          .filter((feedback) => feedback.lesson_id === selectedLesson?.id)
          .map((feedback) => [feedback.student_user_id, feedback]),
      ),
    [feedbacks, selectedLesson?.id],
  );
  const comparableResults = useMemo(
    () =>
      selectedPostResponses
        .map((postResponse) => {
          const before = responseByStudent.get(postResponse.student_user_id);
          return before ? { before, after: postResponse } : null;
        })
        .filter(
          (
            result,
          ): result is {
            before: LessonResponse;
            after: PostActivityResponse;
          } => Boolean(result),
        ),
    [responseByStudent, selectedPostResponses],
  );

  const respondedCount = selectedResponses.length;
  const responseRate = classStudents.length
    ? Math.round((respondedCount / classStudents.length) * 100)
    : 0;
  const needsHelpCount = selectedResponses.filter((response) =>
    Object.values(response.answers ?? {}).includes("unsolved"),
  ).length;
  const difficultQuestions = useMemo(
    () =>
      (selectedLesson?.questions ?? [])
        .map((question) => ({
          ...question,
          count: selectedResponses.filter(
            (response) =>
              response.answers?.[String(question.number)] === "unsolved",
          ).length,
        }))
        .sort((left, right) => right.count - left.count)
        .slice(0, 3),
    [selectedLesson?.questions, selectedResponses],
  );
  const comparisonAnswerCount =
    comparableResults.length * (selectedLesson?.question_count ?? 0);
  const beforeSolvedCount = comparableResults.reduce(
    (total, result) =>
      total +
      Object.values(result.before.answers ?? {}).filter(
        (answer) => answer === "solved",
      ).length,
    0,
  );
  const afterSolvedCount = comparableResults.reduce(
    (total, result) =>
      total +
      (selectedLesson?.questions ?? []).filter((question) => {
        const key = String(question.number);
        return (
          result.before.answers?.[key] === "solved" ||
          result.after.answers?.[key] === "solved"
        );
      }).length,
    0,
  );
  const beforeSolvedRate = comparisonAnswerCount
    ? Math.round((beforeSolvedCount / comparisonAnswerCount) * 100)
    : 0;
  const afterSolvedRate = comparisonAnswerCount
    ? Math.round((afterSolvedCount / comparisonAnswerCount) * 100)
    : 0;
  const improvedStudents = comparableResults.filter((result) => {
    const beforeCount = Object.values(result.before.answers ?? {}).filter(
      (answer) => answer === "solved",
    ).length;
    const afterCount = (selectedLesson?.questions ?? []).filter((question) => {
      const key = String(question.number);
      return (
        result.before.answers?.[key] === "solved" ||
        result.after.answers?.[key] === "solved"
      );
    }).length;
    return afterCount > beforeCount;
  }).length;
  const questionChanges = (selectedLesson?.questions ?? []).map((question) => {
    const key = String(question.number);
    const beforeCount = comparableResults.filter(
      (result) => result.before.answers?.[key] === "solved",
    ).length;
    const afterCount = comparableResults.filter(
      (result) =>
        result.before.answers?.[key] === "solved" ||
        result.after.answers?.[key] === "solved",
    ).length;
    const beforeRate = comparableResults.length
      ? Math.round((beforeCount / comparableResults.length) * 100)
      : 0;
    const afterRate = comparableResults.length
      ? Math.round((afterCount / comparableResults.length) * 100)
      : 0;
    return {
      ...question,
      beforeRate,
      afterRate,
      change: afterRate - beforeRate,
    };
  });

  function openFeedback(student: Student) {
    const saved = feedbackByStudent.get(student.user_id);
    setFeedbackStudent(student);
    setFeedbackDraft(saved?.feedback ?? "");
    setFeedbackSource(saved?.source ?? "manual");
    setFeedbackError("");
  }

  async function generateFeedback() {
    if (!selectedLesson || !feedbackStudent || feedbackBusy) return;
    setFeedbackBusy("generate");
    setFeedbackError("");
    try {
      const response = await fetch("/api/student-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          lessonId: selectedLesson.id,
          studentUserId: feedbackStudent.user_id,
        }),
      });
      const data = (await response.json()) as {
        generated?: string;
        error?: string;
      };
      if (!response.ok || !data.generated) {
        throw new Error(data.error ?? "Gemini 피드백을 생성하지 못했습니다.");
      }
      setFeedbackDraft(data.generated);
      setFeedbackSource("gemini");
    } catch (reason) {
      setFeedbackError(
        reason instanceof Error
          ? reason.message
          : "Gemini 피드백 생성 중 오류가 발생했습니다.",
      );
    } finally {
      setFeedbackBusy(null);
    }
  }

  async function saveFeedback() {
    if (
      !selectedLesson ||
      !feedbackStudent ||
      !feedbackDraft.trim() ||
      feedbackBusy
    ) {
      return;
    }
    setFeedbackBusy("save");
    setFeedbackError("");
    try {
      const response = await fetch("/api/student-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          lessonId: selectedLesson.id,
          studentUserId: feedbackStudent.user_id,
          feedback: feedbackDraft,
          source: feedbackSource,
        }),
      });
      const data = (await response.json()) as {
        feedback?: StudentFeedback;
        error?: string;
      };
      if (!response.ok || !data.feedback) {
        throw new Error(data.error ?? "피드백을 저장하지 못했습니다.");
      }
      setFeedbacks((current) => [
        data.feedback!,
        ...current.filter(
          (feedback) =>
            !(
              feedback.lesson_id === data.feedback?.lesson_id &&
              feedback.student_user_id === data.feedback?.student_user_id
            ),
        ),
      ]);
      setFeedbackStudent(null);
    } catch (reason) {
      setFeedbackError(
        reason instanceof Error
          ? reason.message
          : "피드백 저장 중 오류가 발생했습니다.",
      );
    } finally {
      setFeedbackBusy(null);
    }
  }

  if (loading) {
    return (
      <section className="teacher-dashboard-page">
        <div className="panel dashboard-empty">수업 자료를 불러오고 있어요...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="teacher-dashboard-page">
        <p className="save-message error">{error}</p>
      </section>
    );
  }

  if (!selectedLesson) {
    return (
      <section className="teacher-dashboard-page">
        <div className="dashboard-hero">
          <div>
            <p className="overline">CLASS DASHBOARD</p>
            <h1>수업별 학습 현황을 확인해요</h1>
            <p>수업·문항 설정에서 수업을 개설하면 자료가 표시됩니다.</p>
          </div>
        </div>
        <div className="panel dashboard-empty">
          <h2>아직 개설된 수업이 없어요.</h2>
          <p>수업을 만든 뒤 학생들의 설문 결과를 확인해 주세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="teacher-dashboard-page">
      <div className="dashboard-hero">
        <div>
          <p className="overline">CLASS DASHBOARD / LESSON DATA</p>
          <h1>{selectedLesson.subject} 수업 학습 현황</h1>
          <p>
            {selectedLesson.grade}학년 {selectedLesson.class_number}반 ·{" "}
            {formatDate(selectedLesson.learning_date)} ·{" "}
            {formatLessonPeriod(selectedLesson.learning_time)}
          </p>
        </div>
        <label className="dashboard-lesson-switch">
          <span>수업 바꾸기</span>
          <select
            value={selectedLesson.id}
            onChange={(event) => setLessonId(event.target.value)}
          >
            {lessons.map((lesson) => (
              <option value={lesson.id} key={lesson.id}>
                {lesson.learning_date} · {lesson.grade}학년{" "}
                {lesson.class_number}반 · {formatLessonPeriod(lesson.learning_time)} ·{" "}
                {lesson.subject}
              </option>
            ))}
          </select>
        </label>
        <ComicCue
          label="TODAY'S REPORT"
          accent="blue"
          mood="explain"
          prop="checklist"
        >
          책상 위 보고서처럼 수업의 변화를 한눈에 살펴보세요.
        </ComicCue>
      </div>

      <div className="dashboard-stat-grid">
        <article className="panel">
          <span>응답 완료율</span>
          <b>{responseRate}%</b>
          <small>{classStudents.length}명 중 {respondedCount}명 제출</small>
          <i className="blue">↗</i>
        </article>
        <article className="panel">
          <span>답변 완료</span>
          <b>{respondedCount}명</b>
          <small>문항 상태 저장 완료</small>
          <i className="green">✓</i>
        </article>
        <article className="panel">
          <span>도움이 필요해요</span>
          <b>{needsHelpCount}명</b>
          <small>미해결 문항이 있는 학생</small>
          <i className="coral">!</i>
        </article>
        <article className="panel">
          <span>배움짝</span>
          <b>{selectedPairs.length}팀</b>
          <small>현재 수업의 저장된 매칭</small>
          <i className="navy">♧</i>
        </article>
      </div>

      <section className="panel activity-change-card">
        <div className="panel-head">
          <div>
            <h2>배움짝 활동 전후 변화</h2>
            <p>
              활동 전 설문과 활동 후 결과를 모두 제출한 학생을 비교합니다.
            </p>
          </div>
          <span className="trend">{comparableResults.length}명 비교</span>
        </div>
        {!comparableResults.length ? (
          <div className="dashboard-card-empty">
            학생이 활동 후 결과를 입력하면 변화 자료가 표시됩니다.
          </div>
        ) : (
          <div className="activity-change-layout">
            <div className="activity-change-summary">
              <div>
                <span>활동 전 해결률</span>
                <b>{beforeSolvedRate}%</b>
              </div>
              <strong>→</strong>
              <div>
                <span>활동 후 해결률</span>
                <b>{afterSolvedRate}%</b>
              </div>
              <div className="activity-improvement">
                <span>해결률 변화</span>
                <b>
                  {afterSolvedRate - beforeSolvedRate >= 0 ? "+" : ""}
                  {afterSolvedRate - beforeSolvedRate}%p
                </b>
                <small>{improvedStudents}명의 해결 문항 증가</small>
              </div>
            </div>
            <div className="activity-question-changes">
              {questionChanges.map((question) => (
                <div key={question.number}>
                  <b>{question.number}번</b>
                  <span>{question.beforeRate}%</span>
                  <i>→</i>
                  <span>{question.afterRate}%</span>
                  <strong
                    className={
                      question.change > 0
                        ? "improved"
                        : question.change < 0
                          ? "declined"
                          : ""
                    }
                  >
                    {question.change > 0 ? "+" : ""}
                    {question.change}%p
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="dashboard-data-grid">
        <section className="panel dashboard-heatmap-card">
          <div className="panel-head">
            <div>
              <h2>학생별 문제 해결 현황</h2>
              <p>✓는 해결, !는 미해결, ·는 미응답입니다.</p>
            </div>
            <span className="trend">{selectedLesson.question_count}개 문항</span>
          </div>
          {!classStudents.length ? (
            <div className="dashboard-card-empty">가입 학생이 아직 없어요.</div>
          ) : (
            <div className="dashboard-heatmap-wrap">
              <table className="dashboard-heatmap-table">
                <thead>
                  <tr>
                    <th>학생</th>
                    {selectedLesson.questions.map((question) => (
                      <th key={question.number}>{question.number}</th>
                    ))}
                    <th>성취도 증가</th>
                    <th>피드백</th>
                  </tr>
                </thead>
                <tbody>
                  {classStudents.map((student) => {
                    const studentResponse = responseByStudent.get(
                      student.user_id,
                    );
                    const postResponse = postResponseByStudent.get(
                      student.user_id,
                    );
                    const beforeSolved = selectedLesson.questions.filter(
                      (question) =>
                        studentResponse?.answers?.[
                          String(question.number)
                        ] === "solved",
                    ).length;
                    const afterSolved = selectedLesson.questions.filter(
                      (question) => {
                        const key = String(question.number);
                        return (
                          studentResponse?.answers?.[key] === "solved" ||
                          postResponse?.answers?.[key] === "solved"
                        );
                      },
                    ).length;
                    const achievementIncrease = postResponse
                      ? Math.round(
                          ((afterSolved - beforeSolved) /
                            selectedLesson.question_count) *
                            100,
                        )
                      : null;
                    return (
                      <tr key={student.user_id}>
                        <td>
                          {student.student_number ?? "-"}번{" "}
                          <b>{student.display_name}</b>
                        </td>
                        {selectedLesson.questions.map((question) => {
                          const beforeAnswer =
                            studentResponse?.answers?.[String(question.number)];
                          const afterAnswer =
                            beforeAnswer === "solved"
                              ? "solved"
                              : postResponse?.answers?.[
                                  String(question.number)
                                ];
                          return (
                            <td key={question.number}>
                              <div className="answer-comparison">
                                <span>
                                  <small>전</small>
                                  <i
                                    className={beforeAnswer ?? "unanswered"}
                                    title={
                                      beforeAnswer === "solved"
                                        ? "활동 전 해결"
                                        : beforeAnswer === "unsolved"
                                          ? "활동 전 미해결"
                                          : "활동 전 미응답"
                                    }
                                  >
                                    {beforeAnswer === "solved"
                                      ? "✓"
                                      : beforeAnswer === "unsolved"
                                        ? "!"
                                        : "·"}
                                  </i>
                                </span>
                                <span>
                                  <small>후</small>
                                  <i
                                    className={afterAnswer ?? "unanswered"}
                                    title={
                                      afterAnswer === "solved"
                                        ? "활동 후 해결"
                                        : afterAnswer === "unsolved"
                                          ? "활동 후 미해결"
                                          : "활동 후 미입력"
                                    }
                                  >
                                    {afterAnswer === "solved"
                                      ? "✓"
                                      : afterAnswer === "unsolved"
                                        ? "!"
                                        : "·"}
                                  </i>
                                </span>
                              </div>
                            </td>
                          );
                        })}
                        <td>
                          <strong
                            className={
                              achievementIncrease && achievementIncrease > 0
                                ? "student-achievement improved"
                                : "student-achievement"
                            }
                          >
                            {achievementIncrease === null
                              ? "활동 후 대기"
                              : `${achievementIncrease > 0 ? "+" : ""}${achievementIncrease}%p`}
                          </strong>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="student-feedback-button"
                            onClick={() => openFeedback(student)}
                          >
                            {feedbackByStudent.has(student.user_id)
                              ? "피드백 수정"
                              : "피드백 주기"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel dashboard-difficult-card">
          <div className="panel-head">
            <div>
              <h2>어려운 문제 TOP 3</h2>
              <p>미해결 응답이 많은 문항입니다.</p>
            </div>
          </div>
          {respondedCount ? (
            difficultQuestions.map((question, index) => (
              <div className="dashboard-difficult-row" key={question.number}>
                <strong>{index + 1}</strong>
                <div>
                  <b>{question.number}번 · {question.title}</b>
                  <div>
                    <i
                      style={{
                        width: `${(question.count / respondedCount) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <span>
                  {Math.round((question.count / respondedCount) * 100)}%
                </span>
              </div>
            ))
          ) : (
            <div className="dashboard-card-empty">아직 제출된 설문이 없어요.</div>
          )}
        </section>
      </div>

      <section className="panel dashboard-pairs-card">
        <div className="panel-head">
          <div>
            <h2>이 수업의 배움짝</h2>
            <p>짝 매칭 관리에서 저장한 수업별 결과입니다.</p>
          </div>
          <span className="trend">{selectedPairs.length}팀</span>
        </div>
        {!selectedPairs.length ? (
          <div className="dashboard-card-empty">
            이 수업은 아직 배움짝을 매칭하지 않았어요.
          </div>
        ) : (
          <div className="dashboard-pair-grid">
            {selectedPairs.map((pairing) => {
              const student = studentById.get(pairing.student_user_id);
              return (
                <article
                  key={`${pairing.student_user_id}-${pairing.partner_user_id}`}
                >
                  <div>
                    <i>{student?.display_name.slice(0, 1) ?? "?"}</i>
                    <b>{student?.display_name ?? "학생"}</b>
                    <small>{student?.student_number ?? "-"}번</small>
                  </div>
                  <strong>↔</strong>
                  <div>
                    <i>{pairing.partner_name.slice(0, 1)}</i>
                    <b>{pairing.partner_name}</b>
                    <small>{pairing.partner_student_number ?? "-"}번</small>
                  </div>
                  <span>보완 점수 {pairing.score}</span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {feedbackStudent && selectedLesson && (
        <div
          className="feedback-modal-backdrop"
          role="presentation"
          onMouseDown={() => setFeedbackStudent(null)}
        >
          <section
            className="feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="feedback-modal-close"
              aria-label="피드백 창 닫기"
              onClick={() => setFeedbackStudent(null)}
            >
              ×
            </button>
            <p className="overline">STUDENT FEEDBACK</p>
            <h2 id="feedback-modal-title">
              {feedbackStudent.display_name} 학생 피드백
            </h2>
            <p>
              {selectedLesson.subject} 수업의 활동 전후 문제 해결 변화를
              바탕으로 작성합니다.
            </p>
            <textarea
              value={feedbackDraft}
              maxLength={2000}
              onChange={(event) => {
                setFeedbackDraft(event.target.value);
                setFeedbackSource("manual");
              }}
              placeholder="학생에게 전달할 구체적인 칭찬과 다음 학습 방향을 입력해 주세요."
            />
            <div className="feedback-character-count">
              <span>
                {feedbackSource === "gemini"
                  ? "Gemini 초안 · 저장 전 수정 가능"
                  : "교사 직접 작성"}
              </span>
              <b>{feedbackDraft.length} / 2,000</b>
            </div>
            {feedbackError && (
              <p className="save-message error">{feedbackError}</p>
            )}
            <div className="feedback-modal-actions">
              <button
                type="button"
                className="secondary gemini-feedback-button"
                disabled={feedbackBusy !== null}
                onClick={generateFeedback}
              >
                {feedbackBusy === "generate"
                  ? "Gemini 생성 중..."
                  : "✨ Gemini로 초안 생성"}
              </button>
              <button
                type="button"
                className="primary"
                disabled={!feedbackDraft.trim() || feedbackBusy !== null}
                onClick={saveFeedback}
              >
                {feedbackBusy === "save" ? "저장 중..." : "피드백 저장"}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
