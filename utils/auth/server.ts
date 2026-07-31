import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function requireConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase 인증 환경변수가 없습니다.");
  }
  return { supabaseUrl, supabaseKey };
}

async function createAuthClient() {
  const config = requireConfig();
  const cookieStore = await cookies();
  return createServerClient(config.supabaseUrl, config.supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Session refresh is also handled by proxy.ts.
        }
      },
    },
  });
}

async function getAuthUser() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function auth() {
  const user = await getAuthUser();
  return { userId: user?.id ?? null };
}

export async function currentUser() {
  const user = await getAuthUser();
  if (!user) return null;
  return {
    id: user.id,
    firstName:
      typeof user.user_metadata?.profileName === "string"
        ? user.user_metadata.profileName
        : null,
    unsafeMetadata: user.user_metadata ?? {},
    primaryEmailAddress: {
      emailAddress: user.email ?? "",
    },
  };
}

export async function authAdminClient() {
  const supabase = await createAuthClient();
  return {
    users: {
      async getUser(userId: string) {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user || data.user.id !== userId) {
          throw error ?? new Error("인증된 사용자만 설정을 확인할 수 있습니다.");
        }
        return {
          privateMetadata:
            (data.user.user_metadata?.privateMetadata as
              | Record<string, unknown>
              | undefined) ?? {},
        };
      },
      async updateUserMetadata(
        userId: string,
        input: { privateMetadata: Record<string, unknown> },
      ) {
        const { data: existing, error: readError } =
          await supabase.auth.getUser();
        if (readError || !existing.user || existing.user.id !== userId) {
          throw (
            readError ??
            new Error("인증된 사용자만 설정을 변경할 수 있습니다.")
          );
        }
        const { error } = await supabase.auth.updateUser({
          data: {
            ...existing.user.user_metadata,
            privateMetadata: {
              ...(existing.user.user_metadata?.privateMetadata as
                | Record<string, unknown>
                | undefined),
              ...input.privateMetadata,
            },
          },
        });
        if (error) throw error;
      },
    },
  };
}
