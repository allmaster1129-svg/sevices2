import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type QuestionInput = {
  number?: number;
  title?: string;
  content?: string;
  imageUrl?: string;
  imagePath?: string;
  imageAlt?: string;
};

type LessonInput = {
  grade?: number;
  classNumber?: number;
  learningDate?: string;
  learningTime?: string;
  subject?: string;
  questionCount?: number;
  questions?: QuestionInput[];
};

function readableSupabaseError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("no suitable key") ||
    normalized.includes("wrong key type") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwk")
  ) {
    return "Supabase 인증 연결이 아직 완료되지 않았습니다. Supabase Third-Party Auth에 Clerk를 등록하거나 서버에 SUPABASE_SECRET_KEY를 설정해 주세요.";
  }
  return message;
}

async function requireTeacher() {
  const { userId } = await auth();
  if (!userId) return { error: "인증이 필요합니다.", status: 401 } as const;

  const supabase = await createClient();
  const { data, error } = await supabase
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
  if (data?.role !== "admin") {
    return { error: "교사 계정만 수업을 설정할 수 있습니다.", status: 403 } as const;
  }

  return { userId, supabase, subject: data.subject?.trim() || "수학" } as const;
}

export async function GET() {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .eq("teacher_user_id", teacher.userId)
    .eq("subject", teacher.subject)
    .order("learning_date", { ascending: false })
    .order("learning_time", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }

  return NextResponse.json({ lessons: data ?? [] });
}

export async function POST(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const body = (await request.json()) as LessonInput;
  const questions = body.questions ?? [];
  const questionCount = Number(body.questionCount);
  const validQuestions =
    questions.length === questionCount &&
    questions.every(
      (question, index) =>
        question.number === index + 1 &&
        Boolean(question.title?.trim()) &&
        Boolean(question.content?.trim()),
    );

  if (
    !Number.isInteger(body.grade) ||
    Number(body.grade) < 1 ||
    Number(body.grade) > 3 ||
    !Number.isInteger(body.classNumber) ||
    Number(body.classNumber) < 1 ||
    Number(body.classNumber) > 50 ||
    !body.learningDate ||
    !body.learningTime ||
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 50 ||
    !validQuestions
  ) {
    return NextResponse.json(
      { error: "학급, 일정, 문항 정보를 빠짐없이 입력해 주세요." },
      { status: 400 },
    );
  }

  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .insert({
      teacher_user_id: teacher.userId,
      grade: Number(body.grade),
      class_number: Number(body.classNumber),
      learning_date: body.learningDate,
      learning_time: body.learningTime,
      subject: teacher.subject,
      question_count: questionCount,
      questions: questions.map((question, index) => ({
        number: index + 1,
        title: question.title!.trim(),
        content: question.content!.trim(),
        image_url: question.imageUrl?.trim() || null,
        image_path: question.imagePath?.trim() || null,
        image_alt:
          question.imageAlt?.trim() || `${index + 1}번 문항 이미지`,
      })),
    })
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .single();

  if (error) {
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }

  return NextResponse.json({ lesson: data }, { status: 201 });
}
