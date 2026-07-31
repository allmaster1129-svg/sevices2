import type {
  AccountProfile,
  DemoPersonaId,
} from "./ClerkDatabaseSetup";
import type { StudentProgressLesson } from "./StudentProgressDashboard";
import type { TeacherDashboardDemoData } from "./TeacherDashboard";

const DEMO_LESSON_ID = "demo-math-lesson";
const DEMO_DATE = "2026-07-31";
const DEMO_QUESTIONS = [
  { number: 1, title: "순환소수의 의미", content: "순환소수를 구분해요." },
  { number: 2, title: "순환마디 찾기", content: "순환마디를 찾아요." },
  { number: 3, title: "분수로 나타내기", content: "순환소수를 분수로 바꿔요." },
];

const DEMO_STUDENTS = [
  { id: "demo-hong", name: "홍길동", number: 1 },
  { id: "demo-kim", name: "김철수", number: 2 },
  { id: "demo-go", name: "고길동", number: 3 },
  { id: "demo-mu", name: "무궁화", number: 4 },
] as const;

const BEFORE = {
  "demo-hong": { "1": "solved", "2": "unsolved", "3": "solved" },
  "demo-kim": { "1": "unsolved", "2": "solved", "3": "unsolved" },
  "demo-go": { "1": "unsolved", "2": "unsolved", "3": "unsolved" },
  "demo-mu": { "1": "unsolved", "2": "unsolved", "3": "solved" },
} as const;

const AFTER = {
  "demo-hong": { "2": "solved" },
  "demo-kim": { "1": "solved", "3": "solved" },
  "demo-go": { "1": "unsolved", "2": "solved", "3": "unsolved" },
  "demo-mu": { "1": "solved", "2": "unsolved" },
} as const;

const REFLECTIONS = {
  "demo-hong": "친구에게 설명하면서 순환마디를 찾는 방법이 더 분명해졌어요.",
  "demo-kim": "홍길동 학생의 설명을 듣고 식을 세우는 순서를 이해했어요.",
  "demo-go": "2번은 해결했지만 분수로 바꾸는 과정은 한 번 더 연습하고 싶어요.",
  "demo-mu": "서로 풀이를 비교하니 어디에서 틀렸는지 찾기 쉬웠어요.",
} as const;

const FEEDBACKS = {
  "demo-hong":
    "설명하는 과정에서 순환마디의 핵심을 정확히 짚었어요. 다음에는 풀이 순서를 짧은 문장으로 정리해 보세요.",
  "demo-kim":
    "활동 전 어려웠던 두 문항을 모두 해결한 점이 돋보여요. 이해한 방법을 스스로 다시 설명해 보면 더 오래 기억할 수 있어요.",
  "demo-go":
    "순환마디 찾기는 확실히 성장했어요. 분수로 나타내는 과정은 예제 한 문제를 단계별로 다시 풀어 보세요.",
  "demo-mu":
    "친구와 풀이를 비교하며 1번 문제를 해결했어요. 2번의 순환마디 표시를 한 번 더 확인해 보세요.",
} as const;

function demoStudentId(persona: DemoPersonaId) {
  const index = Number(persona.split("-")[1] ?? 1) - 1;
  return DEMO_STUDENTS[index] ?? DEMO_STUDENTS[0];
}

export function getDemoProfile(persona: DemoPersonaId): AccountProfile {
  if (persona === "teacher") {
    return {
      role: "admin",
      displayName: "정태형",
      grade: null,
      classNumber: null,
      studentNumber: null,
      subject: "수학",
      subjects: ["수학"],
      databaseSynced: false,
      syncWarning: "데모 화면은 실제 데이터베이스에 저장되지 않습니다.",
    };
  }

  const student = demoStudentId(persona);
  return {
    role: "student",
    displayName: student.name,
    grade: 2,
    classNumber: 1,
    studentNumber: student.number,
    subject: "수학",
    subjects: ["수학"],
    databaseSynced: false,
    syncWarning: "데모 화면은 실제 데이터베이스에 저장되지 않습니다.",
  };
}

export const DEMO_TEACHER_DASHBOARD: TeacherDashboardDemoData = {
  lessons: [
    {
      id: DEMO_LESSON_ID,
      grade: 2,
      class_number: 1,
      learning_date: DEMO_DATE,
      learning_time: "09:00",
      subject: "수학",
      question_count: 3,
      questions: DEMO_QUESTIONS,
    },
  ],
  students: DEMO_STUDENTS.map((student) => ({
    user_id: student.id,
    display_name: student.name,
    grade: 2,
    class_number: 1,
    student_number: student.number,
  })),
  responses: DEMO_STUDENTS.map((student) => ({
    lesson_id: DEMO_LESSON_ID,
    student_user_id: student.id,
    answers: { ...BEFORE[student.id] },
    completed_at: `${DEMO_DATE}T09:05:00.000Z`,
  })),
  pairings: [
    {
      lesson_id: DEMO_LESSON_ID,
      student_user_id: "demo-hong",
      partner_user_id: "demo-kim",
      partner_name: "김철수",
      partner_student_number: 2,
      score: 3,
      helps_with: [1, 3],
      partner_helps_with: [2],
    },
    {
      lesson_id: DEMO_LESSON_ID,
      student_user_id: "demo-go",
      partner_user_id: "demo-mu",
      partner_name: "무궁화",
      partner_student_number: 4,
      score: 2,
      helps_with: [3],
      partner_helps_with: [1],
    },
  ],
  postActivityResponses: DEMO_STUDENTS.map((student) => ({
    lesson_id: DEMO_LESSON_ID,
    student_user_id: student.id,
    answers: { ...AFTER[student.id] },
    reflection: REFLECTIONS[student.id],
    completed_at: `${DEMO_DATE}T10:00:00.000Z`,
  })),
  feedbacks: DEMO_STUDENTS.map((student) => ({
    lesson_id: DEMO_LESSON_ID,
    student_user_id: student.id,
    feedback: FEEDBACKS[student.id],
    source: "gemini",
    updated_at: `${DEMO_DATE}T10:10:00.000Z`,
  })),
};

export function getDemoStudentLessons(
  persona: Exclude<DemoPersonaId, "teacher">,
): StudentProgressLesson[] {
  const student = demoStudentId(persona);
  return [
    {
      id: DEMO_LESSON_ID,
      learning_date: DEMO_DATE,
      learning_time: "09:00",
      subject: "수학",
      question_count: 3,
      questions: DEMO_QUESTIONS.map(({ number, title }) => ({ number, title })),
      response: {
        answers: { ...BEFORE[student.id] },
        completed_at: `${DEMO_DATE}T09:05:00.000Z`,
      },
      post_activity_response: {
        answers: { ...AFTER[student.id] },
        reflection: REFLECTIONS[student.id],
        completed_at: `${DEMO_DATE}T10:00:00.000Z`,
      },
      feedback: {
        feedback: FEEDBACKS[student.id],
        source: "gemini",
        updated_at: `${DEMO_DATE}T10:10:00.000Z`,
      },
    },
  ];
}
