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

export default function StudentProfileEditor({
  profile,
  onClose,
  onSaved,
}: {
  profile: AccountProfile;
  onClose: () => void;
  onSaved: (profile: AccountProfile) => void;
}) {
  const { user } = useUser();
  const [grade, setGrade] = useState(profile.grade ?? 1);
  const [classNumber, setClassNumber] = useState(profile.classNumber ?? 1);
  const [studentNumber, setStudentNumber] = useState(profile.studentNumber ?? 1);
  const [subject, setSubject] = useState(
    profile.subject ?? DEFAULT_TEACHER_SUBJECT,
  );
  const [subjects, setSubjects] = useState(
    profile.subjects.length ? profile.subjects : [subject],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveProfile() {
    if (!user || !subjects.length || !subjects.includes(subject)) return;
    setSaving(true);
    setError("");

    try {
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          grade,
          classNumber,
          studentNumber,
          subject,
          subjects,
        },
      });

      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "student",
          displayName: profile.displayName,
          grade,
          classNumber,
          studentNumber,
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
        throw new Error(result.error ?? "학생 정보를 저장하지 못했습니다.");
      }

      onSaved({
        role: "student",
        displayName: result.profile.display_name,
        grade: result.profile.grade,
        classNumber: result.profile.class_number,
        studentNumber: result.profile.student_number,
        subject: result.profile.subject,
        subjects: result.profile.subjects ?? subjects,
        databaseSynced: result.databaseSynced ?? true,
        syncWarning: result.syncWarning,
      });
      onClose();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "학생 정보를 저장하는 중 오류가 발생했습니다.",
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
        aria-labelledby="profile-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="profile-editor-close"
          aria-label="학생 정보 수정 닫기"
          onClick={onClose}
        >
          ×
        </button>
        <p className="overline">MY PROFILE</p>
        <h2 id="profile-editor-title">학급 정보를 변경해요</h2>
        <p className="profile-editor-description">
          변경한 학년과 반에 맞는 수업이 학생 화면에 표시됩니다.
        </p>
        <div className="profile-editor-avatar" aria-hidden="true">
          {profile.displayName.slice(0, 1)}
        </div>
        <b className="profile-editor-name">{profile.displayName}</b>
        <div className="profile-editor-fields student-profile-fields">
          <SubjectMultiSelect
            value={subjects}
            label="학습 교과목"
            onChange={(nextSubjects) => {
              setSubjects(nextSubjects);
              if (!nextSubjects.includes(subject)) {
                setSubject(nextSubjects[0] ?? DEFAULT_TEACHER_SUBJECT);
              }
            }}
          />
          <label className="student-profile-grade">
            학년
            <select value={grade} onChange={(event) => setGrade(Number(event.target.value))}>
              {[1, 2, 3].map((value) => (
                <option key={value} value={value}>{value}학년</option>
              ))}
            </select>
          </label>
          <label className="student-profile-subject">
            현재 조회 과목
            <select value={subject} onChange={(event) => setSubject(event.target.value)}>
              {subjects.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="student-profile-class">
            반
            <select value={classNumber} onChange={(event) => setClassNumber(Number(event.target.value))}>
              {Array.from({ length: 50 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value}반</option>
              ))}
            </select>
          </label>
          <label className="student-profile-number">
            번호
            <select value={studentNumber} onChange={(event) => setStudentNumber(Number(event.target.value))}>
              {Array.from({ length: 100 }, (_, index) => index + 1).map((value) => (
                <option key={value} value={value}>{value}번</option>
              ))}
            </select>
          </label>
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
            {saving ? "저장 중..." : "학급 정보 저장하기"}
          </button>
        </div>
      </section>
    </div>
  );
}
