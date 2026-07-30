export const TEACHER_SUBJECTS = [
  "국어",
  "수학",
  "사회",
  "과학",
  "영어",
  "도덕",
  "기술·가정",
  "정보",
  "체육",
  "음악",
  "미술",
] as const;

export const DEFAULT_TEACHER_SUBJECT = "수학";

export function isTeacherSubject(value: unknown): value is string {
  return (
    typeof value === "string" &&
    TEACHER_SUBJECTS.includes(value as (typeof TEACHER_SUBJECTS)[number])
  );
}

export function normalizeSubjects(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(value.filter((item): item is string => isTeacherSubject(item))),
  );
}
