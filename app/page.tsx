"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Show, SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import ClerkDatabaseSetup from "./ClerkDatabaseSetup";
import type { AccountProfile } from "./ClerkDatabaseSetup";
import TeacherLessonSettings from "./TeacherLessonSettings";
import "./settings.module.css";
import "./clerk.module.css";

const questions = Array.from({ length: 12 }, (_, i) => i + 1);
const students = [
  { name: "박서연", role: "설명하는 짝", color: "#dff5e9", accuracy: "92%", matched: "김민준" },
  { name: "김민준", role: "질문하는 짝", color: "#e6ebff", accuracy: "78%", matched: "박서연" },
  { name: "이준혁", role: "설명하는 짝", color: "#fff0d8", accuracy: "84%", matched: "최하늘" },
  { name: "최하늘", role: "질문하는 짝", color: "#ffe6e2", accuracy: "71%", matched: "이준혁" },
];

export default function Home() {
  const [screen, setScreen] = useState<"login" | "student" | "admin" | "settings-roster" | "settings-problems">("login");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [answers, setAnswers] = useState<Record<number, "know" | "need">>({ 1: "know", 2: "know", 3: "know", 4: "need", 5: "know", 6: "need", 7: "know", 8: "know", 9: "need" });
  const done = Object.keys(answers).length;
  const score = useMemo(() => Math.round((Object.values(answers).filter((a) => a === "know").length / Math.max(done, 1)) * 100), [answers, done]);

  if (screen === "login" || !profile) {
    return (
      <ClerkDatabaseSetup
        onComplete={(savedProfile) => {
          setProfile(savedProfile);
          setScreen(
            savedProfile.role === "admin" ? "settings-problems" : "student",
          );
        }}
      />
    );
  }

  const isTeacher = profile.role === "admin";
  const title = screen === "admin" ? "학급 대시보드" : screen === "student" ? "학생 화면" : screen === "settings-roster" ? "학급 명단 관리" : "수업·문항 설정";
  const schoolLabel = isTeacher
    ? "교사 관리자"
    : `${profile.grade}학년 ${profile.classNumber}반 ${profile.studentNumber}번`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="logo"><span>✦</span> 배움짝</div>
        <div className="school-pill">{schoolLabel}<span>⌄</span></div>
        <div className="side-label">MENU</div>
        {isTeacher ? (
          <>
            <button className={screen === "admin" ? "side-link active" : "side-link"} onClick={() => setScreen("admin")}>▦ <span>학급 대시보드</span></button>
            <button className="side-link" onClick={() => setScreen("admin")}>♧ <span>짝 매칭 관리</span></button>
            <div className="side-label settings-label">SETTINGS</div>
            <button className={screen === "settings-roster" ? "side-link active" : "side-link"} onClick={() => setScreen("settings-roster")}>♙ <span>학급 명단 입력</span></button>
            <button className={screen === "settings-problems" ? "side-link active" : "side-link"} onClick={() => setScreen("settings-problems")}>▤ <span>수업·문항 설정</span></button>
          </>
        ) : (
          <button className="side-link active" onClick={() => setScreen("student")}>◌ <span>나의 학습 화면</span></button>
        )}
        <div className="sidebar-bottom">
          <div className="help-box"><b>도움이 필요하신가요?</b><span>사용 가이드 보기 →</span></div>
          <button className="profile" onClick={() => { setProfile(null); setScreen("login"); }}>
            <span className="mini-avatar">{isTeacher ? "쌤" : profile.displayName.slice(0, 1)}</span>
            <span><b>{profile.displayName}</b><small>{isTeacher ? "교사 계정" : "학생 계정"}</small></span>
            <span className="more">•••</span>
          </button>
        </div>
      </aside>
      <main className="dashboard">
        <header className="topbar">
          <div className="breadcrumb">배움짝 <span>/</span> {title}</div>
          <div className="top-actions"><span>◔ 알림</span><span className="account-role-label">{isTeacher ? "교사 관리자" : "학생"}</span></div>
        </header>
        {screen === "admin" ? (
          <Admin />
        ) : screen === "student" ? (
          <Student profile={profile} answers={answers} setAnswers={setAnswers} done={done} score={score} />
        ) : screen === "settings-roster" ? (
          <RosterSettings />
        ) : (
          <TeacherLessonSettings
            databaseSynced={profile.databaseSynced}
            syncWarning={profile.syncWarning}
          />
        )}
      </main>
    </div>
  );
}

