import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type AnswerStatus = "solved" | "unsolved";

type MatchRequest = {
  lessonId?: string;
};

type StudentProfile = {
  user_id: string;
  display_name: string;
  student_number: number | null;
};

type StudentWithAnswers = StudentProfile & {
  answers: Record<string, AnswerStatus>;
};

type MatchCandidate = {
  first: StudentWithAnswers;
  second: StudentWithAnswers;
  firstHelpsSecond: number[];
  secondHelpsFirst: number[];
  score: number;
  randomOrder: number;
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
    return { error: "교사 계정만 짝을 매칭할 수 있습니다.", status: 403 } as const;
  }

  return {
    userId,
    supabase,
    subject: profile.subject?.trim() || "수학",
  } as const;
}

function overlap(
  helperAnswers: Record<string, AnswerStatus>,
  learnerAnswers: Record<string, AnswerStatus>,
) {
  return Object.keys(helperAnswers)
    .filter(
      (questionNumber) =>
        helperAnswers[questionNumber] === "solved" &&
        learnerAnswers[questionNumber] === "unsolved",
    )
    .map(Number)
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
}

export async function POST(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const body = (await request.json()) as MatchRequest;
  if (!body.lessonId) {
    return NextResponse.json(
      { error: "매칭할 수업을 선택해 주세요." },
      { status: 400 },
    );
  }

  const { data: lesson, error: lessonError } = await teacher.supabase
    .from("lesson_settings")
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count",
    )
    .eq("id", body.lessonId)
    .eq("teacher_user_id", teacher.userId)
    .eq("subject", teacher.subject)
    .maybeSingle();

  if (lessonError) {
    return NextResponse.json(
      { error: readableSupabaseError(lessonError.message) },
      { status: 500 },
    );
  }
  if (!lesson) {
    return NextResponse.json(
      { error: "담당 수업을 찾지 못했습니다." },
      { status: 404 },
    );
  }

  const [{ data: profileRows, error: profileError }, { data: responseRows, error: responseError }] =
    await Promise.all([
      teacher.supabase
        .from("profiles")
        .select("user_id, display_name, student_number")
        .eq("role", "student")
        .eq("grade", lesson.grade)
        .eq("class_number", lesson.class_number)
        .order("student_number"),
      teacher.supabase
        .from("lesson_question_responses")
        .select("student_user_id, answers")
        .eq("lesson_id", lesson.id),
    ]);

  if (profileError || responseError) {
    const message = profileError?.message ?? responseError?.message ?? "";
    return NextResponse.json(
      { error: readableSupabaseError(message) },
      { status: 500 },
    );
  }

  const profiles = (profileRows ?? []) as StudentProfile[];
  const profileById = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const students: StudentWithAnswers[] = (responseRows ?? [])
    .map((response) => {
      const profile = profileById.get(response.student_user_id);
      if (!profile) return null;
      return {
        ...profile,
        answers: (response.answers ?? {}) as Record<string, AnswerStatus>,
      };
    })
    .filter((student): student is StudentWithAnswers => Boolean(student));

  const candidates: MatchCandidate[] = [];
  for (let firstIndex = 0; firstIndex < students.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < students.length;
      secondIndex += 1
    ) {
      const first = students[firstIndex];
      const second = students[secondIndex];
      const firstHelpsSecond = overlap(first.answers, second.answers);
      const secondHelpsFirst = overlap(second.answers, first.answers);
      candidates.push({
        first,
        second,
        firstHelpsSecond,
        secondHelpsFirst,
        score: firstHelpsSecond.length + secondHelpsFirst.length,
        randomOrder: Math.random(),
      });
    }
  }

  candidates.sort(
    (left, right) =>
      right.score - left.score || left.randomOrder - right.randomOrder,
  );

  const assigned = new Set<string>();
  const pairs = candidates
    .filter((candidate) => {
      if (
        assigned.has(candidate.first.user_id) ||
        assigned.has(candidate.second.user_id)
      ) {
        return false;
      }
      assigned.add(candidate.first.user_id);
      assigned.add(candidate.second.user_id);
      return true;
    })
    .map((candidate, index) => ({
      id: `${lesson.id}-${index + 1}`,
      score: candidate.score,
      first: {
        userId: candidate.first.user_id,
        name: candidate.first.display_name,
        studentNumber: candidate.first.student_number,
        helpsWith: candidate.firstHelpsSecond,
      },
      second: {
        userId: candidate.second.user_id,
        name: candidate.second.display_name,
        studentNumber: candidate.second.student_number,
        helpsWith: candidate.secondHelpsFirst,
      },
    }));

  const unmatched = students
    .filter((student) => !assigned.has(student.user_id))
    .map((student) => ({
      userId: student.user_id,
      name: student.display_name,
      studentNumber: student.student_number,
    }));

  const { error: deleteError } = await teacher.supabase
    .from("lesson_pairings")
    .delete()
    .eq("lesson_id", lesson.id);

  if (deleteError) {
    return NextResponse.json(
      { error: readableSupabaseError(deleteError.message) },
      { status: 500 },
    );
  }

  const pairingRows = pairs.flatMap((pair) => [
    {
      lesson_id: lesson.id,
      student_user_id: pair.first.userId,
      partner_user_id: pair.second.userId,
      partner_name: pair.second.name,
      partner_student_number: pair.second.studentNumber,
      score: pair.score,
      helps_with: pair.first.helpsWith,
      partner_helps_with: pair.second.helpsWith,
    },
    {
      lesson_id: lesson.id,
      student_user_id: pair.second.userId,
      partner_user_id: pair.first.userId,
      partner_name: pair.first.name,
      partner_student_number: pair.first.studentNumber,
      score: pair.score,
      helps_with: pair.second.helpsWith,
      partner_helps_with: pair.first.helpsWith,
    },
  ]);

  if (pairingRows.length) {
    const { error: pairingError } = await teacher.supabase
      .from("lesson_pairings")
      .insert(pairingRows);

    if (pairingError) {
      return NextResponse.json(
        { error: readableSupabaseError(pairingError.message) },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    lesson,
    pairs,
    unmatched,
    totalClassStudents: profiles.length,
    respondedStudents: students.length,
    excludedStudents: profiles.length - students.length,
  });
}
