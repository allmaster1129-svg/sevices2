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
  created_at: string;
};

type LessonResponse = {
  lesson_id: string;
  student_user_id: string;
  answers: Record<string, AnswerStatus>;
  completed_at: string | null;
  updated_at: string;
};

function formatLessonDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${value}T00:00:00`));
}

export default function TeacherClassResults() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [responses, setResponses] = useState<LessonResponse[]>([]);
  const [classKey, setClassKey] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/class-results", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          lessons?: Lesson[];
          students?: Student[];
          responses?: LessonResponse[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "학급 정보를 불러오지 못했습니다.");
        }
        const nextLessons = result.lessons ?? [];
        setLessons(nextLessons);
        setStudents(result.students ?? []);
        setResponses(result.responses ?? []);
        if (nextLessons.length) {
          const firstClass = `${nextLessons[0].grade}-${nextLessons[0].class_number}`;
          setClassKey(firstClass);
          setLessonId(nextLessons[0].id);
        }
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "학급 정보를 불러오는 중 오류가 발생했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const classes = useMemo(() => {
    const seen = new Set<string>();
    return lessons
      .filter((lesson) => {
        const key = `${lesson.grade}-${lesson.class_number}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((lesson) => ({
        key: `${lesson.grade}-${lesson.class_number}`,
        grade: lesson.grade,
        classNumber: lesson.class_number,
      }));
  }, [lessons]);

  const classLessons = useMemo(
    () =>
      lessons.filter(
        (lesson) => `${lesson.grade}-${lesson.class_number}` === classKey,
      ),
    [classKey, lessons],
  );
  const selectedLesson =
    classLessons.find((lesson) => lesson.id === lessonId) ??
    classLessons[0] ??
    null;
  const classStudents = useMemo(
    () =>
      students.filter(
        (student) => `${student.grade}-${student.class_number}` === classKey,
      ),
    [classKey, students],
  );
  const responseByStudent = useMemo(
    () =>
      new Map(
        responses
          .filter((response) => response.lesson_id === selectedLesson?.id)
          .map((response) => [response.student_user_id, response]),
      ),
    [responses, selectedLesson?.id],
  );

  const submittedCount = classStudents.filter((student) =>
    responseByStudent.has(student.user_id),
  ).length;
  const totalAnswerCount = Array.from(responseByStudent.values()).reduce(
    (sum, response) => sum + Object.keys(response.answers ?? {}).length,
    0,
  );
  const solvedCount = Array.from(responseByStudent.values()).reduce(
    (sum, response) =>
      sum +
      Object.values(response.answers ?? {}).filter(
        (answer) => answer === "solved",
      ).length,
    0,
  );
  const solvedRate = totalAnswerCount
    ? Math.round((solvedCount / totalAnswerCount) * 100)
    : 0;

  function changeClass(nextClassKey: string) {
    setClassKey(nextClassKey);
    const firstLesson = lessons.find(
      (lesson) =>
        `${lesson.grade}-${lesson.class_number}` === nextClassKey,
    );
    setLessonId(firstLesson?.id ?? "");
  }

  if (loading) {
    return (
      <section className="class-results-page">
        <div className="panel class-results-empty">
          가입 학생과 설문 결과를 불러오고 있어요...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="class-results-page">
        <p className="save-message error">{error}</p>
      </section>
    );
  }

  if (!lessons.length) {
    return (
      <section className="class-results-page">
        <div className="settings-hero">
          <div>
            <p className="overline">CLASS MEMBERS / SURVEY RESULTS</p>
            <h1>학급 명단 확인</h1>
            <p>수업을 등록하면 해당 학급의 가입 학생과 응답을 확인할 수 있어요.</p>
          </div>
        </div>
        <div className="panel class-results-empty">
          <span>등록된 수업 없음</span>
          <h2>먼저 수업·문항을 설정해 주세요.</h2>
          <p>수업의 학년과 반을 기준으로 가입 학생 명단이 자동 연결됩니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="class-results-page">
      <div className="settings-hero class-results-hero">
        <div>
          <p className="overline">CLASS MEMBERS / SURVEY RESULTS</p>
          <h1>학급별 가입 학생과 설문 결과를 확인해요</h1>
          <p>담당 학급과 수업을 선택하면 학생별 문항 응답이 표시됩니다.</p>
        </div>
        <span className="settings-count">
          담당 학급 <b>{classes.length}개</b>
        </span>
        <ComicCue
          label="SURVEY FILE"
          accent="pink"
          mood="think"
          prop="checklist"
        >
          미응답 학생과 어려운 문항을 한 장의 기록표에서 확인해요.
        </ComicCue>
      </div>

      <div className="panel class-results-filters">
        <label>
          학급
          <select value={classKey} onChange={(event) => changeClass(event.target.value)}>
            {classes.map((item) => (
              <option value={item.key} key={item.key}>
                {item.grade}학년 {item.classNumber}반
              </option>
            ))}
          </select>
        </label>
        <label>
          수업
          <select
            value={selectedLesson?.id ?? ""}
            onChange={(event) => setLessonId(event.target.value)}
          >
            {classLessons.map((lesson) => (
              <option value={lesson.id} key={lesson.id}>
                {lesson.learning_date} · {lesson.subject} · {lesson.question_count}문항
              </option>
            ))}
          </select>
        </label>
        {selectedLesson && (
          <div className="selected-lesson-time">
            <span>선택한 수업</span>
            <b>{formatLessonDate(selectedLesson.learning_date)}</b>
            <small>{formatLessonPeriod(selectedLesson.learning_time)}</small>
          </div>
        )}
      </div>

      <div className="class-results-stats">
        <div className="panel">
          <span>가입 학생</span>
          <b>{classStudents.length}명</b>
          <small>현재 학년·반 정보 기준</small>
        </div>
        <div className="panel">
          <span>설문 제출</span>
          <b>{submittedCount}명</b>
          <small>
            {classStudents.length
              ? `${Math.round((submittedCount / classStudents.length) * 100)}% 완료`
              : "가입 학생 없음"}
          </small>
        </div>
        <div className="panel">
          <span>풀이 완료 응답</span>
          <b>{solvedRate}%</b>
          <small>{solvedCount}개 문항을 풀었어요</small>
        </div>
      </div>

      <section className="panel class-results-table-card">
        <div className="class-results-table-head">
          <div>
            <h2>
              {selectedLesson?.grade}학년 {selectedLesson?.class_number}반 학생 응답
            </h2>
            <p>
              {selectedLesson?.subject} · 학생이 선택한 문항별 풀이 여부입니다.
            </p>
          </div>
          <div className="result-legend">
            <span><i className="solved" /> 풀었어요</span>
            <span><i className="unsolved" /> 못 풀었어요</span>
            <span><i className="unanswered" /> 미응답</span>
          </div>
        </div>

        {!classStudents.length ? (
          <div className="class-results-empty compact">
            <h2>이 학급에 가입한 학생이 아직 없어요.</h2>
            <p>학생이 회원가입 후 같은 학년과 반을 입력하면 자동으로 표시됩니다.</p>
          </div>
        ) : (
          <div className="class-results-table-wrap">
            <table className="class-results-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>학생</th>
                  <th>제출 상태</th>
                  {(selectedLesson?.questions ?? []).map((question) => (
                    <th key={question.number} title={question.title}>
                      {question.number}번
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classStudents.map((student) => {
                  const response = responseByStudent.get(student.user_id);
                  return (
                    <tr key={student.user_id}>
                      <td>{student.student_number ?? "-"}</td>
                      <td>
                        <span className="student-name-cell">
                          <i>{student.display_name.slice(0, 1)}</i>
                          <b>{student.display_name}</b>
                        </span>
                      </td>
                      <td>
                        <span className={response ? "submission done" : "submission waiting"}>
                          {response ? "제출 완료" : "미제출"}
                        </span>
                      </td>
                      {(selectedLesson?.questions ?? []).map((question) => {
                        const answer = response?.answers?.[String(question.number)];
                        return (
                          <td key={question.number}>
                            <span
                              className={`result-mark ${answer ?? "unanswered"}`}
                              aria-label={
                                answer === "solved"
                                  ? "풀었어요"
                                  : answer === "unsolved"
                                    ? "못 풀었어요"
                                    : "미응답"
                              }
                            >
                              {answer === "solved" ? "✓" : answer === "unsolved" ? "!" : "·"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