function ClerkSetup({ onComplete }: { onComplete: (role: "student" | "admin") => void }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const saved = (user?.unsafeMetadata ?? {}) as { role?: "student" | "admin"; classCode?: string; profileName?: string };
  const [role, setRole] = useState<"student" | "admin">(saved.role ?? "student");
  const [name, setName] = useState(saved.profileName ?? user?.firstName ?? "");
  const [classCode, setClassCode] = useState(saved.classCode ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const profile = user.unsafeMetadata as { role?: "student" | "admin"; classCode?: string; profileName?: string };
    if (profile.role) setRole(profile.role);
    setName(profile.profileName ?? user.firstName ?? "");
    setClassCode(profile.classCode ?? "");
  }, [user]);

  if (!isLoaded) return <main className="login-page"><div className="login-card auth-loading"><p>Clerk 인증을 확인하고 있어요...</p></div></main>;
  if (!isSignedIn || !user) return <main className="login-page"><div className="login-mark"><span>✦</span> 배움짝</div><div className="login-card"><div className="login-intro"><p className="overline">CLERK AUTHENTICATION</p><h1>안전하게 로그인하고,<br /><em>나만의 배움짝</em>을 시작해요.</h1><p>학생과 교사 계정은 Clerk로 안전하게 인증됩니다.<br />인증 후 학급 정보를 입력하면 맞춤 화면이 열려요.</p><div className="login-orb"><i /><i /><i /></div></div><div className="login-form"><h2>배움짝 로그인</h2><p className="muted">먼저 계정을 인증해 주세요.</p><div className="clerk-login-stack"><SignInButton mode="modal"><button className="clerk-primary clerk-wide">Clerk로 로그인</button></SignInButton><SignUpButton mode="modal"><button className="clerk-secondary clerk-wide">처음이라면 회원가입</button></SignUpButton></div><p className="safe">🔒 Clerk가 계정과 비밀번호를 안전하게 관리해요.</p></div></div><p className="login-footer">인증이 끝나면 학생/교사와 학급 코드를 입력합니다.</p></main>;

  return <main className="login-page"><div className="login-mark"><span>✦</span> 배움짝</div><div className="login-card profile-setup-card"><div className="login-intro"><p className="overline">PROFILE SETUP</p><h1>인증이 완료됐어요.<br /><em>내 배움짝</em> 정보를 알려주세요.</h1><p>입력한 정보는 현재 Clerk 계정에 저장되어<br />다음 로그인부터 바로 사용할 수 있어요.</p><div className="account-chip"><UserButton /><span>{user.primaryEmailAddress?.emailAddress}</span></div></div><div className="login-form"><h2>나에게 맞는 화면 설정</h2><p className="muted">학생 또는 교사 계정에 맞게 입력해 주세요.</p><div className="role-tabs"><button className={role === "student" ? "selected" : ""} onClick={() => setRole("student")}>학생</button><button className={role === "admin" ? "selected" : ""} onClick={() => setRole("admin")}>교사</button></div><label>이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 박서연" /></label><label>{role === "student" ? "학급 코드" : "담당 학급 코드"}<input value={classCode} onChange={(e) => setClassCode(e.target.value)} placeholder="예: MATH-2-3" /></label><button className="login-button" disabled={saving || !name.trim() || !classCode.trim()} onClick={async () => { setSaving(true); await user.update({ firstName: name.trim(), unsafeMetadata: { ...user.unsafeMetadata, role, profileName: name.trim(), classCode: classCode.trim() } }); onComplete(role); }}>{saving ? "저장 중..." : role === "student" ? "내 배움짝 확인하기" : "학급 대시보드 열기"} <span>→</span></button><p className="safe">✓ Clerk 계정에 안전하게 저장됩니다.</p></div></div></main>;
}

function Login({ role, setRole, onLogin }: { role: "student" | "admin"; setRole: (r: "student" | "admin") => void; onLogin: () => void }) {
  return <main className="login-page"><div className="login-mark"><span>✦</span> 배움짝</div><div className="login-card"><div className="login-intro"><p className="overline">SMART PEER MATCHING</p><h1>함께 배우고,<br /><em>배움의 빈틈</em>을 채워요.</h1><p>우리 반 친구와 문제를 설명하고 질문하며<br />더 잘 이해하는 수학 수업을 시작해요.</p><div className="login-orb"><i /><i /><i /></div></div><div className="login-form"><h2>배움짝 시작하기</h2><p className="muted">계정 유형을 선택하고 로그인해 주세요.</p><div className="role-tabs"><button className={role === "student" ? "selected" : ""} onClick={() => setRole("student")}>학생</button><button className={role === "admin" ? "selected" : ""} onClick={() => setRole("admin")}>교사</button></div><label>{role === "student" ? "이름" : "교사 이메일"}<input placeholder={role === "student" ? "예: 박서연" : "teacher@school.kr"} defaultValue={role === "student" ? "박서연" : "teacher@school.kr"} /></label><label>{role === "student" ? "학급 코드" : "학교 코드"}<input placeholder={role === "student" ? "예: MATH-2-3" : "예: BAEM-2024"} defaultValue={role === "student" ? "MATH-2-3" : "BAEM-2024"} /></label><button className="login-button" onClick={onLogin}>{role === "student" ? "내 배움짝 확인하기" : "학급 대시보드 열기"} <span>→</span></button><p className="safe">🔒 수업 내에서만 안전하게 사용돼요.</p></div></div><p className="login-footer">배움짝은 학생 간 협력 학습을 돕는 수업용 서비스입니다.</p></main>;
}

