"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useEffect, useState } from "react";

type AccountRole = "student" | "admin";

type SavedProfile = {
  role?: AccountRole;
  classCode?: string;
  profileName?: string;
};

export default function ClerkDatabaseSetup({
  onComplete,
}: {
  onComplete: (role: AccountRole) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [role, setRole] = useState<AccountRole>("student");
  const [name, setName] = useState("");
  const [classCode, setClassCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!user) return;
    const profile = user.unsafeMetadata as SavedProfile;
    if (profile.role) setRole(profile.role);
    setName(profile.profileName ?? user.firstName ?? "");
    setClassCode(profile.classCode ?? "");
  }, [user]);

  async function saveProfile() {
    if (!user || !name.trim() || !classCode.trim()) return;

    setSaving(true);
    setSaveError("");

    try {
      await user.update({
        firstName: name.trim(),
        unsafeMetadata: {
          ...user.unsafeMetadata,
          role,
          profileName: name.trim(),
          classCode: classCode.trim(),
        },
      });

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          displayName: name.trim(),
          classCode: classCode.trim(),
        }),
      });

      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Supabase 프로필 저장에 실패했습니다.");
      }

      onComplete(role);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "프로필을 저장하는 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <main className="login-page">
        <div className="login-card auth-loading">
          <p>인증 정보를 확인하고 있어요...</p>
        </div>
      </main>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <main className="login-page">
        <div className="login-mark">
          <span>✦</span> 배움짝
        </div>
        <div className="login-card">
          <div className="login-intro">
            <p className="overline">CLERK + SUPABASE</p>
            <h1>
              안전하게 로그인하고,
              <br />
              <em>나만의 배움짝</em>을 시작해요.
            </h1>
            <p>
              Clerk로 계정을 인증하고 Supabase에
              <br />
              학급과 학습 정보를 안전하게 저장해요.
            </p>
            <div className="login-orb">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="login-form">
            <h2>배움짝 로그인</h2>
            <p className="muted">먼저 계정을 인증해 주세요.</p>
            <div className="clerk-login-stack">
              <SignInButton mode="modal">
                <button className="clerk-primary clerk-wide">
                  Clerk로 로그인
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="clerk-secondary clerk-wide">
                  처음이라면 회원가입
                </button>
              </SignUpButton>
            </div>
            <p className="safe">🔒 계정 정보는 Clerk가 관리합니다.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-mark">
        <span>✦</span> 배움짝
      </div>
      <div className="login-card profile-setup-card">
        <div className="login-intro">
          <p className="overline">PROFILE SETUP</p>
          <h1>
            인증이 완료됐어요.
            <br />
            <em>내 배움짝</em> 정보를 알려주세요.
          </h1>
          <p>
            입력 정보는 Clerk 계정과 Supabase DB에 저장되어
            <br />
            다음 로그인부터 다시 사용할 수 있어요.
          </p>
          <div className="account-chip">
            <UserButton />
            <span>{user.primaryEmailAddress?.emailAddress}</span>
          </div>
        </div>
        <div className="login-form">
          <h2>나에게 맞는 화면 설정</h2>
          <p className="muted">학생 또는 교사 계정에 맞게 입력해 주세요.</p>
          <div className="role-tabs">
            <button
              className={role === "student" ? "selected" : ""}
              onClick={() => setRole("student")}
            >
              학생
            </button>
            <button
              className={role === "admin" ? "selected" : ""}
              onClick={() => setRole("admin")}
            >
              교사
            </button>
          </div>
          <label>
            이름
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 박서연"
            />
          </label>
          <label>
            {role === "student" ? "학급 코드" : "담당 학급 코드"}
            <input
              value={classCode}
              onChange={(event) => setClassCode(event.target.value)}
              placeholder="예: MATH-2-3"
            />
          </label>
          {saveError && <p className="profile-save-error">{saveError}</p>}
          <button
            className="login-button"
            disabled={saving || !name.trim() || !classCode.trim()}
            onClick={saveProfile}
          >
            {saving
              ? "저장 중..."
              : role === "student"
                ? "내 배움짝 확인하기"
                : "학급 대시보드 열기"}
            <span>→</span>
          </button>
          <p className="safe">✓ Clerk와 Supabase에 함께 저장됩니다.</p>
        </div>
      </div>
    </main>
  );
}
