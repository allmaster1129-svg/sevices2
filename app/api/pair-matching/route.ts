import { auth } from "@/utils/auth/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { normalizeSubjects } from "@/app/subjects";

type AnswerStatus = "solved" | "unsolved";

type MatchRequest = {
  lessonId?: string;
  mode?: "recommended" | "random";
};

type StudentProfile = {
  user_id: string;
  display_name: string;
  student_number: number | null;
  subject: string | null;
  subjects: string[] | null;
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

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export async function GET(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const lessonId = new URL(request.url).searchParams.get("lessonId");
  if (!lessonId) {
    return NextResponse.json(
      { error: "확인할 수업을 선택해 주세요." },
      { status: 400 },
    );
  }

  const { data: lesson, error: lessonError } = await teacher.supabase
    .from("lesson_settings")
    .select(
      "id, grade, class_number, learning_date, learning_time, subject, question_count",
    )
    .eq("id", lessonId)
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

  const [
    { data: profileRows, error: profileError },
    { data: responseRows, error: responseError },
    { data: pairingRows, error: pairingError },
  ] = await Promise.all([
    teacher.supabase
      .from("profiles")
      .select("user_id, display_name, student_number, subject, subjects")
      .eq("role", "student")
      .eq("grade", lesson.grade)
      .eq("class_number", lesson.class_number)
      .order("student_number"),
    teacher.supabase
      .from("lesson_question_responses")
      .select("student_user_id, answers")
      .eq("lesson_id", lesson.id),
    teacher.supabase
      .from("lesson_pairings")
      .select(
        "student_user_id, partner_user_id, partner_name, partner_student_number, score, helps_with, partner_helps_with, generated_at",
      )
      .eq("lesson_id", lesson.id)
      .order("generated_at"),
  ]);

  if (profileError || responseError || pairingError) {
    const message =
      profileError?.message ??
      responseError?.message ??
      pairingError?.message ??
      "";
    return NextResponse.json(
      { error: readableSupabaseError(message) },
      { status: 500 },
    );
  }

  const profiles = ((profileRows ?? []) as StudentProfile[]).filter(
    (profile) =>
      normalizeSubjects(profile.subjects).includes(teacher.subject) ||
      (!normalizeSubjects(profile.subjects).length &&
        profile.subject === teacher.subject),
  );
  const profileById = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const respondedIds = new Set(
    (responseRows ?? []).map((response) => response.student_user_id),
  );
  const assignedIds = new Set<string>();
  const seenPairs = new Set<string>();
  const pairs = (pairingRows ?? []).flatMap((pairing, index) => {
    const key = [pairing.student_user_id, pairing.partner_user_id]
      .sort()
      .join("|");
    if (seenPairs.has(key)) return [];
    seenPairs.add(key);
    assignedIds.add(pairing.student_user_id);
    assignedIds.add(pairing.partner_user_id);
    const first = profileById.get(pairing.student_user_id);
    const second = profileById.get(pairing.partner_user_id);

    return [
      {
        id: `${lesson.id}-saved-${index + 1}`,
        score: pairing.score ?? 0,
        first: {
          userId: pairing.student_user_id,
          name: first?.display_name ?? "학생",
          studentNumber: first?.student_number ?? null,
          helpsWith: (pairing.helps_with ?? []) as number[],
        },
        second: {
          userId: pairing.partner_user_id,
          name: second?.display_name ?? pairing.partner_name ?? "학생",
          studentNumber:
            second?.student_number ?? pairing.partner_student_number ?? null,
          helpsWith: (pairing.partner_helps_with ?? []) as number[],
        },
      },
    ];
  });

  if (!pairs.length) {
    return NextResponse.json({ result: null });
  }

  const unmatched = profiles
    .filter(
      (profile) =>
        respondedIds.has(profile.user_id) && !assignedIds.has(profile.user_id),
    )
    .map((profile) => ({
      userId: profile.user_id,
      name: profile.display_name,
      studentNumber: profile.student_number,
    }));

  return NextResponse.json({
    result: {
      lesson,
      pairs,
      unmatched,
      totalClassStudents: profiles.length,
      respondedStudents: respondedIds.size,
      excludedStudents: Math.max(0, profiles.length - respondedIds.size),
      strategy: "saved",
    },
  });
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
  const mode = body.mode === "random" ? "random" : "recommended";
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
        .select("user_id, display_name, student_number, subject, subjects")
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

  const profiles = ((profileRows ?? []) as StudentProfile[]).filter(
    (profile) =>
      normalizeSubjects(profile.subjects).includes(teacher.subject) ||
      (!normalizeSubjects(profile.subjects).length &&
        profile.subject === teacher.subject),
  );
  const profileById = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );
  const responseById = new Map(
    (responseRows ?? []).map((response) => [
      response.student_user_id,
      (response.answers ?? {}) as Record<string, AnswerStatus>,
    ]),
  );
  const respondedStudents: StudentWithAnswers[] = (responseRows ?? [])
    .map((response) => {
      const profile = profileById.get(response.student_user_id);
      if (!profile) return null;
      return {
        ...profile,
        answers: (response.answers ?? {}) as Record<string, AnswerStatus>,
      };
    })
    .filter((student): student is StudentWithAnswers => Boolean(student));
  const students: StudentWithAnswers[] =
    mode === "random"
      ? profiles.map((profile) => ({
          ...profile,
          answers: responseById.get(profile.user_id) ?? {},
        }))
      : respondedStudents;

  const candidates: MatchCandidate[] =
    mode === "random"
      ? shuffled(students).flatMap((first, index, randomizedStudents) => {
            if (index % 2 !== 0 || !randomizedStudents[index + 1]) return [];
            const second = randomizedStudents[index + 1];
            const firstHelpsSecond = overlap(first.answers, second.answers);
            const secondHelpsFirst = overlap(second.answers, first.answers);
            return [
              {
                first,
                second,
                firstHelpsSecond,
                secondHelpsFirst,
                score:
                  firstHelpsSecond.length + secondHelpsFirst.length,
                randomOrder: index,
              },
            ];
          })
      : [];

  if (mode === "recommended") {
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
  }

  if (mode === "recommended") {
    candidates.sort(
      (left, right) =>
        right.score - left.score || left.randomOrder - right.randomOrder,
    );
  }

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

  /*
   * 이후 저장 형식은 추천·임의 매칭에서 동일합니다. 학생 화면은 기존
   * lesson_pairings 구조를 그대로 사용하므로 별도의 DB 변경이 필요 없습니다.
   */

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
    respondedStudents: respondedStudents.length,
    excludedStudents:
      mode === "random" ? 0 : profiles.length - respondedStudents.length,
    strategy: mode,
  });
}
