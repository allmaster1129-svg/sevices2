"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Lesson = {
  id: string;
  grade: number;
  class_number: number;
  learning_date: string;
  learning_time: string;
  subject: string;
};

type Student = {
  user_id: string;
  grade: number;
  class_number: number;
};

type CompletionRecord = {
  lesson_id: string;
  student_user_id: string;
  completed_at: string | null;
  updated_at: string | null;
};

type Pairing = {
  lesson_id: string;
  student_user_id: string;
  partner_user_id: string;
};

type StudentPairing = {
  partner_name: string;
  partner_student_number: number | null;
  generated_at: string;
};

type StudentLesson = Lesson & {
  pairing: StudentPairing | null;
};

type NotificationItem = {
  id: string;
  type: "survey" | "activity" | "matching";
  title: string;
  description: string;
  occurredAt: string;
};

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function NotificationCenter({
  isTeacher,
}: {
  isTeacher: boolean;
}) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("baemjjak-seen-notifications");
      setSeenIds(stored ? (JSON.parse(stored) as string[]) : []);
    } catch {
      setSeenIds([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const response = await fetch(
          isTeacher ? "/api/class-results" : "/api/student-lessons",
          {
            cache: "no-store",
          },
        );

        if (!isTeacher) {
          const data = (await response.json()) as {
            lessons?: StudentLesson[];
            error?: string;
          };
          if (!response.ok) {
            throw new Error(data.error ?? "알림 이력을 불러오지 못했습니다.");
          }

          const nextItems = (data.lessons ?? [])
            .filter(
              (lesson): lesson is StudentLesson & {
                pairing: StudentPairing;
              } => Boolean(lesson.pairing),
            )
            .map<NotificationItem>((lesson) => ({
              id: `matching-${lesson.id}-${lesson.pairing.generated_at}`,
              type: "matching",
              title: "새 배움짝 매칭 완료",
              description: `${lesson.learning_date} · ${lesson.subject} 수업에서 ${lesson.pairing.partner_name} 학생과 배움짝으로 매칭됐어요.`,
              occurredAt: lesson.pairing.generated_at,
            }))
            .sort(
              (a, b) =>
                new Date(b.occurredAt).getTime() -
                new Date(a.occurredAt).getTime(),
            );

          if (active) {
            setItems(nextItems);
            setError("");
          }
          return;
        }

        const data = (await response.json()) as {
          lessons?: Lesson[];
          students?: Student[];
          responses?: CompletionRecord[];
          pairings?: Pairing[];
          postActivityResponses?: CompletionRecord[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "알림 이력을 불러오지 못했습니다.");
        }

        const students = data.students ?? [];
        const responses = data.responses ?? [];
        const pairings = data.pairings ?? [];
        const postResponses = data.postActivityResponses ?? [];
        const nextItems: NotificationItem[] = [];

        for (const lesson of data.lessons ?? []) {
          const classStudentIds = new Set(
            students
              .filter(
                (student) =>
                  student.grade === lesson.grade &&
                  student.class_number === lesson.class_number,
              )
              .map((student) => student.user_id),
          );
          const surveyRows = responses.filter(
            (record) =>
              record.lesson_id === lesson.id &&
              classStudentIds.has(record.student_user_id) &&
              Boolean(record.completed_at),
          );
          const surveyStudentIds = new Set(
            surveyRows.map((record) => record.student_user_id),
          );

          if (
            classStudentIds.size > 0 &&
            surveyStudentIds.size === classStudentIds.size
          ) {
            const occurredAt = surveyRows
              .map((record) => record.completed_at ?? record.updated_at ?? "")
              .sort()
              .at(-1);
            nextItems.push({
              id: `survey-${lesson.id}`,
              type: "survey",
              title: "학생 전체 설문 완료",
              description: `${lesson.grade}학년 ${lesson.class_number}반 · ${lesson.subject} 수업의 ${classStudentIds.size}명 응답이 모두 모였어요.`,
              occurredAt:
                occurredAt ||
                `${lesson.learning_date}T${lesson.learning_time}`,
            });
          }

          const pairedStudentIds = new Set(
            pairings
              .filter((pairing) => pairing.lesson_id === lesson.id)
              .flatMap((pairing) => [
                pairing.student_user_id,
                pairing.partner_user_id,
              ]),
          );
          const activityRows = postResponses.filter(
            (record) =>
              record.lesson_id === lesson.id &&
              pairedStudentIds.has(record.student_user_id) &&
              Boolean(record.completed_at),
          );
          const activityStudentIds = new Set(
            activityRows.map((record) => record.student_user_id),
          );

          if (
            pairedStudentIds.size > 0 &&
            activityStudentIds.size === pairedStudentIds.size
          ) {
            const occurredAt = activityRows
              .map((record) => record.completed_at ?? record.updated_at ?? "")
              .sort()
              .at(-1);
            nextItems.push({
              id: `activity-${lesson.id}`,
              type: "activity",
              title: "배움짝 활동 완료",
              description: `${lesson.grade}학년 ${lesson.class_number}반 · ${lesson.subject} 수업의 배움짝 활동 결과가 모두 제출됐어요.`,
              occurredAt:
                occurredAt ||
                `${lesson.learning_date}T${lesson.learning_time}`,
            });
          }
        }

        if (active) {
          setItems(
            nextItems.sort(
              (a, b) =>
                new Date(b.occurredAt).getTime() -
                new Date(a.occurredAt).getTime(),
            ),
          );
          setError("");
        }
      } catch (reason) {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "알림 이력을 불러오는 중 오류가 발생했습니다.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isTeacher]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const unreadCount = useMemo(
    () => items.filter((item) => !seenIds.includes(item.id)).length,
    [items, seenIds],
  );

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next && items.length) {
        const nextSeenIds = Array.from(
          new Set([...seenIds, ...items.map((item) => item.id)]),
        );
        setSeenIds(nextSeenIds);
        window.localStorage.setItem(
          "baemjjak-seen-notifications",
          JSON.stringify(nextSeenIds),
        );
      }
      return next;
    });
  };

  return (
    <div className="notification-center" ref={containerRef}>
      <button
        type="button"
        className="notification-trigger"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggleOpen}
      >
        <span aria-hidden="true">◔</span>
        알림
        {unreadCount > 0 && (
          <i
            className="notification-badge"
            aria-label={`새 알림 ${unreadCount}개`}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </i>
        )}
      </button>
      {open && (
        <section className="notification-dropdown" aria-label="알림 이력">
          <div className="notification-heading">
            <div>
              <b>알림 이력</b>
              <span>
                {isTeacher
                  ? "수업 완료 현황을 확인하세요."
                  : "새로운 배움짝 매칭을 확인하세요."}
              </span>
            </div>
            <em>{items.length}개</em>
          </div>
          <div className="notification-list">
            {loading ? (
              <p className="notification-empty">알림을 확인하고 있어요...</p>
            ) : error ? (
              <p className="notification-error">{error}</p>
            ) : !items.length ? (
              <p className="notification-empty">
                {isTeacher
                  ? "아직 완료된 설문이나 배움짝 활동이 없어요."
                  : "아직 완료된 배움짝 매칭이 없어요."}
              </p>
            ) : (
              items.map((item) => (
                <article className="notification-item" key={item.id}>
                  <span
                    className={`notification-icon ${item.type}`}
                    aria-hidden="true"
                  >
                    {item.type === "survey"
                      ? "✓"
                      : item.type === "matching"
                        ? "짝"
                        : "↔"}
                  </span>
                  <div>
                    <b>{item.title}</b>
                    <p>{item.description}</p>
                    <time>{formatNotificationTime(item.occurredAt)}</time>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
