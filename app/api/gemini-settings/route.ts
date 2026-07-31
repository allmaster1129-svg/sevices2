import { auth, authAdminClient } from "@/utils/auth/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

async function requireTeacher() {
  const { userId } = await auth();
  if (!userId) {
    return { error: "로그인이 필요합니다.", status: 401 } as const;
  }

  const supabase = await createClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { error: error.message, status: 500 } as const;
  }
  if (profile?.role !== "admin") {
    return {
      error: "교사 계정만 Gemini API 키를 설정할 수 있습니다.",
      status: 403,
    } as const;
  }

  return { userId } as const;
}

async function getStoredKey(userId: string) {
  const client = await authAdminClient();
  const user = await client.users.getUser(userId);
  const value = user.privateMetadata.geminiApiKey;
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  try {
    const apiKey = await getStoredKey(teacher.userId);
    return NextResponse.json({
      configured: Boolean(apiKey),
      lastFour: apiKey ? apiKey.slice(-4) : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Gemini API 키 설정을 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  const body = (await request.json()) as { apiKey?: string };
  const apiKey = body.apiKey?.trim() ?? "";
  if (
    apiKey.length < 20 ||
    apiKey.length > 200 ||
    /\s/.test(apiKey)
  ) {
    return NextResponse.json(
      { error: "올바른 Gemini API 키를 입력해 주세요." },
      { status: 400 },
    );
  }

  try {
    const client = await authAdminClient();
    await client.users.updateUserMetadata(teacher.userId, {
      privateMetadata: { geminiApiKey: apiKey },
    });
    return NextResponse.json({
      configured: true,
      lastFour: apiKey.slice(-4),
    });
  } catch {
    return NextResponse.json(
      { error: "Gemini API 키를 저장하지 못했습니다." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const teacher = await requireTeacher();
  if ("error" in teacher) {
    return NextResponse.json(
      { error: teacher.error },
      { status: teacher.status },
    );
  }

  try {
    const client = await authAdminClient();
    await client.users.updateUserMetadata(teacher.userId, {
      privateMetadata: { geminiApiKey: null },
    });
    return NextResponse.json({ configured: false, lastFour: null });
  } catch {
    return NextResponse.json(
      { error: "Gemini API 키를 삭제하지 못했습니다." },
      { status: 500 },
    );
  }
}
