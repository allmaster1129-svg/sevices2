"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { createClient } from "@/utils/supabase/client";
import SupabaseAuthSetup from "./SupabaseAuthSetup";
import type { AccountProfile } from "./SupabaseAuthSetup";
import TeacherLessonSettings from "./TeacherLessonSettings";
import StudentLessonDashboard from "./StudentLessonDashboard";
import TeacherClassResults from "./TeacherClassResults";
import TeacherPairMatching from "./TeacherPairMatching";
import TeacherDashboard from "./TeacherDashboard";
import StudentActivityResults from "./StudentActivityResults";
import NotificationCenter from "./NotificationCenter";
import UsageGuide from "./UsageGuide";
import StudentProfileEditor from "./StudentProfileEditor";
import TeacherProfileEditor from "./TeacherProfileEditor";
import TeacherStudentManagement from "./TeacherStudentManagement";
import StudentProgressDashboard from "./StudentProgressDashboard";
import "./settings.module.css";
import "./clerk.module.css";
import "./notifications-guide.css";
import "./manga-theme.css";
import "./tesla-theme.css";

const questions = Array.from({ length: 12 }, (_, i) => i + 1);
const students = [
  { name: "박서연", role: "설명하는 짝", color: "#dff5e9", accuracy: "92%", matched: "김민준" },
  { name: "김민준", role: "질문하는 짝", color: "#e6ebff", accuracy: "78%", matched: "박서연" },
  { name: "이준혁", role: "설명하는 짝", color: "#fff0d8", accuracy: "84%", matched: "최하늘" },
  { name: "최하늘", role: "질문하는 짝", color: "#ffe6e2", accuracy: "71%", matched: "이준혁" },
];

