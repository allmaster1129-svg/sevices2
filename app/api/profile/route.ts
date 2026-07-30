import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
  DEFAULT_TEACHER_SUBJECT,
  isTeacherSubject,
} from "@/app/subjects";

type ProfileInput = {
  role?: "student" | "admin";
  displayName?: string;
  grade?: number | null;
  classNumber?: number | null;
  studentNumber?: number | null;
  subject?: string | null;
};

type ClerkProfileMetadata = {
  role?: "student" | "admin";
  profileName?: string;
  grade?: number | null;
  classNumber?: number | null;
  studentNumber?: number | null;
  subject?: string | null;
};

function validInteger(value: number | null | undefined, min: number, max: number) {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}

function isSupabaseKeyConfigurationError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("no suitable key") ||
    normalized.includes("wrong key type") ||
    normalized.includes("invalid jwt") ||
    normalized.includes("jwk")
  );
}

function syncWarning() {
  return "Supabase의 Clerk 인증 연결이 아직 완료되지 않아 계정 정보는 Clerk에 우선 저장했습니다. 관리자 화면은 정상적으로 사용할 수 있으며, Supabase Third-Party Auth 또는 서버 Secret Key를 설정하면 DB 동기화가 완료됩니다.";
}

async function getClerkProfileFallback() {
  const user = await currentUser();
  const metadata = user?.unsafeMetadata as ClerkProfileMetadata | undefined;
  if (!metadata?.role) return null;

  return {
    role: metadata.role,
    display_name:
      metadata.profileName ?? user?.firstName ?? "배움짝 사용자",
    grade: metadata.role === "student" ? (metadata.grade ?? null) : null,
    class_number:
      metadata.role === "student" ? (metadata.classNumber ?? null) : null,
    student_number:
      metadata.role === "student" ? (metadata.studentNumber ?? null) : null,
    subject:
      metadata.role === "admin"
        ? (metadata.subject ?? DEFAULT_TEACHER_SUBJECT)
        : null,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("role, display_name, grade, class_number, student_number, subject")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isSupabaseKeyConfigurationError(error.message)) {
      const fallback = await getClerkProfileFallback();
      if (fallback) {
        return NextResponse.json({
          profile: fallback,
          databaseSynced: false,
          syncWarning: syncWarning(),
        });
      }
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "저장된 프로필이 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ profile: data, databaseSynced: true });
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

  if (body.role === "admin" && !isTeacherSubject(body.subject)) {
    return NextResponse.json(
      { error: "담당 교과목을 선택해 주세요." },
      { status: 400 },
    );
  }

  const grade = body.role === "student" ? Number(body.grade) : null;
  const classNumber =
    body.role === "student" ? Number(body.classNumber) : null;
  const studentNumber =
    body.role === "student" ? Number(body.studentNumber) : null;
  const subject = body.role === "admin" ? body.subject!.trim() : null;

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
        subject,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select("role, display_name, grade, class_number, student_number, subject")
    .single();

  if (error) {
    if (isSupabaseKeyConfigurationError(error.message)) {
      return NextResponse.json(
        {
          profile: {
            role: body.role,
            display_name: body.displayName.trim(),
            grade,
            class_number: classNumber,
            student_number: studentNumber,
            subject,
          },
          databaseSynced: false,
          syncWarning: syncWarning(),
        },
        { status: 202 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data, databaseSynced: true });
}
