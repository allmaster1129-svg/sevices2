"use client";

import { TEACHER_SUBJECTS } from "./subjects";

export default function SubjectMultiSelect({
  value,
  onChange,
  label = "교과목",
}: {
  value: string[];
  onChange: (subjects: string[]) => void;
  label?: string;
}) {
  function toggle(subject: string) {
    onChange(
      value.includes(subject)
        ? value.filter((item) => item !== subject)
        : [...value, subject],
    );
  }

  return (
    <fieldset className="subject-multi-select">
      <legend>{label}</legend>
      <p>수업을 확인할 과목을 모두 선택해 주세요.</p>
      <div>
        {TEACHER_SUBJECTS.map((subject) => (
          <label key={subject}>
            <input
              type="checkbox"
              checked={value.includes(subject)}
              onChange={() => toggle(subject)}
            />
            <span>{subject}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
