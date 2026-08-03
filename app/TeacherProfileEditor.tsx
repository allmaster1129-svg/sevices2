"use client";

import { useEffect, useState } from "react";
import type { AccountProfile } from "./SupabaseAuthSetup";
import { DEFAULT_TEACHER_SUBJECT } from "./subjects";
import SubjectMultiSelect from "./SubjectMultiSelect";
import PasswordChanger from "./PasswordChanger";
import { createClient } from "@/utils/supabase/client";

type ApiProfile = {
  role: "student" | "admin";
  display_name: string;
  grade: number | null;
  class_number: number | null;
  student_number: number | null;
  subject: string | null;
  subjects: string[] | null;
};

type KeyStatus = {
  configured: boolean;
  lastFour: string | null;
};

export default function TeacherProfileEditor({
  profile,
  onClose,
  onSaved,
}: {
  profile: AccountProfile;
  onClose: () => void;
  onSaved: (profile: AccountProfile) => void;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [subject, setSubject] = useState(
    profile.subject ?? DEFAULT_TEACHER_SUBJECT,
  );
  const [subjects, setSubjects] = useState(
    profile.subjects.length ? profile.subjects : [subject],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    configured: false,
    lastFour: null,
  });
  const [keyLoading, setKeyLoading] = useState(true);
  const [keySaving, setKeySaving] = useState(false);
  const [keyMessage, setKeyMessage] = useState("");
  const [keyError, setKeyError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/gemini-settings", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as KeyStatus & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "Gemini API 키 설정을 확인하지 못했습니다.");
        }
        if (active) {
          setKeyStatus(result);
        }
      })
      .catch((reason) => {
        if (active) {
          setKeyError(
            reason instanceof Error
              ? reason.message
              : "Gemini API 키 설정을 확인하지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (active) setKeyLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function saveProfile() {
    const normalizedName = displayName.trim();
    if (!normalizedName) {
      setError("교사 이름을 입력해 주세요.");
      return;
    }
    if (normalizedName.length > 40) {
      setError("교사 이름은 40자 이하로 입력해 주세요.");
      return;
    }
    if (!subject || !subjects.length || !subjects.includes(subject)) {
      setError("담당 교과목과 현재 조회 과목을 확인해 주세요.");
      return;
    }
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "admin",
          displayName: normalizedName,
          grade: null,
          classNumber: null,
          studentNumber: null,
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
        throw new Error(result.error ?? "교사 정보를 저장하지 못했습니다.");
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          role: "admin",
          profileName: result.profile.display_name,
          subject: result.profile.subject ?? subject,
          subjects: result.profile.subjects ?? subjects,
        },
      });
      if (authError) {
        throw new Error("교사 정보는 저장됐지만 로그인 계정과 동기화하지 못했습니다. 다시 시도해 주세요.");
      }

      onSaved({
        role: "admin",
        displayName: result.profile.display_name,
        grade: null,
        classNumber: null,
        studentNumber: null,
        subject: result.profile.subject ?? subject,
        subjects: result.profile.subjects ?? subjects,
        databaseSynced: result.databaseSynced ?? true,
        syncWarning: result.syncWarning,
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "교사 정보를 저장하는 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveApiKey() {
    if (!apiKey.trim() || keySaving) return;
    setKeySaving(true);
    setKeyError("");
    setKeyMessage("");
    try {
      const response = await fetch("/api/gemini-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const result = (await response.json()) as KeyStatus & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Gemini API 키를 저장하지 못했습니다.");
      }
      setKeyStatus(result);
      setApiKey("");
      setShowApiKey(false);
      setKeyMessage("Gemini API 키가 안전하게 저장되었습니다.");
    } catch (reason) {
      setKeyError(
        reason instanceof Error
          ? reason.message
          : "Gemini API 키를 저장하지 못했습니다.",
      );
    } finally {
      setKeySaving(false);
    }
  }

  async function deleteApiKey() {
    if (keySaving) return;
    setKeySaving(true);
    setKeyError("");
    setKeyMessage("");
    try {
      const response = await fetch("/api/gemini-settings", {
        method: "DELETE",
      });
      const result = (await response.json()) as KeyStatus & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error ?? "Gemini API 키를 삭제하지 못했습니다.");
      }
      setKeyStatus(result);
      setApiKey("");
      setKeyMessage("저장된 Gemini API 키를 삭제했습니다.");
    } catch (reason) {
      setKeyError(
        reason instanceof Error
          ? reason.message
          : "Gemini API 키를 삭제하지 못했습니다.",
      );
    } finally {
      setKeySaving(false);
    }
  }

  return (
    <div
      className="profile-editor-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className="profile-editor-dialog teacher-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-profile-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profile-editor-close"
          aria-label="교사 설정 닫기"
          onClick={onClose}
        >
          ×
        </button>
        <p className="overline">TEACHER SETTINGS</p>
        <h2 id="teacher-profile-editor-title">교사 설정을 변경해요</h2>
        <p className="profile-editor-description">
          교사 이름, 담당 교과목과 나만의 Gemini API 키를 관리할 수 있습니다.
        </p>
        <div className="profile-editor-avatar" aria-hidden="true">
          {(displayName.trim() || profile.displayName).slice(0, 1)}
        </div>
        <b className="profile-editor-name">{displayName.trim() || profile.displayName}</b>

        <section className="teacher-settings-section">
          <div className="teacher-settings-section-heading">
            <div>
              <span>01</span>
              <h3>교사 이름</h3>
            </div>
            <p>변경한 이름은 교사 화면과 학생에게 전달되는 정보에 표시됩니다.</p>
          </div>
          <label className="teacher-name-field">
            이름
            <input
              type="text"
              value={displayName}
              maxLength={40}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="교사 이름을 입력하세요"
            />
          </label>
        </section>

        <section className="teacher-settings-section">
          <div className="teacher-settings-section-heading">
            <div>
              <span>02</span>
              <h3>담당 교과목</h3>
            </div>
            <p>선택한 교과목의 수업과 결과만 화면에 표시됩니다.</p>
          </div>
          <div className="profile-editor-fields teacher-subject-editor">
            <SubjectMultiSelect
              value={subjects}
              label="담당 교과목"
              onChange={(nextSubjects) => {
                setSubjects(nextSubjects);
                if (!nextSubjects.includes(subject)) {
                  setSubject(nextSubjects[0] ?? DEFAULT_TEACHER_SUBJECT);
                }
              }}
            />
            {subjects.length > 0 && (
              <label>
                현재 조회 과목
                <select
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                >
                  {subjects.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {error && <p className="profile-editor-error">{error}</p>}
          <div className="teacher-settings-inline-actions">
            <button
              type="button"
              className="primary"
              disabled={saving || !displayName.trim() || subjects.length === 0}
              onClick={saveProfile}
            >
              {saving ? "저장 중..." : "교사 정보 저장하기"}
            </button>
          </div>
        </section>

        <section className="teacher-settings-section gemini-key-section">
          <div className="teacher-settings-section-heading">
            <div>
              <span>03</span>
              <h3>Gemini API 키</h3>
            </div>
            <p>등록한 키는 내 계정에서 피드백을 만들 때만 사용됩니다.</p>
          </div>

          <div className="gemini-key-status" aria-live="polite">
            <span
              className={
                keyStatus.configured
                  ? "gemini-key-status-dot configured"
                  : "gemini-key-status-dot"
              }
            />
            {keyLoading
              ? "키 등록 상태 확인 중..."
              : keyStatus.configured
                ? `키 등록됨 · 끝 4자리 ${keyStatus.lastFour}`
                : "등록된 키가 없습니다."}
          </div>

          <label className="gemini-key-field">
            새 API 키
            <span>
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={
                  keyStatus.configured
                    ? "새 키를 입력하면 기존 키가 변경됩니다."
                    : "Google AI Studio에서 발급한 키를 입력하세요."
                }
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setKeyMessage("");
                  setKeyError("");
                }}
              />
              <button
                type="button"
                className="gemini-key-visibility"
                onClick={() => setShowApiKey((current) => !current)}
              >
                {showApiKey ? "숨기기" : "보기"}
              </button>
            </span>
          </label>
          <p className="gemini-key-security">
            키 원문은 서버 전용 저장소에 보관되며 저장 후 다시 표시되지
            않습니다.
          </p>
          {keyMessage && <p className="gemini-key-message">{keyMessage}</p>}
          {keyError && <p className="profile-editor-error">{keyError}</p>}
          <div className="teacher-settings-inline-actions">
            {keyStatus.configured && (
              <button
                type="button"
                className="secondary danger"
                disabled={keySaving}
                onClick={deleteApiKey}
              >
                저장된 키 삭제
              </button>
            )}
            <button
              type="button"
              className="primary"
              disabled={!apiKey.trim() || keySaving}
              onClick={saveApiKey}
            >
              {keySaving ? "처리 중..." : keyStatus.configured ? "키 변경하기" : "키 저장하기"}
            </button>
          </div>
        </section>

        <section className="teacher-settings-section">
          <div className="teacher-settings-section-heading">
            <div>
              <span>04</span>
              <h3>비밀번호</h3>
            </div>
            <p>로그인에 사용하는 비밀번호를 변경할 수 있습니다.</p>
          </div>
          <PasswordChanger />
        </section>

        <div className="profile-editor-actions teacher-settings-footer">
          <button type="button" className="secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </section>
    </div>
  );
}
