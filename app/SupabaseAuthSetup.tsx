"use client";

import type { User } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { ComicBubble, OfficeCharacter } from "./ComicUI";
import {
  DEFAULT_TEACHER_SUBJECT,
  normalizeSubjects,
} from "./subjects";
import SubjectMultiSelect from "./SubjectMultiSelect";

export type AccountRole = "student" | "admin";

export type AccountProfile = {
  role: AccountRole;
  displayName: string;
  grade: number | null;
  classNumber: number | null;
  studentNumber: number | null;
  subject: string | null;
  subjects: string[];
  databaseSynced: boolean;
  syncWarning?: string;
};

type ApiProfile = {
  role: AccountRole;
  display_name: string;
  grade: number | null;
  class_number: number | null;
  student_number: number | null;
  subject: string | null;
  subjects: string[] | null;
};

function normalizeProfile(profile: ApiProfile): AccountProfile {
  const subjects = normalizeSubjects(profile.subjects);
  return {
    role: profile.role,
    displayName: profile.display_name,
    grade: profile.grade,
    classNumber: profile.class_number,
    studentNumber: profile.student_number,
    subject: profile.subject,
    subjects:
      subjects.length > 0
        ? subjects
        : [profile.subject ?? DEFAULT_TEACHER_SUBJECT],
    databaseSynced: true,
  };
}

