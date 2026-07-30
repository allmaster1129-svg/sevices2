import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { normalizeSubjects } from "@/app/subjects";
import { createClient } from "@/utils/supabase/server";

type AnswerStatus = "solved" | "unsolved";

type FeedbackInput = {
  action?: "generate" | "save";
  lessonId?: string;
  studentUserId?: string;
  feedback?: string;
  source?: "manual" | "gemini";
};

type LessonQuestion = {
  number: number;
  title: string;
};

type GeminiResponseData = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string; status?: string };
};

const TRANSIENT_GEMINI_STATUSES = new Set([429, 500, 502, 503, 504]);

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGemini({
  apiKey,
  model,
  prompt,
}: {
  apiKey: string;
  model: string;
  prompt: string;
}) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 320,
        },
      }),
    },
  );
  const data = (await response.json()) as GeminiResponseData;
  return { response, data };
}

async function requireFeedbackContext(
  lessonId: string,
  studentUserId: string,
) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "로그인이 필요합니다.", status: 401 } as const;
  }

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (teacherError) {
    return { error: teacherError.message, status: 500 } as const;
  }
  if (teacher?.role !== "admin") {
    return {
      error: "교사 계정만 피드백을 작성할 수 있습니다.",
      status: 403,
    } as const;
  }

  const [
    { data: lesson, error: lessonError },
    { data: student, error: studentError },
  ] = await Promise.all([
    supabase
      .from("lesson_settings")
      .select("id, teacher_user_id, grade, class_number, subject, questions")
      .eq("id", lessonId)
      .eq("teacher_user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("user_id, display_name, grade, class_number, subject, subjects")
      .eq("user_id", studentUserId)
      .eq("role", "student")
      .maybeSingle(),
  ]);

  if (lessonError || studentError) {
    return {
      error: lessonError?.message ?? studentError?.message ?? "",
      status: 500,
    } as const;
  }

  const studentSubjects = normalizeSubjects(student?.subjects);
  if (
    !lesson ||
    !student ||
    student.grade !== lesson.grade ||
    student.class_number !== lesson.class_number ||
    !(
      studentSubjects.includes(lesson.subject) ||
      (!studentSubjects.length && student.subject === lesson.subject)
    )
  ) {
    return {
      error: "선택한 수업의 학생 정보를 확인할 수 없습니다.",
      status: 404,
    } as const;
  }

  return { userId, supabase, lesson, student } as const;
}