function Student({ profile, answers, setAnswers, done, score }: { profile: AccountProfile; answers: Record<number, "know" | "need">; setAnswers: Dispatch<SetStateAction<Record<number, "know" | "need">>>; done: number; score: number }) {
  const matched = students[0];
  return <><section className="welcome"><div><p className="overline">TODAY'S CHECK-IN</p><h1>{profile.displayName} 님, 지금 상태를 알려주세요</h1><p>{profile.grade}학년 {profile.classNumber}반 {profile.studentNumber}번 · 문제마다 하나를 선택하면 나에게 맞는 배움짝을 추천해 드려요.</p></div><div className="completion"><span>응답 현황 <b>{done} / 12 완료</b></span><div><i style={{ width: `${(done / 12) * 100}%` }} /></div></div></section><div className="student-grid"><section className="diagnostic panel"><div className="panel-head"><div><h2>문제마다 하나를 선택하세요</h2><p>초록은 “알고 있어요”, 빨강은 “잘 모르겠어요”를 뜻해요.</p></div><span className="score-badge">현재 이해도 <b>{score}%</b></span></div><div className="question-grid">{questions.map((q) => <div className="question" key={q}><b>{q}번 문제</b><button className={answers[q] === "know" ? "know on" : "know"} onClick={() => setAnswers((v) => ({ ...v, [q]: "know" }))}>✓ 알고 있어요</button><button className={answers[q] === "need" ? "need on" : "need"} onClick={() => setAnswers((v) => ({ ...v, [q]: "need" }))}>? 잘 모르겠어요</button></div>)}</div><div className="diagnostic-foot"><button className="primary">응답 저장하기</button><span>◷ 마지막 저장 1분 전</span></div></section><aside className="match-card"><div className="match-title">나의 배움짝 <span>✦</span></div><div className="match-people"><div><div className="person blue">민</div><b>김민준</b><small>질문하는 짝</small></div><strong>↔</strong><div><div className="person green">{profile.displayName.slice(0, 1)}</div><b>{profile.displayName}</b><small>설명하는 짝</small></div></div><div className="role-note"><span>나의 역할</span><b>친구에게 설명해요</b><span>짝의 역할</span><b>모르는 것을 질문해요</b></div><div className="together"><b>함께 풀 문제</b><div><span>4번</span><span>9번</span><span>11번</span></div><p>서로 알고 있는 부분을 묻고<br />설명하며 해결해 보세요.</p></div><button className="primary full">짝 활동 시작하기 →</button></aside></div></>;
}

function RosterSettings() {
  const [studentsList, setStudentsList] = useState(["박서연", "김민준", "이준혁", "최하늘"]);
  const [newName, setNewName] = useState("");
  return <section className="settings-page"><div className="settings-hero"><div><p className="overline">CLASS SETTINGS / 01</p><h1>학급 명단을 입력해 주세요</h1><p>명단을 기준으로 학생별 진단과 배움짝 매칭이 생성됩니다.</p></div><span className="settings-count">현재 <b>{studentsList.length}명</b></span></div><div className="settings-layout"><section className="panel settings-card"><div className="panel-head"><div><h2>2학년 3반 학생 명단</h2><p>학생 이름을 한 명씩 추가하거나 붙여넣어 주세요.</p></div><button className="secondary">CSV 업로드 ↥</button></div><div className="add-row"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="학생 이름을 입력하세요" onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) { setStudentsList((v) => [...v, newName.trim()]); setNewName(""); } }} /><button className="primary" onClick={() => { if (newName.trim()) { setStudentsList((v) => [...v, newName.trim()]); setNewName(""); } }}>+ 학생 추가</button></div><div className="roster-list">{studentsList.map((name, i) => <div className="roster-row" key={`${name}-${i}`}><span className="roster-number">{String(i + 1).padStart(2, "0")}</span><span className="person" style={{ background: i % 2 ? "#e6ebff" : "#dff5e9" }}>{name.slice(0, 1)}</span><b>{name}</b><span className="roster-status">초대 완료</span><button className="icon-button" onClick={() => setStudentsList((v) => v.filter((_, idx) => idx !== i))}>×</button></div>)}</div><div className="settings-actions"><button className="secondary">변경 취소</button><button className="primary">명단 저장하기 →</button></div></section><aside className="settings-tip"><span>TIP</span><h3>학생에게는 이름만 보여요</h3><p>학생의 진단 결과와 역할은 수업 안에서만 안전하게 공유됩니다.</p><div className="tip-stat"><b>{studentsList.length}</b><span>등록된 학생</span></div></aside></div></section>;
}

