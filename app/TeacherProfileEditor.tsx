"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import type { AccountProfile } from "./ClerkDatabaseSetup";
import {
  DEFAULT_TEACHER_SUBJECT,
} from "./subjects";
import SubjectMultiSelect from "./SubjectMultiSelect";

type ApiProfile = {
  role: "student" | "admin";
  display_name: string;
  grade: number | null;
  class_number: number | null;
  student_number: number | null;
  subject: string | null;
  subjects: string[] | null;
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
  const { user } = useUser();
  const [subject, setSubject] = useState(
    profile.subject ?? DEFAULT_TEACHER_SUBJECT,
  );
  const [subjects, setSubjects] = useState(
    profile.subjects.length ? profile.subjects : [subject],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveProfile() {
    if (!user || !subject || !subjects.length || !subjects.includes(subject)) return;
    setSaving(true);
    setError("");

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          subject,
          subjects,
        },
      });

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "admin",
          displayName: profile.displayName,
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

  return (
    <div className="profile-editor-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="profile-editor-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-profile-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profile-editor-close"
          aria-label="교사 정보 수정 닫기"
          onClick={onClose}
        >
          ×
        </button>
        <p className="overline">TEACHER PROFILE</p>
        <h2 id="teacher-profile-editor-title">담당 교과목을 변경해요</h2>
        <p className="profile-editor-description">
          변경 후 교사 화면에는 선택한 교과목의 수업과 결과만 표시됩니다.
        </p>
        <div className="profile-editor-avatar" aria-hidden="true">
          {profile.displayName.slice(0, 1)}
        </div>
        <b className="profile-editor-name">{profile.displayName}</b>
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
              <select value={subject} onChange={(event) => setSubject(event.target.value)}>
                {subjects.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        {error && <p className="profile-editor-error">{error}</p>}
        <div className="profile-editor-actions">
          <button type="button" className="secondary" onClick={onClose}>취소</button>
          <button
            type="button"
            className="primary"
            disabled={saving || subjects.length === 0}
            onClick={saveProfile}
          >
            {saving ? "저장 중..." : "교과목 저장하기"}
          </button>
        </div>
      </section>
    </div>
  );
}
