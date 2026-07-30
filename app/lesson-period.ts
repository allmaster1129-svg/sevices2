export const LESSON_PERIODS = [
  { period: 1, time: "09:00" },
  { period: 2, time: "10:00" },
  { period: 3, time: "11:00" },
  { period: 4, time: "12:00" },
  { period: 5, time: "13:00" },
  { period: 6, time: "14:00" },
  { period: 7, time: "15:00" },
] as const;

export function formatLessonPeriod(time: string) {
  const normalized = time.slice(0, 5);
  const matched = LESSON_PERIODS.find((item) => item.time === normalized);
  return matched ? `${matched.period}교시` : normalized;
}