function ProblemSettings() {
  const [date, setDate] = useState("2024-07-30");
  const [target, setTarget] = useState([4, 9, 11]);
  return <section className="settings-page"><div className="settings-hero"><div><p className="overline">CLASS SETTINGS / 02</p><h1>날짜별 풀이 문제를 정해요</h1><p>수업 날짜와 문제 범위를 지정하면 학생 진단 화면에 자동으로 반영됩니다.</p></div><span className="settings-count">이번 주 <b>3회 수업</b></span></div><div className="settings-layout"><section className="panel settings-card"><div className="panel-head"><div><h2>학습 일정과 풀이 대상</h2><p>학생이 오늘 풀어볼 문제를 선택하세요.</p></div><span className="trend">자동 저장됨</span></div><label className="date-field">학습 날짜<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label><div className="problem-setting-block"><div className="problem-setting-head"><b>4단원 비례식과 비례배분</b><span>{target.length}개 선택</span></div><div className="problem-pills">{questions.map((q) => <button key={q} className={target.includes(q) ? "problem-pill selected" : "problem-pill"} onClick={() => setTarget((v) => v.includes(q) ? v.filter((n) => n !== q) : [...v, q])}>{q}번</button>)}</div></div><div className="settings-actions"><button className="secondary">미리보기</button><button className="primary">풀이 문제 저장하기 →</button></div></section><aside className="settings-tip calendar-tip"><span>수업 미리보기</span><h3>{date.replace("-", ". ")}</h3><p>학생 화면에 아래 문제만 표시됩니다.</p><div className="preview-problems">{target.sort((a, b) => a - b).map((q) => <span key={q}>{q}번 문제</span>)}</div></aside></div></section>;
}

function Admin() { return <><section className="welcome admin-welcome"><div><p className="overline">CLASS OVERVIEW</p><h1>대단원 연습문제, 함께 해결해요</h1><p>2학년 3반 수학 · 4단원 비례식과 비례배분</p></div><button className="primary">+ 새 수업 만들기</button></section><div className="stat-grid"><div className="stat-card"><span>응답 완료율</span><b>87%</b><i className="ring blue-ring">↗</i></div><div className="stat-card"><span>답변 완료</span><b>58명</b><i className="ring green-ring">✓</i></div><div className="stat-card"><span>도움이 필요해요</span><b>38명</b><i className="ring coral-ring">?</i></div><div className="stat-card"><span>배움짝</span><b>24팀</b><i className="ring navy-ring">♟</i></div></div><div className="admin-grid"><section className="panel heatmap"><div className="panel-head"><div><h2>학생별 문제 이해도</h2><p>초록은 이해, 주황은 추가 설명이 필요한 상태예요.</p></div><button className="secondary">전체 보기 ↗</button></div><div className="heat-header"><span>학생</span>{questions.map((q) => <span key={q}>{q}</span>)}</div>{students.map((s, i) => <div className="heat-row" key={s.name}><b>{s.name}</b>{questions.map((q) => <i key={q} className={(q + i) % 4 === 0 ? "warm" : "good"}>{(q + i) % 4 === 0 ? "!" : "✓"}</i>)}</div>)}</section><section className="panel top3"><div className="panel-head"><div><h2>어려운 문제 TOP 3</h2><p>추가 설명이 필요한 문제예요.</p></div><span className="trend">이번 수업</span></div>{[{ n: 1, q: "9번 문제", p: 43 }, { n: 2, q: "4번 문제", p: 38 }, { n: 3, q: "11번 문제", p: 31 }].map((x) => <div className="top-row" key={x.n}><strong>{x.n}</strong><div><b>{x.q}</b><div><i style={{ width: `${x.p * 1.8}%` }} /></div></div><span>{x.p}%</span></div>)}</section></div><section className="panel pair-panel"><div className="panel-head"><div><h2>배움짝 매칭 결과</h2><p>알고 있는 학생과 도움이 필요한 학생을 연결했어요.</p></div><button className="secondary">매칭 다시 하기 ↻</button></div><div className="pair-grid">{students.map((s) => <div className="pair-row" key={s.name}><div className="person" style={{ background: s.color }}>{s.name.slice(0, 1)}</div><b>{s.name}</b><span>↔</span><div className="person light">{s.matched.slice(0, 1)}</div><b>{s.matched}</b><small>{s.role}</small><button className="ghost">상세 보기 →</button></div>)}</div></section></>; }