type Screen =
  | "login"
  | "student-dashboard"
  | "student"
  | "student-results"
  | "admin"
  | "matching"
  | "settings-roster"
  | "settings-students"
  | "settings-problems"
  | "guide";

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [screen, setScreen] = useState<Screen>("login");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [switchingSubject, setSwitchingSubject] = useState(false);
  const [subjectSwitchError, setSubjectSwitchError] = useState("");
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, "know" | "need">>({ 1: "know", 2: "know", 3: "know", 4: "need", 5: "know", 6: "need", 7: "know", 8: "know", 9: "need" });
  const done = Object.keys(answers).length;
  const score = useMemo(() => Math.round((Object.values(answers).filter((a) => a === "know").length / Math.max(done, 1)) * 100), [answers, done]);

  if (screen === "login" || !profile) {
    return (
      <SupabaseAuthSetup
        onComplete={(savedProfile) => {
          setProfile(savedProfile);
          setScreen(
            savedProfile.role === "admin" ? "admin" : "student-dashboard",
          );
        }}
      />
    );
  }

  const isTeacher = profile.role === "admin";
  const title = screen === "admin" ? "학급 대시보드" : screen === "student-dashboard" ? "나의 학습 대시보드" : screen === "student" ? "문제풀이 결과 입력" : screen === "student-results" ? "배움짝 결과 입력" : screen === "matching" ? "짝 매칭 관리" : screen === "settings-roster" ? "학급 명단 확인" : screen === "settings-students" ? "학생 정보 관리" : screen === "guide" ? "사용 가이드" : "수업·문항 설정";
  const schoolLabel = isTeacher
    ? `${profile.subject ?? "교과목 미설정"} 교사`
    : `${profile.grade}학년 ${profile.classNumber}반 ${profile.studentNumber}번`;
  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setProfile(null);
      setScreen("login");
    } finally {
      setSigningOut(false);
    }
  };
  const handleSubjectChange = async (nextSubject: string) => {
    if (
      nextSubject === profile.subject ||
      !profile.subjects.includes(nextSubject)
    ) return;

    setSwitchingSubject(true);
    setSubjectSwitchError("");
    try {
      await supabase.auth.updateUser({
        data: {
          subject: nextSubject,
          subjects: profile.subjects,
        },
      });
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: profile.role,
          displayName: profile.displayName,
          grade: profile.grade,
          classNumber: profile.classNumber,
          studentNumber: profile.studentNumber,
          subject: nextSubject,
          subjects: profile.subjects,
        }),
      });
      const result = (await response.json()) as {
        profile?: {
          subject: string | null;
          subjects: string[] | null;
        };
        error?: string;
      };
      if (!response.ok || !result.profile?.subject) {
        throw new Error(result.error ?? "조회 과목을 변경하지 못했습니다.");
      }
      setProfile({
        ...profile,
        subject: result.profile.subject,
        subjects: result.profile.subjects ?? profile.subjects,
      });
    } catch (reason) {
      setSubjectSwitchError(
        reason instanceof Error
          ? reason.message
          : "조회 과목을 변경하지 못했습니다.",
      );
    } finally {
      setSwitchingSubject(false);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          type="button"
          className="logo logo-home-button"
          aria-label="배움짝 메인페이지로 이동"
          onClick={() =>
            setScreen(isTeacher ? "admin" : "student-dashboard")
          }
        >
          <span>✦</span> 배움짝
        </button>
        <div className="school-pill">{schoolLabel}<span>⌄</span></div>
        <div className="side-label">MENU</div>
        {isTeacher ? (
          <>
            <button className={screen === "admin" ? "side-link active" : "side-link"} onClick={() => setScreen("admin")}>▦ <span>학급 대시보드</span></button>
            <button className={screen === "matching" ? "side-link active" : "side-link"} onClick={() => setScreen("matching")}>♧ <span>짝 매칭 관리</span></button>
            <div className="side-label settings-label">SETTINGS</div>
            <button className={screen === "settings-roster" ? "side-link active" : "side-link"} onClick={() => setScreen("settings-roster")}>♙ <span>학급 명단 확인</span></button>
            <button className={screen === "settings-students" ? "side-link active" : "side-link"} onClick={() => setScreen("settings-students")}>✎ <span>학생 정보 관리</span></button>
            <button className={screen === "settings-problems" ? "side-link active" : "side-link"} onClick={() => setScreen("settings-problems")}>▤ <span>수업·문항 설정</span></button>
          </>
        ) : (
          <>
            <button className={screen === "student-dashboard" ? "side-link active" : "side-link"} onClick={() => setScreen("student-dashboard")}>▦ <span>나의 학습 대시보드</span></button>
            <button className={screen === "student" ? "side-link active" : "side-link"} onClick={() => setScreen("student")}>◌ <span>문제풀이 결과 입력</span></button>
            <button className={screen === "student-results" ? "side-link active" : "side-link"} onClick={() => setScreen("student-results")}>✓ <span>배움짝 결과 입력</span></button>
          </>
        )}
        <div className="sidebar-bottom">
          <button
            type="button"
            className={screen === "guide" ? "help-box active" : "help-box"}
            onClick={() => setScreen("guide")}
          >
            <b>도움이 필요하신가요?</b>
            <span>사용 가이드 보기 →</span>
          </button>
          {isTeacher ? (
            <button
              type="button"
              className="profile profile-button"
              aria-label="담당 교과목 변경"
              onClick={() => setProfileEditorOpen(true)}
            >
              <span className="mini-avatar">{profile.displayName.slice(0, 1)}</span>
              <span>
                <b>{profile.displayName}</b>
                <small>{profile.subject ?? "교과목 설정"} · 변경</small>
              </span>
            </button>
          ) : (
            <button
              type="button"
              className="profile profile-button"
              aria-label="학년, 반, 번호 변경"
              onClick={() => setProfileEditorOpen(true)}
            >
              <span className="mini-avatar">{profile.displayName.slice(0, 1)}</span>
              <span><b>{profile.displayName}</b><small>학급 정보 변경</small></span>
            </button>
          )}
          <button
            type="button"
            className="logout-button"
            disabled={signingOut}
            onClick={handleSignOut}
          >
            <span aria-hidden="true">↪</span>
            {signingOut ? "로그아웃 중..." : "로그아웃"}
          </button>
        </div>
      </aside>
      <main className="dashboard">
        <header className="topbar">
          <div className="breadcrumb">배움짝 <span>/</span> {title}</div>
          <div className="top-actions">
            <label className="active-subject-switch">
              <span>조회 과목</span>
              <select
                value={profile.subject ?? profile.subjects[0]}
                disabled={switchingSubject}
                onChange={(event) => handleSubjectChange(event.target.value)}
              >
                {profile.subjects.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
            </label>
            <NotificationCenter
              key={`notifications-${profile.subject}`}
              isTeacher={isTeacher}
            />
            <span className="account-role-label">
              {isTeacher ? `${profile.subject ?? ""} 교사` : "학생"}
            </span>
          </div>
        </header>
        {subjectSwitchError && (
          <p className="subject-switch-error">{subjectSwitchError}</p>
        )}
        {screen === "admin" ? (
          <TeacherDashboard key={`dashboard-${profile.subject}`} />
        ) : screen === "student-dashboard" ? (
          <StudentProgressDashboard key={`student-dashboard-${profile.subject}`} profile={profile} />
        ) : screen === "student" ? (
          <StudentLessonDashboard key={`student-${profile.subject}`} profile={profile} />
        ) : screen === "student-results" ? (
          <StudentActivityResults key={`results-${profile.subject}`} profile={profile} />
        ) : screen === "matching" ? (
          <TeacherPairMatching key={`matching-${profile.subject}`} />
        ) : screen === "settings-roster" ? (
          <TeacherClassResults key={`roster-${profile.subject}`} />
        ) : screen === "settings-students" ? (
          <TeacherStudentManagement key={`students-${profile.subject}`} />
        ) : screen === "guide" ? (
          <UsageGuide isTeacher={isTeacher} />
        ) : (
          <TeacherLessonSettings
            key={`settings-${profile.subject}`}
            databaseSynced={profile.databaseSynced}
            syncWarning={profile.syncWarning}
            subject={profile.subject ?? "수학"}
          />
        )}
      </main>
      {!isTeacher && profileEditorOpen && (
        <StudentProfileEditor
          profile={profile}
          onClose={() => setProfileEditorOpen(false)}
          onSaved={setProfile}
        />
      )}
      {isTeacher && profileEditorOpen && (
        <TeacherProfileEditor
          profile={profile}
          onClose={() => setProfileEditorOpen(false)}
          onSaved={(savedProfile) => {
            setProfile(savedProfile);
            setScreen("admin");
          }}
        />
      )}
    </div>
  );
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
