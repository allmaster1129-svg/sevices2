"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_TEACHER_SUBJECT,
  normalizeSubjects,
} from "./subjects";
import SubjectMultiSelect from "./SubjectMultiSelect";

type ManagedClass = {
  grade: number;
  class_number: number;
};

type Student = {
  user_id: string;
  display_name: string;
  grade: number;
  class_number: number;
  student_number: number;
  subject: string | null;
  subjects: string[] | null;
  updated_at: string;
};

type StudentDraft = {
  displayName: string;
  subject: string;
  subjects: string[];
  grade: string;
  classNumber: string;
  studentNumber: string;
};

function classKey(item: { grade: number; class_number: number }) {
  return `${item.grade}-${item.class_number}`;
}

export default function TeacherStudentManagement() {
  const [classes, setClasses] = useState<ManagedClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClassKey, setSelectedClassKey] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState<StudentDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/student-management", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          classes?: ManagedClass[];
          students?: Student[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(result.error ?? "학생 정보를 불러오지 못했습니다.");
        }
        const nextClasses = result.classes ?? [];
        setClasses(nextClasses);
        setStudents(result.students ?? []);
        setSelectedClassKey(nextClasses[0] ? classKey(nextClasses[0]) : "");
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "학생 정보를 불러오는 중 오류가 발생했습니다.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const visibleStudents = useMemo(
    () =>
      students.filter(
        (student) => classKey(student) === selectedClassKey,
      ),
    [selectedClassKey, students],
  );

  function beginEdit(student: Student) {
    setEditingId(student.user_id);
    const studentSubjects = normalizeSubjects(student.subjects);
    setDraft({
      displayName: student.display_name,
      subject: student.subject ?? DEFAULT_TEACHER_SUBJECT,
      subjects: studentSubjects.length
        ? studentSubjects
        : [student.subject ?? DEFAULT_TEACHER_SUBJECT],
      grade: String(student.grade),
      classNumber: String(student.class_number),
      studentNumber: String(student.student_number),
    });
    setMessage("");
    setError("");
  }

  function cancelEdit() {
    setEditingId("");
    setDraft(null);
    setError("");
  }

  async function saveStudent() {
    if (!editingId || !draft) return;
    const grade = Number(draft.grade);
    const classNumber = Number(draft.classNumber);
    const studentNumber = Number(draft.studentNumber);
    if (
      !draft.displayName.trim() ||
      draft.subjects.length === 0 ||
      !draft.subjects.includes(draft.subject) ||
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 3 ||
      !Number.isInteger(classNumber) ||
      classNumber < 1 ||
      classNumber > 50 ||
      !Number.isInteger(studentNumber) ||
      studentNumber < 1 ||
      studentNumber > 100
    ) {
      setError("학년은 1~3, 반은 1~50, 번호는 1~100으로 입력해 주세요.");
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/student-management", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingId,
          displayName: draft.displayName,
          subject: draft.subject,
          subjects: draft.subjects,
          grade,
          classNumber,
          studentNumber,
        }),
      });
      const result = (await response.json()) as {
        student?: Student;
        error?: string;
      };
      if (!response.ok || !result.student) {
        throw new Error(result.error ?? "학생 정보를 저장하지 못했습니다.");
      }

      setStudents((current) =>
        current
          .map((student) =>
            student.user_id === result.student?.user_id
              ? result.student
              : student,
          )
          .sort(
            (left, right) =>
              left.grade - right.grade ||
              left.class_number - right.class_number ||
              left.student_number - right.student_number,
          ),
      );
      setSelectedClassKey(classKey(result.student));
      setEditingId("");
      setDraft(null);
      setMessage(`${result.student.display_name} 학생 정보를 수정했습니다.`);
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

  if (loading) {
    return (
      <section className="student-management-page">
        <div className="panel student-management-empty">
          학생 정보를 불러오고 있어요...
        </div>
      </section>
    );
  }

  return (
    <section className="student-management-page">
      <div className="settings-hero student-management-hero">
        <div>
          <p className="overline">STUDENT PROFILE MANAGEMENT</p>
          <h1>학생 정보를 확인하고 수정해요</h1>
          <p>
            담당 수업 학급의 학생 이름과 소속 학급, 번호를 안전하게
            변경할 수 있습니다.
          </p>
        </div>
        <span className="settings-count">
          관리 학생 <b>{students.length}명</b>
        </span>
      </div>

      {error && !editingId && <p className="save-message error">{error}</p>}
      {message && <p className="save-message success">{message}</p>}

      {!classes.length ? (
        <div className="panel student-management-empty">
          <span>등록된 담당 학급 없음</span>
          <h2>먼저 수업·문항 설정에서 수업을 만들어 주세요.</h2>
          <p>수업에 지정된 학년과 반을 기준으로 학생이 연결됩니다.</p>
        </div>
      ) : (
        <>
          <div className="panel student-management-toolbar">
            <label>
              학급 선택
              <select
                value={selectedClassKey}
                onChange={(event) => {
                  setSelectedClassKey(event.target.value);
                  cancelEdit();
                }}
              >
                {classes.map((item) => (
                  <option value={classKey(item)} key={classKey(item)}>
                    {item.grade}학년 {item.class_number}반
                  </option>
                ))}
              </select>
            </label>
            <div>
              <span>현재 학급</span>
              <b>{visibleStudents.length}명</b>
            </div>
          </div>

          <div className="panel student-management-card">
            <div className="student-management-heading">
              <span>번호</span>
              <span>학생</span>
              <span>소속 학급</span>
              <span>과목</span>
              <span>관리</span>
            </div>
            {!visibleStudents.length ? (
              <div className="student-management-empty">
                이 학급에 가입한 학생이 아직 없습니다.
              </div>
            ) : (
              <div className="student-management-list">
                {visibleStudents.map((student) => {
                  const isEditing = editingId === student.user_id && draft;
                  return (
                    <article
                      className={isEditing ? "editing" : ""}
                      key={student.user_id}
                    >
                      {isEditing ? (
                        <>
                          <label>
                            이름
                            <input
                              value={draft.displayName}
                              maxLength={40}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  displayName: event.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="student-subject-editor">
                            <SubjectMultiSelect
                              value={draft.subjects}
                              label="교과목"
                              onChange={(nextSubjects) =>
                                setDraft({
                                  ...draft,
                                  subjects: nextSubjects,
                                  subject: nextSubjects.includes(draft.subject)
                                    ? draft.subject
                                    : nextSubjects[0] ?? DEFAULT_TEACHER_SUBJECT,
                                })
                              }
                            />
                            {draft.subjects.length > 0 && (
                              <label>
                                현재 과목
                                <select
                                  value={draft.subject}
                                  onChange={(event) =>
                                    setDraft({
                                      ...draft,
                                      subject: event.target.value,
                                    })
                                  }
                                >
                                  {draft.subjects.map((value) => (
                                    <option key={value} value={value}>{value}</option>
                                  ))}
                                </select>
                              </label>
                            )}
                          </div>
                          <label>
                            학년
                            <input
                              type="number"
                              min={1}
                              max={3}
                              value={draft.grade}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  grade: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            반
                            <input
                              type="number"
                              min={1}
                              max={50}
                              value={draft.classNumber}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  classNumber: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label>
                            번호
                            <input
                              type="number"
                              min={1}
                              max={100}
                              value={draft.studentNumber}
                              onChange={(event) =>
                                setDraft({
                                  ...draft,
                                  studentNumber: event.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="student-edit-actions">
                            <button
                              type="button"
                              className="secondary"
                              disabled={saving}
                              onClick={cancelEdit}
                            >
                              취소
                            </button>
                            <button
                              type="button"
                              className="primary"
                              disabled={saving}
                              onClick={saveStudent}
                            >
                              {saving ? "저장 중..." : "변경 저장"}
                            </button>
                          </div>
                          {error && (
                            <p className="student-edit-error">{error}</p>
                          )}
                        </>
                      ) : (
                        <>
                          <b className="student-number">
                            {student.student_number}번
                          </b>
                          <div className="student-identity">
                            <i>{student.display_name.slice(0, 1)}</i>
                            <strong>{student.display_name}</strong>
                          </div>
                          <span>
                            {student.grade}학년 {student.class_number}반
                          </span>
                          <span>
                            {normalizeSubjects(student.subjects).length
                              ? normalizeSubjects(student.subjects).join(", ")
                              : student.subject ?? "과목 미설정"}
                          </span>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => beginEdit(student)}
                          >
                            정보 수정
                          </button>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
