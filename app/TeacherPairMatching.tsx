"use client";

import { useEffect, useMemo, useState } from "react";
import { ComicCue } from "./ComicUI";
import { formatLessonPeriod } from "./lesson-period";
import { getRememberedLesson, rememberLesson } from "./lesson-selection";

type Lesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
  question_count: number;
};

type MatchStudent = {
  userId: string;
  name: string;
  studentNumber: number | null;
  helpsWith: number[];
};

type Pair = {
  id: string;
  score: number;
  first: MatchStudent;
  second: MatchStudent;
};

type MatchResult = {
  lesson: Lesson;
  pairs: Pair[];
  unmatched: Array<{
    userId: string;
    name: string;
    studentNumber: number | null;
  }>;
  totalClassStudents: number;
  respondedStudents: number;
  excludedStudents: number;
  strategy: "recommended" | "random" | "saved";
};

function lessonLabel(lesson: Lesson) {
  return `${lesson.learning_date} · ${formatLessonPeriod(lesson.learning_time)} · ${lesson.subject} · ${lesson.question_count}문항`;
}

function problemLabel(numbers: number[]) {
  return numbers.length
    ? numbers.map((number) => `${number}번`).join(", ")
    : "서로 보완할 문항 없음";
}

export default function TeacherPairMatching() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [classKey, setClassKey] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [loadingResult, setLoadingResult] = useState(false);
  const [matching, setMatching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/class-results", { cache: "no-store" })
      .then(async (response) => {
        const data = (await response.json()) as {
          lessons?: Lesson[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "수업을 불러오지 못했습니다.");
        }
        const nextLessons = data.lessons ?? [];
        setLessons(nextLessons);
        if (nextLessons.length) {
          const nextLesson =
            getRememberedLesson("teacher-pair-matching", nextLessons) ??
            nextLessons[0];
          setClassKey(`${nextLesson.grade}-${nextLesson.class_number}`);
          setLessonId(nextLesson.id);
        }
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "수업을 불러오는 중 오류가 발생했습니다.",
        ),
      )
      .finally(() => setLoadingLessons(false));
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

  useEffect(() => {
    if (!lessonId) {
      setResult(null);
      return;
    }

    let active = true;
    setLoadingResult(true);
    setError("");
    fetch(`/api/pair-matching?lessonId=${encodeURIComponent(lessonId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          result?: MatchResult | null;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "저장된 매칭을 불러오지 못했습니다.");
        }
        if (active) setResult(data.result ?? null);
      })
      .catch((reason) => {
        if (!active) return;
        setResult(null);
        setError(
          reason instanceof Error
            ? reason.message
            : "저장된 매칭을 불러오는 중 오류가 발생했습니다.",
        );
      })
      .finally(() => {
        if (active) setLoadingResult(false);
      });

    return () => {
      active = false;
    };
  }, [lessonId]);

  function changeClass(nextClassKey: string) {
    setClassKey(nextClassKey);
    setResult(null);
    const firstLesson = lessons.find(
      (lesson) =>
        `${lesson.grade}-${lesson.class_number}` === nextClassKey,
    );
    setLessonId(firstLesson?.id ?? "");
    if (firstLesson) {
      rememberLesson("teacher-pair-matching", firstLesson);
    }
  }

  async function createMatches(
    mode: "recommended" | "random" = "recommended",
    selectedLessonId = lessonId,
  ) {
    if (!selectedLessonId || matching) return;
    setMatching(true);
    setError("");
    try {
      const response = await fetch("/api/pair-matching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId: selectedLessonId, mode }),
      });
      const data = (await response.json()) as MatchResult & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "짝을 매칭하지 못했습니다.");
      }
      setResult(data);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "짝을 매칭하는 중 오류가 발생했습니다.",
      );
    } finally {
      setMatching(false);
    }
  }

  if (loadingLessons) {
    return (
      <section className="matching-page">
        <div className="panel matching-empty">
          수업과 설문 결과를 확인하고 있어요...
        </div>
      </section>
    );
  }

  if (!lessons.length) {
    return (
      <section className="matching-page">
        <div className="settings-hero">
          <div>
            <p className="overline">SMART PEER MATCHING</p>
            <h1>수업별 배움짝을 매칭해요</h1>
            <p>수업을 등록하고 학생 설문을 받은 뒤 매칭할 수 있습니다.</p>
          </div>
        </div>
        <div className="panel matching-empty">
          <h2>매칭할 수업이 아직 없어요.</h2>
          <p>수업·문항 설정에서 먼저 수업을 개설해 주세요.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="matching-page">
      <div className="settings-hero matching-hero">
        <div>
          <p className="overline">SMART PEER MATCHING</p>
          <h1>서로의 빈틈을 채우는 배움짝을 만들어요</h1>
          <p>
            해결 문항과 미해결 문항이 많이 겹치는 학생을 우선 연결하고,
            동점 후보는 무작위로 배정합니다.
          </p>
        </div>
        {result && (
          <div className="matching-actions">
            <button
              className="secondary rematch-button"
              disabled={!lessonId || matching}
              onClick={() => createMatches("random")}
            >
              임의 매칭
            </button>
            <button
              className="primary rematch-button"
              disabled={!lessonId || matching}
              onClick={() => createMatches("recommended")}
            >
              {matching ? "매칭 중..." : "↻ 추천 다시 매칭"}
            </button>
          </div>
        )}
        <ComicCue label="PAIR MISSION" accent="mint" mood="cheer" prop="note">
          서로 설명해 줄 문제가 많은 친구부터 연결해요!
        </ComicCue>
      </div>

      <div className="panel matching-filters">
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
          개설 수업
          <select
            value={lessonId}
            onChange={(event) => {
              setResult(null);
              setLessonId(event.target.value);
              const nextLesson = classLessons.find(
                (lesson) => lesson.id === event.target.value,
              );
              if (nextLesson) {
                rememberLesson("teacher-pair-matching", nextLesson);
              }
            }}
          >
            {classLessons.map((lesson) => (
              <option value={lesson.id} key={lesson.id}>
                {lessonLabel(lesson)}
              </option>
            ))}
          </select>
        </label>
        <div className="matching-rule">
          <span>매칭 점수</span>
          <b>상대가 못 푼 문항을 내가 푼 횟수의 합</b>
        </div>
      </div>

      {error && <p className="save-message error">{error}</p>}

      {loadingResult && (
        <div className="panel matching-empty">
          저장된 배움짝 현황을 확인하고 있어요...
        </div>
      )}

      {!loadingResult && !result && !error && (
        <div className="panel matching-empty matching-start">
          <h2>선택한 수업의 배움짝을 매칭해 주세요.</h2>
          <p>
            추천 매칭은 설문 결과를 기준으로 연결하고, 임의 매칭은 등록
            학생 전체를 무작위로 연결합니다.
          </p>
          <div className="matching-actions">
            <button
              type="button"
              className="secondary"
              disabled={!lessonId || matching}
              onClick={() => createMatches("random")}
            >
              임의 매칭
            </button>
            <button
              type="button"
              className="primary"
              disabled={!lessonId || matching}
              onClick={() => createMatches("recommended")}
            >
              {matching ? "매칭 중..." : "추천 매칭하기"}
            </button>
          </div>
        </div>
      )}

      {!loadingResult && result && (
        <>
          <div className="matching-stats">
            <div className="panel">
              <span>설문 참여</span>
              <b>{result.respondedStudents}명</b>
              <small>가입 학생 {result.totalClassStudents}명 중</small>
            </div>
            <div className="panel">
              <span>완성된 배움짝</span>
              <b>{result.pairs.length}팀</b>
              <small>
                {result.strategy === "random"
                  ? "등록 학생 임의 배정"
                  : result.strategy === "saved"
                    ? "저장된 매칭 현황"
                    : "겹침 점수 우선 배정"}
              </small>
            </div>
            <div className="panel">
              <span>매칭 제외</span>
              <b>{result.excludedStudents}명</b>
              <small>설문 미제출 학생</small>
            </div>
          </div>

          {!result.pairs.length ? (
            <div className="panel matching-empty">
              <h2>매칭하려면 설문을 제출한 학생이 2명 이상 필요해요.</h2>
              <p>학생들이 문항별 풀이 여부를 저장하면 자동으로 포함됩니다.</p>
            </div>
          ) : (
            <div className="matching-grid">
              {result.pairs.map((pair, index) => (
                <article className="panel matching-card" key={pair.id}>
                  <div className="matching-card-head">
                    <span>PAIR {String(index + 1).padStart(2, "0")}</span>
                    <b>보완 점수 {pair.score}</b>
                  </div>
                  <div className="matched-students">
                    <div>
                      <i>{pair.first.name.slice(0, 1)}</i>
                      <b>{pair.first.name}</b>
                      <small>{pair.first.studentNumber ?? "-"}번</small>
                    </div>
                    <strong>↔</strong>
                    <div>
                      <i>{pair.second.name.slice(0, 1)}</i>
                      <b>{pair.second.name}</b>
                      <small>{pair.second.studentNumber ?? "-"}번</small>
                    </div>
                  </div>
                  <div className="match-directions">
                    <div>
                      <span>{pair.first.name} → {pair.second.name}</span>
                      <b>{problemLabel(pair.first.helpsWith)}</b>
                    </div>
                    <div>
                      <span>{pair.second.name} → {pair.first.name}</span>
                      <b>{problemLabel(pair.second.helpsWith)}</b>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {result.unmatched.length > 0 && (
            <div className="panel unmatched-students">
              <span>홀수 인원으로 이번 매칭에서 대기</span>
              <div>
                {result.unmatched.map((student) => (
                  <b key={student.userId}>
                    {student.studentNumber ?? "-"}번 {student.name}
                  </b>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
