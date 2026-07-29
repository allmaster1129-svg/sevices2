import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type ProfileInput = {
  role?: "student" | "admin";
  displayName?: string;
  classCode?: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const body = (await request.json()) as ProfileInput;
  if (
    !body.role ||
    !body.displayName?.trim() ||
    !body.classCode?.trim()
  ) {
    return NextResponse.json(
      { error: "역할, 이름, 학급 코드를 모두 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        user_id: userId,
        role: body.role,
        display_name: body.displayName.trim(),
        class_code: body.classCode.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ profile: data });
}
