import { auth } from "@/utils/auth/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { normalizeSubjects } from "@/app/subjects";

function readableSupabaseError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("no suitable key") ||
    normalized.includes("wrong key type") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwk")
  ) {
    return "Supabase 데이터 연결이 완료되지 않았습니다. 서버의 SUPABASE_SECRET_KEY 또는 RLS 정책을 확인해 주세요.";
  }
  return message;
}

async function requireTeacher() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "로그인이 필요합니다.", status: 401 } as const;
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, subject")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return {
      error: readableSupabaseError(error.message),
      status: 503,
    } as const;
  }
  if (profile?.role !== "admin") {
    return {
      error: "교사 계정만 학급 명단과 응답을 확인할 수 있습니다.",
      status: 403,
    } as const;
  }

  return {
    userId,
    supabase,
    subject: profile.subject?.trim() || "수학",
  } as const;
}

export async function GET() {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const { data: lessons, error: lessonError } = await teacher.supabase
    .from("lesson_settings")
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .eq("subject", teacher.subject)
    .order("learning_date", { ascending: false })
    .order("learning_time", { ascending: false });

  if (lessonError) {
    return NextResponse.json(
      { error: readableSupabaseError(lessonError.message) },
      { status: 500 },
    );
  }

  const lessonRows = lessons ?? [];
  if (!lessonRows.length) {
    return NextResponse.json({
      lessons: [],
      students: [],
      responses: [],
      pairings: [],
      postActivityResponses: [],
      feedbacks: [],
    });
  }

  const classKeys = new Set(
    lessonRows.map(
      (lesson) => `${lesson.grade}-${lesson.class_number}`,
    ),
  );

  const [
    { data: profiles, error: profileError },
    { data: responses, error: responseError },
    { data: pairings, error: pairingError },
    { data: postActivityResponses, error: postActivityError },
    { data: feedbacks, error: feedbackError },
  ] = await Promise.all([
      teacher.supabase
        .from("profiles")
        .select(
          "user_id, display_name, grade, class_number, student_number, subject, subjects, created_at",
        )
        .eq("role", "student")
        .order("grade")
        .order("class_number")
        .order("student_number"),
      teacher.supabase
        .from("lesson_question_responses")
        .select(
          "lesson_id, student_user_id, answers, completed_at, updated_at",
        )
        .in(
          "lesson_id",
          lessonRows.map((lesson) => lesson.id),
        ),
      teacher.supabase
        .from("lesson_pairings")
        .select(
          "lesson_id, student_user_id, partner_user_id, partner_name, partner_student_number, score, helps_with, partner_helps_with, generated_at",
        )
        .in(
          "lesson_id",
          lessonRows.map((lesson) => lesson.id),
        ),
      teacher.supabase
        .from("lesson_post_activity_responses")
        .select(
          "lesson_id, student_user_id, answers, reflection, completed_at, updated_at",
        )
        .in(
          "lesson_id",
          lessonRows.map((lesson) => lesson.id),
        ),
      teacher.supabase
        .from("lesson_student_feedback")
        .select(
          "lesson_id, student_user_id, feedback, source, created_at, updated_at",
        )
        .in(
          "lesson_id",
          lessonRows.map((lesson) => lesson.id),
        ),
    ]);

  if (
    profileError ||
    responseError ||
    pairingError ||
    postActivityError ||
    feedbackError
  ) {
    const message =
      profileError?.message ??
      responseError?.message ??
      pairingError?.message ??
      postActivityError?.message ??
      feedbackError?.message ??
      "";
    return NextResponse.json(
      { error: readableSupabaseError(message) },
      { status: 500 },
    );
  }

  const students = (profiles ?? []).filter(
    (profile) =>
      profile.grade &&
      profile.class_number &&
      classKeys.has(`${profile.grade}-${profile.class_number}`) &&
      (
        normalizeSubjects(profile.subjects).includes(teacher.subject) ||
        (!normalizeSubjects(profile.subjects).length &&
          profile.subject === teacher.subject)
      ),
  );
  const studentIds = new Set(students.map((student) => student.user_id));

  return NextResponse.json({
    lessons: lessonRows,
    students,
    responses: (responses ?? []).filter((response) =>
      studentIds.has(response.student_user_id),
    ),
    pairings: (pairings ?? []).filter((pairing) =>
      studentIds.has(pairing.student_user_id),
    ),
    postActivityResponses: (postActivityResponses ?? []).filter((response) =>
      studentIds.has(response.student_user_id),
    ),
    feedbacks: (feedbacks ?? []).filter((feedback) =>
      studentIds.has(feedback.student_user_id),
    ),
  });
}
