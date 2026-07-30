import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const BUCKET = "lesson-question-images";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

function readableSupabaseError(message: string) {
  if (message.toLowerCase().includes("bucket not found")) {
    return "문항 이미지 저장소가 아직 준비되지 않았습니다. Supabase 마이그레이션을 먼저 적용해 주세요.";
  }
  return message;
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: readableSupabaseError(profileError.message) },
      { status: 500 },
    );
  }
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "교사 계정만 문항 이미지를 업로드할 수 있습니다." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "업로드할 이미지를 선택해 주세요." },
      { status: 400 },
    );
  }

  const extension = ALLOWED_TYPES.get(file.type);
  if (!extension || file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "5MB 이하의 JPG, PNG, WEBP 이미지만 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const imagePath = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(imagePath, await file.arrayBuffer(), {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: readableSupabaseError(uploadError.message) },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(imagePath);
  return NextResponse.json(
    {
      imageUrl: data.publicUrl,
      imagePath,
    },
    { status: 201 },
  );
}
