"use client";

import {
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";
import { useEffect, useState } from "react";
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

type SavedProfile = {
  role?: AccountRole;
  profileName?: string;
  grade?: number;
  classNumber?: number;
  studentNumber?: number;
  subject?: string;
  subjects?: string[];
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

function normalizeProfile(
  profile: ApiProfile,
  databaseSynced = true,
  syncWarning?: string,
): AccountProfile {
  return {
    role: profile.role,
    displayName: profile.display_name,
    grade: profile.grade,
    classNumber: profile.class_number,
    studentNumber: profile.student_number,
    subject: profile.subject,
    subjects:
      normalizeSubjects(profile.subjects).length > 0
        ? normalizeSubjects(profile.subjects)
        : profile.subject
          ? [profile.subject]
          : [DEFAULT_TEACHER_SUBJECT],
    databaseSynced,
    syncWarning,
  };
}

export default function ClerkDatabaseSetup({
  onComplete,
}: {
  onComplete: (profile: AccountProfile) => void;
}) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [role, setRole] = useState<AccountRole>("student");
  const [name, setName] = useState("");
  const [grade, setGrade] = useState(1);
  const [classNumber, setClassNumber] = useState(1);
  const [studentNumber, setStudentNumber] = useState(1);
  const [subject, setSubject] = useState(DEFAULT_TEACHER_SUBJECT);
  const [subjects, setSubjects] = useState<string[]>([
    DEFAULT_TEACHER_SUBJECT,
  ]);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!user) {
      setProfileChecked(false);
      return;
    }

    const saved = user.unsafeMetadata as SavedProfile;
    if (saved.role) setRole(saved.role);
    setName(saved.profileName ?? user.firstName ?? "");
    setGrade(saved.grade ?? 1);
    setClassNumber(saved.classNumber ?? 1);
    setStudentNumber(saved.studentNumber ?? 1);
    setSubject(saved.subject ?? DEFAULT_TEACHER_SUBJECT);
    const savedSubjects = normalizeSubjects(saved.subjects);
    setSubjects(
      savedSubjects.length
        ? savedSubjects
        : [saved.subject ?? DEFAULT_TEACHER_SUBJECT],
    );

    let active = true;
    setCheckingProfile(true);

    fetch("/api/profile", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 404) return null;
        const result = (await response.json()) as {
          profile?: ApiProfile;
          error?: string;
          databaseSynced?: boolean;
          syncWarning?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "프로필을 확인하지 못했습니다.");
        }
        return result.profile
          ? normalizeProfile(
              result.profile,
              result.databaseSynced ?? true,
              result.syncWarning,
            )
          : null;
      })
      .then((profile) => {
        if (!active || !profile) return;
        const profileIsComplete =
          Boolean(profile.subject) &&
          profile.subjects.length > 0 &&
          ((profile.role === "admin") ||
          Boolean(
            profile.grade &&
              profile.classNumber &&
              profile.studentNumber,
          ));
        if (profileIsComplete) {
          onComplete(profile);
        } else {
          setRole(profile.role);
          setName(profile.displayName);
        }
      })
      .catch((error) => {
        if (active) {
          setSaveError(
            error instanceof Error
              ? error.message
              : "프로필을 확인하는 중 오류가 발생했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setCheckingProfile(false);
          setProfileChecked(true);
        }
      });

    return () => {
      active = false;
    };
  }, [onComplete, user]);

  async function saveProfile() {
    const studentFieldsValid =
      role === "admin" ||
      (grade >= 1 &&
        grade <= 3 &&
        classNumber >= 1 &&
        studentNumber >= 1);
    if (
      !user ||
      !name.trim() ||
      !studentFieldsValid ||
      subjects.length === 0 ||
      !subjects.includes(subject)
    ) return;

    setSaving(true);
    setSaveError("");

    try {
      const metadata = {
        ...user.unsafeMetadata,
        role,
        profileName: name.trim(),
        grade: role === "student" ? grade : null,
        classNumber: role === "student" ? classNumber : null,
        studentNumber: role === "student" ? studentNumber : null,
        subject,
        subjects,
      };

      await user.update({
        firstName: name.trim(),
        unsafeMetadata: metadata,
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
        databaseSynced?: boolean;
        syncWarning?: string;
      };

      if (!response.ok || !result.profile) {
        throw new Error(result.error ?? "Supabase 프로필 저장에 실패했습니다.");
      }

      onComplete(
        normalizeProfile(
          result.profile,
          result.databaseSynced ?? true,
          result.syncWarning,
        ),
      );
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

  if (!isLoaded || (isSignedIn && user && (!profileChecked || checkingProfile))) {
    return (
      <main className="login-page">
        <div className="login-card auth-loading">
          <p>인증 정보와 저장된 프로필을 확인하고 있어요...</p>
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
            <div className="login-comic-scene" aria-hidden="true">
              <ComicBubble accent="yellow">
                오늘의 문제, 함께 해결해 볼까요?
              </ComicBubble>
              <OfficeCharacter mood="cheer" prop="laptop" />
              <div className="comic-desk" />
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
            회원가입이 완료됐어요.
            <br />
            <em>사용자 정보</em>를 알려주세요.
          </h1>
          <p>
            한 번 저장하면 다음 로그인부터 역할에 맞는 화면으로
            <br />
            자동 이동합니다.
          </p>
          <div className="account-chip">
            <UserButton />
            <span>{user.primaryEmailAddress?.emailAddress}</span>
          </div>
          <div className="login-comic-scene" aria-hidden="true">
            <ComicBubble accent="mint">
              역할과 학급 정보를 한 번만 알려주세요!
            </ComicBubble>
            <OfficeCharacter mood="explain" prop="note" />
            <div className="comic-desk" />
          </div>
        </div>
        <div className="login-form profile-form">
          <h2>교사·학생 계정 설정</h2>
          <p className="muted">계정 유형과 기본 정보를 입력해 주세요.</p>
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
              placeholder={role === "student" ? "예: 박서연" : "예: 김선생님"}
            />
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
              <select
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              >
                {subjects.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
          {role === "student" && (
            <>
              <div className="student-profile-fields">
                <label>
                  학년
                  <select
                    value={grade}
                    onChange={(event) => setGrade(Number(event.target.value))}
                  >
                    <option value={1}>1학년</option>
                    <option value={2}>2학년</option>
                    <option value={3}>3학년</option>
                  </select>
                </label>
                <label>
                  반
                  <select
                    value={classNumber}
                    onChange={(event) => setClassNumber(Number(event.target.value))}
                  >
                    {Array.from({ length: 50 }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>{value}반</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  번호
                  <select
                    value={studentNumber}
                    onChange={(event) => setStudentNumber(Number(event.target.value))}
                  >
                    {Array.from({ length: 100 }, (_, index) => index + 1).map(
                      (value) => (
                        <option key={value} value={value}>{value}번</option>
                      ),
                    )}
                  </select>
                </label>
              </div>
            </>
          )}
          {saveError && <p className="profile-save-error">{saveError}</p>}
          <button
            className="login-button"
            disabled={
              saving ||
              !name.trim() ||
              (role === "student" &&
                (!grade || !classNumber || !studentNumber)) ||
              subjects.length === 0 ||
              !subjects.includes(subject)
            }
            onClick={saveProfile}
          >
            {saving
              ? "저장 중..."
              : role === "student"
                ? "학생 화면 시작하기"
                : "관리자 설정 열기"}
            <span>→</span>
          </button>
          <p className="safe">✓ 계정 정보는 Supabase에 안전하게 저장됩니다.</p>
        </div>
      </div>
    </main>
  );
}
