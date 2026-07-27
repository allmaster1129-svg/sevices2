"use client";

import { useMemo, useState } from "react";

type Mentor = { name: string; school: string; grade: string; tags: string[]; note: string; color: string; initials: string };

const mentors: Mentor[] = [
  { name: "김도윤", school: "서울중앙중학교", grade: "3학년", tags: ["수학", "농구", "차분한 스타일"], note: "개념을 천천히 설명해주는 걸 좋아해요.", color: "#E8E7FF", initials: "도윤" },
  { name: "박서연", school: "한빛중학교", grade: "2학년", tags: ["영어", "그림", "공감형"], note: "같이 공부하고 서로 응원하는 짝을 찾고 있어요.", color: "#E6F4EA", initials: "서연" },
  { name: "이준혁", school: "푸른중학교", grade: "3학년", tags: ["과학", "게임", "활동적"], note: "실험과 만들기로 배우면 더 잘 기억해요!", color: "#FFF0D9", initials: "준혁" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("내 짝 찾기");
  const [subject, setSubject] = useState("수학");
  const [style, setStyle] = useState("차분하게 설명해주는");
  const [matched, setMatched] = useState<Mentor | null>(null);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => mentors.filter((m) => !query || `${m.name}${m.school}${m.tags.join("")}`.includes(query)), [query]);

  return (
    <main>
      <nav className="nav"><div className="nav-inner"><div className="brand"><span className="brand-mark">✦</span> 짝꿍</div><div className="nav-links"><button className={activeTab === "내 짝 찾기" ? "nav-link active" : "nav-link"} onClick={() => setActiveTab("내 짝 찾기")}>내 짝 찾기</button><button className={activeTab === "둘러보기" ? "nav-link active" : "nav-link"} onClick={() => setActiveTab("둘러보기")}>친구 둘러보기</button><button className="nav-link" onClick={() => alert("준비 중인 기능이에요!")}>활동 가이드</button></div><div className="nav-user"><span className="notif">◌</span><span className="avatar small">민</span><span className="user-name">민서</span><span className="chevron">⌄</span></div></div></nav>

      <section className="hero"><div className="hero-copy"><p className="eyebrow">MIDDLE SCHOOL MENTORING</p><h1>나와 딱 맞는<br /><span>공부 짝꿍</span>을 찾아요.</h1><p className="hero-desc">공부도, 고민도 함께 나누는 우리들의 안전한 매칭 공간.<br />나와 잘 맞는 친구와 한 걸음씩 성장해 보세요.</p><div className="hero-stats"><div><strong>1,248</strong><span>함께하는 학생</span></div><div><strong>96%</strong><span>매칭 만족도</span></div><div><strong>12분</strong><span>평균 매칭 시간</span></div></div></div><div className="hero-art" aria-hidden="true"><div className="dot-grid">{Array.from({ length: 36 }).map((_, i) => <i key={i} />)}</div><div className="floating-card card-a"><span>오늘의 응원</span><b>“할 수 있어!<br />천천히 해도 괜찮아.”</b><small>◒ 짝꿍 서연</small></div><div className="floating-card card-b"><span>함께 푼 문제</span><b>+ 24개</b><small>이번 주 기록</small></div><div className="hero-orb"><span>✦</span></div></div></section>

      <section className="match-area"><div className="section-heading"><div><p className="eyebrow">FIND YOUR MATCH</p><h2>{activeTab === "내 짝 찾기" ? "어떤 짝꿍을 원하나요?" : "친구들의 프로필을 둘러봐요"}</h2></div><div className="progress"><span className="progress-label">매칭 준비 <b>1/3</b></span><div className="progress-track"><i /></div></div></div>
        {activeTab === "내 짝 찾기" ? <div className="workspace"><div className="form-card"><div className="form-step"><span className="step-dot">1</span><div><h3>함께 공부하고 싶은 과목</h3><p>가장 도움받고 싶은 과목을 골라주세요.</p></div></div><div className="chip-row">{["수학", "영어", "과학", "국어", "사회"].map((x) => <button key={x} className={subject === x ? "chip selected" : "chip"} onClick={() => setSubject(x)}>{x}</button>)}</div><div className="form-step second"><span className="step-dot">2</span><div><h3>나와 맞는 대화 스타일</h3><p>어떤 방식으로 배우면 편한가요?</p></div></div><div className="style-list">{["차분하게 설명해주는", "재미있게 알려주는", "함께 고민해주는"].map((x) => <button key={x} className={style === x ? "style-option chosen" : "style-option"} onClick={() => setStyle(x)}><span className="radio">{style === x ? "●" : "○"}</span>{x}<span className="option-arrow">›</span></button>)}</div><button className="primary cta" onClick={() => setMatched(mentors[0])}>짝꿍 추천받기 <span>→</span></button><p className="privacy">🔒 내 정보는 매칭을 위해서만 안전하게 사용돼요.</p></div><div className="tip-card"><div className="tip-icon">☀</div><h3>좋은 짝꿍의 시작</h3><p>내가 잘하는 것과 좋아하는 것을 솔직하게 적을수록 더 잘 맞는 친구를 만날 수 있어요.</p><div className="tip-line" /><span>매칭 전에 꼭 읽어보세요 <b>→</b></span></div></div> : <div className="browse"><div className="search-row"><div className="search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름, 학교, 관심사를 검색해보세요" /></div><button className="secondary">필터 <span>☷</span></button></div><div className="mentor-grid">{filtered.map((m) => <article className="mentor-card" key={m.name}><div className="mentor-top"><div className="avatar" style={{ background: m.color }}>{m.initials}</div><span className="online">● 온라인</span></div><h3>{m.name} <small>{m.grade}</small></h3><p className="school">{m.school}</p><p className="note">{m.note}</p><div className="tags">{m.tags.map((t) => <span key={t}>{t}</span>)}</div><button className="secondary full" onClick={() => setMatched(m)}>짝꿍 신청하기 →</button></article>)}</div></div>}
      </section>

      <footer><span className="brand"><span className="brand-mark">✦</span> 짝꿍</span><span>안전한 온라인 멘토링 · 개인정보 보호 안내</span><span>© 2024 Jjakkung</span></footer>
      {matched && <div className="modal-backdrop" onClick={() => setMatched(null)}><div className="modal" onClick={(e) => e.stopPropagation()}><button className="close" onClick={() => setMatched(null)}>×</button><div className="modal-spark">✦</div><p className="eyebrow">YOUR MATCH</p><h2>{matched.name}님을<br /><span>짝꿍으로 추천해요!</span></h2><p>{matched.name}님은 {subject}을 좋아하고,<br />{style} 스타일이에요.</p><div className="modal-profile"><div className="avatar" style={{ background: matched.color }}>{matched.initials}</div><div><b>{matched.name}</b><small>{matched.school} · {matched.grade}</small></div></div><button className="primary full" onClick={() => { setMatched(null); alert("신청을 보냈어요! 곧 소식을 알려드릴게요."); }}>짝꿍 신청 보내기</button></div></div>}
    </main>
  );
}
