type RememberableLesson = {
  id: string;
  subject: string;
};

function storageKey(view: string, subject: string) {
  return `baemjjak:last-lesson:${view}:${subject}`;
}

export function getRememberedLesson<T extends RememberableLesson>(
  view: string,
  lessons: T[],
) {
  if (typeof window === "undefined" || !lessons.length) return null;

  try {
    const lessonId = window.localStorage.getItem(
      storageKey(view, lessons[0].subject),
    );
    return lessons.find((lesson) => lesson.id === lessonId) ?? null;
  } catch {
    return null;
  }
}

export function rememberLesson(view: string, lesson: RememberableLesson) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(storageKey(view, lesson.subject), lesson.id);
  } catch {
    // 브라우저 저장소를 사용할 수 없어도 현재 수업 선택은 정상 동작합니다.
  }
}
