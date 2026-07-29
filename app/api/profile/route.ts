import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type ProfileInput = {
  role?: "student" | "admin";
  displayName?: string;
  grade?: number | null;
  classNumber?: number | null;
  studentNumber?: number | null;
};

function validInteger(value: number | null | undefined, min: number, max: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, display_name, grade, class_number, student_number")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "저장된 프로필이 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ profile: data });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as ProfileInput;
  if (!body.role || !body.displayName?.trim()) {
    return NextResponse.json(
      { error: "역할과 이름을 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  if (
    body.role === "student" &&
    (!validInteger(body.grade, 1, 3) ||
      !validInteger(body.classNumber, 1, 50) ||
      !validInteger(body.studentNumber, 1, 100))
  ) {
    return NextResponse.json(
      { error: "학생의 학년, 반, 번호를 올바르게 입력해 주세요." },
      { status: 400 },
    );
  }

  const grade = body.role === "student" ? Number(body.grade) : null;
  const classNumber =
    body.role === "student" ? Number(body.classNumber) : null;
  const studentNumber =
    body.role === "student" ? Number(body.studentNumber) : null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        role: body.role,
        display_name: body.displayName.trim(),
        class_code:
          body.role === "student" ? `${grade}-${classNumber}` : "TEACHER",
        grade,
        class_number: classNumber,
        student_number: studentNumber,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("role, display_name, grade, class_number, student_number")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
