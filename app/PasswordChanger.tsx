"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

export default function PasswordChanger() {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirm("");
    setError("");
    setDone(false);
  }

  async function changePassword() {
    setError("");
    setDone(false);

    if (!currentPassword || !newPassword) {
      setError("현재 비밀번호와 새 비밀번호를 입력해 주세요.");
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`새 비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`);
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError("새 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("현재 비밀번호와 다른 비밀번호를 입력해 주세요.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email;
      if (!email) {
        throw new Error("로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.");
      }

      // 세션만 있으면 비밀번호를 바꿀 수 있으므로, 자리를 비운 사이 다른 사람이
      // 바꾸지 못하도록 현재 비밀번호를 먼저 확인한다.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error("현재 비밀번호가 올바르지 않습니다.");
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        throw new Error(updateError.message || "비밀번호를 변경하지 못했습니다.");
      }

      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "비밀번호를 변경하는 중 오류가 발생했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="password-changer">
        <button
          type="button"
          className="password-changer-toggle"
          onClick={() => setOpen(true)}
        >
          <span aria-hidden="true">🔒</span> 비밀번호 변경하기
        </button>
      </div>
    );
  }

  return (
    <div className="password-changer open">
      <div className="password-changer-head">
        <b>비밀번호 변경</b>
        <button
          type="button"
          className="password-changer-cancel"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          닫기
        </button>
      </div>
      <div className="password-changer-fields">
        <label>
          현재 비밀번호
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            placeholder="현재 사용 중인 비밀번호"
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </label>
        <label>
          새 비밀번호
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            placeholder={`${MIN_PASSWORD_LENGTH}자 이상 입력`}
            onChange={(event) => setNewPassword(event.target.value)}
          />
        </label>
        <label>
          새 비밀번호 확인
          <input
            type="password"
            autoComplete="new-password"
            value={newPasswordConfirm}
            placeholder="새 비밀번호 다시 입력"
            onChange={(event) => setNewPasswordConfirm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !saving) changePassword();
            }}
          />
        </label>
      </div>
      {error && <p className="password-changer-error">{error}</p>}
      {done && (
        <p className="password-changer-done">
          비밀번호를 변경했어요. 다음 로그인부터 새 비밀번호를 사용해 주세요.
        </p>
      )}
      <button
        type="button"
        className="primary password-changer-submit"
        disabled={saving}
        onClick={changePassword}
      >
        {saving ? "변경 중..." : "비밀번호 변경하기"}
      </button>
    </div>
  );
}
