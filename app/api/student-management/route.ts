import { auth } from "@/utils/auth/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isTeacherSubject, normalizeSubjects } from "@/app/subjects";

type StudentUpdateInput = {
  userId?: string;
  displayName?: string;
  grade?: number;
  classNumber?: number;
  studentNumber?: number;
  subject?: string;
  subjects?: string[];
};

function validInteger(value: number | undefined, min: number, max: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function readableSupabaseError(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("no suitable key") ||
    normalized.includes("wrong key type") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwk")
  ) {
    return "Supabase 인증 연결을 확인해 주세요.";
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
      error: "교사 계정만 학생 정보를 수정할 수 있습니다.",
      status: 403,
    } as const;
  }

  return {
    userId,
    supabase,
    subject: profile.subject?.trim() || "수학",
  } as const;
}

async function getManagedClasses(
  teacher: Exclude<Awaited<ReturnType<typeof requireTeacher>>, { error: string }>,
) {
  const { data, error } = await teacher.supabase
    .from("lesson_settings")
    .select("grade, class_number")
    .eq("teacher_user_id", teacher.userId)
    .eq("subject", teacher.subject)
    .order("grade")
    .order("class_number");

  if (error) {
    return { error: readableSupabaseError(error.message) } as const;
  }

  const seen = new Set<string>();
  const classes = (data ?? []).filter((item) => {
    const key = `${item.grade}-${item.class_number}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    classes,
    classKeys: new Set(
      classes.map((item) => `${item.grade}-${item.class_number}`),
    ),
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

  const managed = await getManagedClasses(teacher);
  if ("error" in managed) {
    return NextResponse.json({ error: managed.error }, { status: 500 });
  }

  if (!managed.classes.length) {
    return NextResponse.json({ classes: [], students: [] });
  }

  const { data, error } = await teacher.supabase
    .from("profiles")
    .select(
      "user_id, display_name, grade, class_number, student_number, subject, subjects, updated_at",
    )
    .eq("role", "student")
    .order("grade")
    .order("class_number")
    .order("student_number");

  if (error) {
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }

  const students = (data ?? []).filter(
    (student) =>
      student.grade &&
      student.class_number &&
      managed.classKeys.has(`${student.grade}-${student.class_number}`) &&
      (
        normalizeSubjects(student.subjects).includes(teacher.subject) ||
        (!normalizeSubjects(student.subjects).length &&
          student.subject === teacher.subject)
      ),
  );

  return NextResponse.json({ classes: managed.classes, students });
}

export async function PATCH(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const body = (await request.json()) as StudentUpdateInput;
  const subjects = normalizeSubjects(body.subjects);
  if (
    !body.userId ||
    !body.displayName?.trim() ||
    !isTeacherSubject(body.subject) ||
    subjects.length === 0 ||
    !subjects.includes(body.subject) ||
    !validInteger(body.grade, 1, 3) ||
    !validInteger(body.classNumber, 1, 50) ||
    !validInteger(body.studentNumber, 1, 100)
  ) {
    return NextResponse.json(
      { error: "학생의 이름, 과목, 학급, 번호를 올바르게 입력해 주세요." },
      { status: 400 },
    );
  }

  const managed = await getManagedClasses(teacher);
  if ("error" in managed) {
    return NextResponse.json({ error: managed.error }, { status: 500 });
  }

  const { data: student, error: studentError } = await teacher.supabase
    .from("profiles")
    .select("user_id, role, grade, class_number")
    .eq("user_id", body.userId)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: readableSupabaseError(studentError.message) },
      { status: 500 },
    );
  }

  const currentClassKey = `${student?.grade}-${student?.class_number}`;
  const nextClassKey = `${body.grade}-${body.classNumber}`;
  if (
    student?.role !== "student" ||
    !managed.classKeys.has(currentClassKey)
  ) {
    return NextResponse.json(
      { error: "담당 수업 학급의 학생만 수정할 수 있습니다." },
      { status: 403 },
    );
  }
  if (!managed.classKeys.has(nextClassKey)) {
    return NextResponse.json(
      {
        error: `${body.grade}학년 ${body.classNumber}반 수업을 먼저 개설한 후 학급을 변경해 주세요.`,
      },
      { status: 400 },
    );
  }

  const { data: duplicates, error: duplicateError } = await teacher.supabase
    .from("profiles")
    .select("user_id")
    .eq("role", "student")
    .eq("grade", body.grade)
    .eq("class_number", body.classNumber)
    .eq("student_number", body.studentNumber)
    .neq("user_id", body.userId)
    .limit(1);

  if (duplicateError) {
    return NextResponse.json(
      { error: readableSupabaseError(duplicateError.message) },
      { status: 500 },
    );
  }

  if (duplicates?.length) {
    return NextResponse.json(
      {
        error: `${body.grade}학년 ${body.classNumber}반 ${body.studentNumber}번은 이미 사용 중입니다.`,
      },
      { status: 409 },
    );
  }

  const { data: updatedRows, error } = await teacher.supabase.rpc(
    "teacher_update_student_profile",
    {
      target_user_id: body.userId,
      target_display_name: body.displayName.trim(),
      target_grade: body.grade,
      target_class_number: body.classNumber,
      target_student_number: body.studentNumber,
      target_subject: body.subject,
      target_subjects: subjects,
    },
  );

  if (error) {
    if (
      error.code === "23505" ||
      error.message.toLowerCase().includes("student number already exists")
    ) {
      return NextResponse.json(
        {
          error: `${body.grade}학년 ${body.classNumber}반 ${body.studentNumber}번은 이미 사용 중입니다.`,
        },
        { status: 409 },
      );
    }
    if (error.code === "42501") {
      return NextResponse.json(
        { error: "담당 수업 학급의 학생만 수정할 수 있습니다." },
        { status: 403 },
      );
    }
    return NextResponse.json(
      { error: readableSupabaseError(error.message) },
      { status: 500 },
    );
  }

  const updatedStudent = updatedRows?.[0];
  if (!updatedStudent) {
    return NextResponse.json(
      {
        error: "학생 정보를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ student: updatedStudent });
}
