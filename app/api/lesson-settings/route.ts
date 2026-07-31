import { auth } from "@/utils/auth/server";
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
  lessonId?: string;
  grade?: number;
  classNumber?: number;
  learningDate?: string;
  learningTime?: string;
  subject?: string;
  questionCount?: number;
  questions?: QuestionInput[];
};

function validateLessonInput(body: LessonInput) {
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
    return null;
  }

  return {
    grade: Number(body.grade),
    class_number: Number(body.classNumber),
    learning_date: body.learningDate,
    learning_time: body.learningTime,
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
  };
}

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

function isDuplicateLessonError(error: { code?: string; message: string }) {
  return (
    error.code === "23505" ||
    error.message.includes("lesson_settings_unique_schedule_idx")
  );
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
  const lessonInput = validateLessonInput(body);
  if (!lessonInput) {
    return NextResponse.json(
      { error: "학급, 일정, 문항 정보를 빠짐없이 입력해 주세요." },
      { status: 400 },
    );
  }

  const { data: existingLesson, error: existingLessonError } =
    await teacher.supabase
      .from("lesson_settings")
      .select("id")
      .eq("grade", lessonInput.grade)
      .eq("class_number", lessonInput.class_number)
      .eq("learning_date", lessonInput.learning_date)
      .eq("learning_time", lessonInput.learning_time)
      .eq("subject", teacher.subject)
      .limit(1)
      .maybeSingle();

  if (existingLessonError) {
    return NextResponse.json(
      { error: readableSupabaseError(existingLessonError.message) },
      { status: 500 },
    );
  }
  if (existingLesson) {
    return NextResponse.json(
      {
        error:
          "같은 과목·학급·날짜·교시에 이미 수업이 있습니다. 지난 수업 관리에서 기존 수업을 수정해 주세요.",
      },
      { status: 409 },
    );
  }

  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .insert({
      teacher_user_id: teacher.userId,
      ...lessonInput,
      subject: teacher.subject,
      updated_at: new Date().toISOString(),
    })
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .single();

  if (error) {
    if (isDuplicateLessonError(error)) {
      return NextResponse.json(
        {
          error:
            "같은 과목·학급·날짜·교시에 이미 수업이 있습니다. 기존 수업을 수정해 주세요.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }

  return NextResponse.json({ lesson: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const body = (await request.json()) as LessonInput;
  const lessonInput = validateLessonInput(body);
  if (!body.lessonId || !lessonInput) {
    return NextResponse.json(
      { error: "수정할 수업과 학급, 일정, 문항 정보를 확인해 주세요." },
      { status: 400 },
    );
  }

  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .update({
      ...lessonInput,
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.lessonId)
    .eq("subject", teacher.subject)
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count, questions, created_at",
    )
    .maybeSingle();

  if (error) {
    if (isDuplicateLessonError(error)) {
      return NextResponse.json(
        {
          error:
            "변경한 과목·학급·날짜·교시에 이미 다른 수업이 있습니다.",
        },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "현재 과목에서 수정할 수업을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ lesson: data });
}

export async function DELETE(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const lessonId = new URL(request.url).searchParams.get("lessonId")?.trim();
  if (!lessonId) {
    return NextResponse.json(
      { error: "삭제할 수업을 선택해 주세요." },
      { status: 400 },
    );
  }

  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .delete()
    .eq("id", lessonId)
    .eq("subject", teacher.subject)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "현재 과목에서 삭제할 수업을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ deletedLessonId: data.id });
}