export default function SupabaseAuthSetup({
  onComplete,
}: {
  onComplete: (profile: AccountProfile) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [role, setRole] = useState<AccountRole>("student");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(1);
  const [classNumber, setClassNumber] = useState(1);
  const [studentNumber, setStudentNumber] = useState(1);
  const [subject, setSubject] = useState(DEFAULT_TEACHER_SUBJECT);
  const [subjects, setSubjects] = useState<string[]>([
    DEFAULT_TEACHER_SUBJECT,
  ]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (!session?.user) setProfileReady(false);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setProfileReady(false);
    setSaveError("");
    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return null;
        const result = (await response.json()) as {
          profile?: ApiProfile;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "프로필을 확인하지 못했습니다.");
        }
        return result.profile ?? null;
      })
      .then((profile) => {
        if (!active) return;
        if (profile) {
          onComplete(normalizeProfile(profile));
          return;
        }
        setName(
          typeof user.user_metadata?.profileName === "string"
            ? user.user_metadata.profileName
            : "",
        );
        setProfileReady(true);
      })
      .catch((reason) => {
        if (active) {
          setSaveError(
            reason instanceof Error
              ? reason.message
              : "프로필을 확인하지 못했습니다.",
          );
          setProfileReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, [onComplete, user]);

  async function submitAuth() {
    const identifier = email.trim().toLowerCase();
    setAuthError("");
    setAuthMessage("");
    if (!identifier || !password) {
      setAuthError("아이디(이메일)와 비밀번호를 입력해 주세요.");
      return;
    }
    if (mode === "signup" && password !== passwordConfirm) {
      setAuthError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setAuthError("비밀번호는 6자 이상 입력해 주세요.");
      return;
    }

    setAuthBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: identifier,
          password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: identifier,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        if (!data.session) {
          setAuthMessage(
            "가입 확인 메일을 보냈습니다. 이메일 인증 후 로그인해 주세요.",
          );
          setMode("login");
        }
      }
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "인증에 실패했습니다.";
      setAuthError(
        message.includes("Invalid login credentials")
          ? "아이디 또는 비밀번호가 올바르지 않습니다."
          : message,
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendConfirmation() {
    const identifier = email.trim().toLowerCase();
    if (!identifier || resendBusy) return;
    setResendBusy(true);
    setAuthError("");
    setAuthMessage("");
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: identifier,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setAuthMessage(
        "운영 사이트 주소로 새 인증 메일을 보냈습니다. 가장 최근 메일을 확인해 주세요.",
      );
    } catch (reason) {
      setAuthError(
        reason instanceof Error
          ? reason.message
          : "인증 메일을 다시 보내지 못했습니다.",
      );
    } finally {
      setResendBusy(false);
    }
  }

  async function saveProfile() {
    if (
      !user ||
      !name.trim() ||
      subjects.length === 0 ||
      !subjects.includes(subject)
    ) return;
    setSaving(true);
    setSaveError("");
    try {
      await supabase.auth.updateUser({
        data: {
          role,
          profileName: name.trim(),
          grade: role === "student" ? grade : null,
          classNumber: role === "student" ? classNumber : null,
          studentNumber: role === "student" ? studentNumber : null,
          subject,
          subjects,
        },
      });
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          displayName: name.trim(),
          grade: role === "student" ? grade : null,
          classNumber: role === "student" ? classNumber : null,
          studentNumber: role === "student" ? studentNumber : null,
          subject,
          subjects,
        }),
      });
      const result = (await response.json()) as {
        profile?: ApiProfile;
        error?: string;
      };
      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? "프로필 저장에 실패했습니다.");
      }
      onComplete(normalizeProfile(result.profile));
    } catch (reason) {
      setSaveError(
        reason instanceof Error ? reason.message : "프로필 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!authReady || (user && !profileReady)) {
    return (
      <main className="login-page">
        <div className="login-card auth-loading">
          <p>Supabase 인증 정보와 프로필을 확인하고 있어요...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="login-page">
        <div className="login-mark"><span>✦</span> 배움짝</div>
        <div className="login-card">
          <div className="login-intro">
            <p className="overline">SUPABASE AUTH</p>
            <h1>
              아이디로 로그인하고,
              <br />
              <em>나만의 배움짝</em>을 시작해요.
            </h1>
            <p>
              Supabase가 아이디와 비밀번호를 인증하고
              <br />
              학급과 학습 정보를 안전하게 연결해요.
            </p>
            <div className="login-comic-scene" aria-hidden="true">
              <ComicBubble accent="yellow">오늘의 문제, 함께 해결해 볼까요?</ComicBubble>
              <OfficeCharacter mood="cheer" prop="laptop" />
              <div className="comic-desk" />
            </div>
          </div>
          <div className="login-form supabase-auth-form">
            <h2>{mode === "login" ? "배움짝 로그인" : "배움짝 회원가입"}</h2>
            <p className="muted">
              {mode === "login"
                ? "아이디와 비밀번호를 입력해 주세요."
                : "사용할 계정을 만들어 주세요."}
            </p>
            <label>
              아이디(이메일)
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@school.kr"
              />
            </label>
            <label>
              비밀번호
              <input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && mode === "login") submitAuth();
                }}
                placeholder="6자 이상 입력"
              />
            </label>
            {mode === "signup" && (
              <label>
                비밀번호 확인
                <input
                  type="password"
                  autoComplete="new-password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") submitAuth();
                  }}
                  placeholder="비밀번호 다시 입력"
                />
              </label>
            )}
            {authError && <p className="profile-save-error">{authError}</p>}
            {authMessage && <p className="auth-success-message">{authMessage}</p>}
            {mode === "login" && (
              <button
                type="button"
                className="auth-resend-link"
                disabled={resendBusy || !email.trim()}
                onClick={resendConfirmation}
              >
                {resendBusy ? "다시 보내는 중..." : "인증 메일 다시 보내기"}
              </button>
            )}
            <button
              type="button"
              className="clerk-primary clerk-wide"
              disabled={authBusy}
              onClick={submitAuth}
            >
              {authBusy
                ? "처리 중..."
                : mode === "login"
                  ? "Supabase로 로그인"
                  : "계정 만들기"}
            </button>
            <button
              type="button"
              className="clerk-secondary clerk-wide"
              onClick={() => {
                setMode((value) => value === "login" ? "signup" : "login");
                setAuthError("");
                setAuthMessage("");
              }}
            >
              {mode === "login" ? "처음이라면 회원가입" : "이미 계정이 있다면 로그인"}
            </button>
            <p className="safe">🔒 계정 정보는 Supabase Auth가 관리합니다.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <div className="login-mark"><span>✦</span> 배움짝</div>
      <div className="login-card profile-setup-card">
        <div className="login-intro">
          <p className="overline">PROFILE SETUP</p>
          <h1>회원가입이 완료됐어요.<br /><em>사용자 정보</em>를 알려주세요.</h1>
          <p>한 번 저장하면 다음 로그인부터 역할에 맞는 화면으로 자동 이동합니다.</p>
          <div className="account-chip">
            <span className="mini-avatar">{(user.email ?? "U").slice(0, 1).toUpperCase()}</span>
            <span>{user.email}</span>
          </div>
          <div className="login-comic-scene" aria-hidden="true">
            <ComicBubble accent="mint">역할과 학급 정보를 한 번만 알려주세요!</ComicBubble>
            <OfficeCharacter mood="explain" prop="note" />
            <div className="comic-desk" />
          </div>
        </div>
        <div className="login-form profile-form">
          <h2>교사·학생 계정 설정</h2>
          <p className="muted">계정 유형과 기본 정보를 입력해 주세요.</p>
          <div className="role-tabs">
            <button className={role === "student" ? "selected" : ""} onClick={() => setRole("student")}>학생</button>
            <button className={role === "admin" ? "selected" : ""} onClick={() => setRole("admin")}>교사</button>
          </div>
          <label>
            이름
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="이름 입력" />
          </label>
          <SubjectMultiSelect
            value={subjects}
            label={role === "admin" ? "담당 교과목" : "학습 교과목"}
            onChange={(nextSubjects) => {
              setSubjects(nextSubjects);
              if (!nextSubjects.includes(subject)) {
                setSubject(nextSubjects[0] ?? DEFAULT_TEACHER_SUBJECT);
              }
            }}
          />
          {subjects.length > 0 && (
            <label>
              첫 화면 조회 과목
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                {subjects.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          )}
          {role === "student" && (
            <div className="student-profile-fields">
              <label>학년<select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>
                {[1, 2, 3].map((value) => <option key={value} value={value}>{value}학년</option>)}
              </select></label>
              <label>반<select value={classNumber} onChange={(event) => setClassNumber(Number(event.target.value))}>
                {Array.from({ length: 50 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}반</option>)}
              </select></label>
              <label>번호<select value={studentNumber} onChange={(event) => setStudentNumber(Number(event.target.value))}>
                {Array.from({ length: 100 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}번</option>)}
              </select></label>
            </div>
          )}
          {saveError && <p className="profile-save-error">{saveError}</p>}
          <button
            className="login-button"
            disabled={saving || !name.trim() || !subjects.length || !subjects.includes(subject)}
            onClick={saveProfile}
          >
            {saving ? "저장 중..." : role === "student" ? "학생 화면 시작하기" : "관리자 설정 열기"}
            <span>→</span>
          </button>
          <button
            type="button"
            className="auth-signout-link"
            onClick={() => supabase.auth.signOut()}
          >
            다른 계정으로 로그인
          </button>
          <p className="safe">✓ 계정 정보는 Supabase에 안전하게 저장됩니다.</p>
        </div>
      </div>
    </main>
  );
}
