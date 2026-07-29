import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type LessonQuestion = {
  number: number;
  title: string;
  content: string;
};

type AnswerStatus = "solved" | "unsolved";

type SaveResponseInput = {
  lessonId?: string;
  answers?: Record<string, AnswerStatus>;
};

async function requireStudent() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "로그인이 필요합니다.", status: 401 } as const;
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, grade, class_number")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 } as const;
  }
  if (
    profile?.role !== "student" ||
    !profile.grade ||
    !profile.class_number
  ) {
    return {
      error: "학년과 반이 등록된 학생 계정만 수업을 확인할 수 있습니다.",
      status: 403,
    } as const;
  }

  return { userId, profile, supabase } as const;
}

export async function GET() {
  const student = await requireStudent();
  if ("error" in student) {
    return NextResponse.json(
      { error: student.error },
      { status: student.status },
    );
  }

  const { data: lessons, error: lessonError } = await student.supabase
    .from("lesson_settings")
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .eq("grade", student.profile.grade)
    .eq("class_number", student.profile.class_number)
    .order("learning_date", { ascending: false })
    .order("learning_time", { ascending: false });

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }

  const lessonIds = (lessons ?? []).map((lesson) => lesson.id);
  let responseRows: Array<{
    lesson_id: string;
    answers: Record<string, AnswerStatus>;
    completed_at: string | null;
    updated_at: string;
  }> = [];
  let pairingRows: Array<{
    lesson_id: string;
    partner_user_id: string;
    partner_name: string;
    partner_student_number: number | null;
    score: number;
    helps_with: number[];
    partner_helps_with: number[];
    generated_at: string;
  }> = [];
  let postActivityRows: Array<{
    lesson_id: string;
    answers: Record<string, AnswerStatus>;
    reflection: string;
    completed_at: string | null;
    updated_at: string;
  }> = [];

  if (lessonIds.length) {
    const [
      { data: responseData, error: responseError },
      { data: pairingData, error: pairingError },
      { data: postActivityData, error: postActivityError },
    ] = await Promise.all([
      student.supabase
        .from("lesson_question_responses")
        .select("lesson_id, answers, completed_at, updated_at")
        .eq("student_user_id", student.userId)
        .in("lesson_id", lessonIds),
      student.supabase
        .from("lesson_pairings")
        .select(
          "lesson_id, partner_user_id, partner_name, partner_student_number, score, helps_with, partner_helps_with, generated_at",
        )
        .eq("student_user_id", student.userId)
        .in("lesson_id", lessonIds),
      student.supabase
        .from("lesson_post_activity_responses")
        .select("lesson_id, answers, reflection, completed_at, updated_at")
        .eq("student_user_id", student.userId)
        .in("lesson_id", lessonIds),
    ]);

    if (responseError || pairingError || postActivityError) {
      return NextResponse.json(
        {
          error:
            responseError?.message ??
            pairingError?.message ??
            postActivityError?.message,
        },
        { status: 500 },
      );
    }
    responseRows = responseData ?? [];
    pairingRows = pairingData ?? [];
    postActivityRows = postActivityData ?? [];
  }

  const responseByLesson = new Map(
    responseRows.map((row) => [row.lesson_id, row]),
  );
  const pairingByLesson = new Map(
    pairingRows.map((row) => [row.lesson_id, row]),
  );
  const postActivityByLesson = new Map(
    postActivityRows.map((row) => [row.lesson_id, row]),
  );

  return NextResponse.json({
    lessons: (lessons ?? []).map((lesson) => ({
      ...lesson,
      response: responseByLesson.get(lesson.id) ?? null,
      pairing: pairingByLesson.get(lesson.id) ?? null,
      post_activity_response:
        postActivityByLesson.get(lesson.id) ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const student = await requireStudent();
  if ("error" in student) {
    return NextResponse.json(
      { error: student.error },
      { status: student.status },
    );
  }

  const body = (await request.json()) as SaveResponseInput;
  if (!body.lessonId || !body.answers) {
    return NextResponse.json(
      { error: "수업과 문항별 풀이 여부를 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const { data: lesson, error: lessonError } = await student.supabase
    .from("lesson_settings")
    .select("id, grade, class_number, question_count, questions")
    .eq("id", body.lessonId)
    .eq("grade", student.profile.grade)
    .eq("class_number", student.profile.class_number)
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }
  if (!lesson) {
    return NextResponse.json(
      { error: "학생의 학년·반과 일치하는 수업을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const questions = Array.isArray(lesson.questions)
    ? (lesson.questions as LessonQuestion[])
    : [];
  const expectedNumbers = questions.map((question) => String(question.number));
  const answerKeys = Object.keys(body.answers);
  const validAnswers =
    expectedNumbers.length === lesson.question_count &&
    answerKeys.length === expectedNumbers.length &&
    expectedNumbers.every(
      (number) =>
        body.answers?.[number] === "solved" ||
        body.answers?.[number] === "unsolved",
    );

  if (!validAnswers) {
    return NextResponse.json(
      { error: "모든 문항의 풀이 여부를 선택해 주세요." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await student.supabase
    .from("lesson_question_responses")
    .upsert(
      {
        lesson_id: lesson.id,
        student_user_id: student.userId,
        answers: body.answers,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "lesson_id,student_user_id" },
    )
    .select("lesson_id, answers, completed_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ response: data });
}
