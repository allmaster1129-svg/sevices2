import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type LessonQuestion = {
  number: number;
  title: string;
  content: string;
};

type AnswerStatus = "solved" | "unsolved";

type SaveActivityResultInput = {
  lessonId?: string;
  answers?: Record<string, AnswerStatus>;
  reflection?: string;
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

  if (error) return { error: error.message, status: 500 } as const;
  if (
    profile?.role !== "student" ||
    !profile.grade ||
    !profile.class_number
  ) {
    return {
      error: "학년과 반이 등록된 학생 계정만 결과를 저장할 수 있습니다.",
      status: 403,
    } as const;
  }

  return { userId, profile, supabase } as const;
}

export async function POST(request: Request) {
  const student = await requireStudent();
  if ("error" in student) {
    return NextResponse.json(
      { error: student.error },
      { status: student.status },
    );
  }

  const body = (await request.json()) as SaveActivityResultInput;
  const reflection = body.reflection?.trim() ?? "";
  if (!body.lessonId || !body.answers || reflection.length > 1000) {
    return NextResponse.json(
      { error: "수업, 문항 결과, 활동 소감을 확인해 주세요." },
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

  const { data: pairing, error: pairingError } = await student.supabase
    .from("lesson_pairings")
    .select("lesson_id")
    .eq("lesson_id", lesson.id)
    .eq("student_user_id", student.userId)
    .maybeSingle();

  if (pairingError) {
    return NextResponse.json({ error: pairingError.message }, { status: 500 });
  }
  if (!pairing) {
    return NextResponse.json(
      { error: "교사가 배움짝을 매칭한 뒤 활동 결과를 입력할 수 있습니다." },
      { status: 403 },
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
      { error: "모든 문항의 활동 후 결과를 선택해 주세요." },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await student.supabase
    .from("lesson_post_activity_responses")
    .upsert(
      {
        lesson_id: lesson.id,
        student_user_id: student.userId,
        answers: body.answers,
        reflection,
        completed_at: now,
        updated_at: now,
      },
      { onConflict: "lesson_id,student_user_id" },
    )
    .select("lesson_id, answers, reflection, completed_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ postActivityResponse: data });
}