export async function POST(request: Request) {
  const body = (await request.json()) as FeedbackInput;
  if (!body.lessonId || !body.studentUserId || !body.action) {
    return NextResponse.json(
      { error: "수업, 학생, 피드백 작업을 확인해 주세요." },
      { status: 400 },
    );
  }

  const context = await requireFeedbackContext(
    body.lessonId,
    body.studentUserId,
  );
  if ("error" in context) {
    return NextResponse.json(
      { error: context.error },
      { status: context.status },
    );
  }

  if (body.action === "save") {
    const feedback = body.feedback?.trim() ?? "";
    if (!feedback || feedback.length > 2000) {
      return NextResponse.json(
        { error: "피드백을 1자 이상 2,000자 이하로 입력해 주세요." },
        { status: 400 },
      );
    }

    const { data, error } = await context.supabase
      .from("lesson_student_feedback")
      .upsert(
        {
          lesson_id: context.lesson.id,
          student_user_id: context.student.user_id,
          teacher_user_id: context.userId,
          feedback,
          source: body.source === "gemini" ? "gemini" : "manual",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "lesson_id,student_user_id" },
      )
      .select(
        "lesson_id, student_user_id, feedback, source, created_at, updated_at",
      )
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ feedback: data });
  }

  const client = await clerkClient();
  const clerkUser = await client.users.getUser(context.userId);
  const storedApiKey = clerkUser.privateMetadata.geminiApiKey;
  const apiKey =
    typeof storedApiKey === "string" ? storedApiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "교사 설정에서 본인의 Gemini API 키를 먼저 등록해 주세요.",
      },
      { status: 503 },
    );
  }

  const [
    { data: before, error: beforeError },
    { data: after, error: afterError },
  ] = await Promise.all([
    context.supabase
      .from("lesson_question_responses")
      .select("answers")
      .eq("lesson_id", context.lesson.id)
      .eq("student_user_id", context.student.user_id)
      .maybeSingle(),
    context.supabase
      .from("lesson_post_activity_responses")
      .select("answers, reflection")
      .eq("lesson_id", context.lesson.id)
      .eq("student_user_id", context.student.user_id)
      .maybeSingle(),
  ]);

  if (beforeError || afterError) {
    return NextResponse.json(
      { error: beforeError?.message ?? afterError?.message },
      { status: 500 },
    );
  }

  const beforeAnswers = (before?.answers ?? {}) as Record<
    string,
    AnswerStatus
  >;
  const afterAnswers = (after?.answers ?? {}) as Record<string, AnswerStatus>;
  const questions = Array.isArray(context.lesson.questions)
    ? (context.lesson.questions as LessonQuestion[])
    : [];
  const questionSummary = questions
    .map((question) => {
      const key = String(question.number);
      const beforeStatus =
        beforeAnswers[key] === "solved" ? "해결" : "미해결";
      const effectiveAfter =
        beforeAnswers[key] === "solved" || afterAnswers[key] === "solved"
          ? "해결"
          : afterAnswers[key] === "unsolved"
            ? "미해결"
            : "활동 후 미입력";
      return `${question.number}번 ${question.title}: 활동 전 ${beforeStatus}, 활동 후 ${effectiveAfter}`;
    })
    .join("\n");

  const prompt = [
    `당신은 중학교 ${context.lesson.subject} 교사입니다.`,
    `${context.student.display_name} 학생에게 전달할 개별 학습 피드백을 한국어로 작성하세요.`,
    "학생의 성장한 점을 먼저 구체적으로 칭찬하고, 아직 미해결인 문항이 있다면 다음 학습 행동을 한 가지 제안하세요.",
    after?.reflection
      ? "학생의 배움짝 활동 소감에 드러난 느낌, 이해의 변화 또는 어려움을 반드시 참고하여 피드백에 자연스럽게 반영하세요. 소감을 그대로 반복하지 말고 학생의 표현에 응답하는 방식으로 작성하세요."
      : "학생의 활동 소감이 없으므로 문항별 활동 전후 변화만 근거로 피드백을 작성하세요.",
    "비교하거나 낙인찍는 표현은 피하고 따뜻하고 간결한 3~5문장으로 작성하세요.",
    "피드백 본문만 출력하세요.",
    "",
    questionSummary,
    after?.reflection ? `학생 소감: ${after.reflection}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const primaryModel =
    process.env.GEMINI_FAST_MODEL?.trim() || "gemini-3.5-flash-lite";
  const fallbackModel =
    process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  const models = Array.from(
    new Set([primaryModel, fallbackModel]),
  );
  let lastStatus = 502;
  let lastMessage = "";

  for (const [modelIndex, model] of models.entries()) {
    const delays = modelIndex === 0 ? [0, 500] : [0];

    for (const delay of delays) {
      if (delay) {
        await wait(delay);
      }

      try {
        const { response, data } = await requestGemini({
          apiKey,
          model,
          prompt,
        });
        lastStatus = response.status;
        lastMessage = data.error?.message ?? "";

        if (response.ok) {
          const generated = data.candidates?.[0]?.content?.parts
            ?.map((part) => part.text ?? "")
            .join("")
            .trim();
          if (generated) {
            return NextResponse.json({
              generated,
              model,
              fallbackUsed: modelIndex > 0,
            });
          }
          lastMessage = "Gemini가 피드백 문장을 반환하지 않았습니다.";
          break;
        }

        if (!TRANSIENT_GEMINI_STATUSES.has(response.status)) {
          const userMessage =
            response.status === 400 || response.status === 403
              ? "Gemini API 키가 유효한지 Google AI Studio에서 확인해 주세요."
              : lastMessage || "Gemini 피드백을 생성하지 못했습니다.";
          return NextResponse.json(
            { error: userMessage },
            { status: response.status },
          );
        }
      } catch (reason) {
        lastStatus = 502;
        lastMessage =
          reason instanceof Error
            ? reason.message
            : "Gemini 서버에 연결하지 못했습니다.";
      }
    }
  }

  const error =
    lastStatus === 429
      ? "Gemini API 사용 한도에 도달했습니다. 잠시 후 다시 시도하거나 Google AI Studio의 사용량을 확인해 주세요."
      : lastStatus >= 500
        ? "Gemini 서버 사용량이 많아 자동 재시도와 대체 모델 전환을 했지만 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요."
        : lastMessage || "Gemini 피드백을 생성하지 못했습니다.";

  return NextResponse.json({ error }, { status: 502 });
}
