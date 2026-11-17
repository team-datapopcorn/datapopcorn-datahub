// 수능 도구 (키 불필요, 내장 데이터). 학원 상담·반 관리용.
// 데이터: 한국교육과정평가원 공공데이터(2026학년도 수능 등급구분·표준점수 도수분포, 9월 모의평가 등급구분, 연도별 응시현황),
// 평가원 응시원서 접수 결과 보도자료(2021~2027학년도), 2026학년도 채점 결과 보도. 스냅샷 2026-11-17.
import { APPS, GRADES, DIST, HIST } from "./suneung-data.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: false };
const SRC = "suneung (한국교육과정평가원 공공데이터, 스냅샷 2026-11-17)";
const BASIS = "2026학년도 수능(2025-11-13 시행) 실제 채점 결과 기준. 2027학년도 수능 결과는 2026-12-11 성적 통지 뒤 반영 예정이므로, 올해 등급컷과 다를 수 있음";
const NOT_PREDICTION = "합격 가능성 예측이 아님. 위치·등급 확인용이며 대학별 환산점수와 다름";
const SITE = "https://suneung.datapopcorn.ai";

const ALIAS = {
  국어: "국어", 국: "국어", 수학: "수학", 수: "수학", 영어: "영어", 영: "영어", 한국사: "한국사", 한사: "한국사",
  생윤: "생활과 윤리", 생활과윤리: "생활과 윤리", 윤사: "윤리와 사상", 윤리와사상: "윤리와 사상",
  한지: "한국지리", 한국지리: "한국지리", 세지: "세계지리", 세계지리: "세계지리", 동사: "동아시아사", 동아시아사: "동아시아사",
  세사: "세계사", 세계사: "세계사", 경제: "경제", 정법: "정치와 법", 정치와법: "정치와 법", 사문: "사회·문화", 사회문화: "사회·문화", "사회·문화": "사회·문화",
  물1: "물리학 Ⅰ", 물리1: "물리학 Ⅰ", 물리학1: "물리학 Ⅰ", 물리학i: "물리학 Ⅰ", 화1: "화학 Ⅰ", 화학1: "화학 Ⅰ", 화학i: "화학 Ⅰ",
  생1: "생명과학 Ⅰ", 생명1: "생명과학 Ⅰ", 생명과학1: "생명과학 Ⅰ", 생명과학i: "생명과학 Ⅰ", 지1: "지구과학 Ⅰ", 지구1: "지구과학 Ⅰ", 지구과학1: "지구과학 Ⅰ", 지구과학i: "지구과학 Ⅰ",
  물2: "물리학 Ⅱ", 물리2: "물리학 Ⅱ", 물리학2: "물리학 Ⅱ", 물리학ii: "물리학 Ⅱ", 화2: "화학 Ⅱ", 화학2: "화학 Ⅱ", 화학ii: "화학 Ⅱ",
  생2: "생명과학 Ⅱ", 생명2: "생명과학 Ⅱ", 생명과학2: "생명과학 Ⅱ", 생명과학ii: "생명과학 Ⅱ", 지2: "지구과학 Ⅱ", 지구2: "지구과학 Ⅱ", 지구과학2: "지구과학 Ⅱ", 지구과학ii: "지구과학 Ⅱ",
  성직: "성공적인 직업생활", 성공적인직업생활: "성공적인 직업생활", 농업기초기술: "농업 기초 기술", 공업일반: "공업 일반", 상업경제: "상업 경제",
  "수산·해운산업기초": "수산·해운 산업 기초", 수산해운산업기초: "수산·해운 산업 기초", 인간발달: "인간발달",
  독일어: "독일어 Ⅰ", 프랑스어: "프랑스어 Ⅰ", 스페인어: "스페인어 Ⅰ", 중국어: "중국어 Ⅰ", 일본어: "일본어 Ⅰ", 러시아어: "러시아어 Ⅰ", 아랍어: "아랍어 Ⅰ", 베트남어: "베트남어 Ⅰ", 한문: "한문 Ⅰ",
};
const key = (s) => String(s || "").toLowerCase().replace(/\s+/g, "").replace(/Ⅰ/g, "1").replace(/Ⅱ/g, "2").replace(/ii$/, "2").replace(/i$/, "1");
const GRADE_BY_KEY = new Map(GRADES.map((g) => [key(g.s), g]));
const DIST_BY_GRADE = new Map(DIST.map((d) => [d.gs, d]));
function resolve(subject) {
  const raw = String(subject || "").trim();
  const a = ALIAS[raw.replace(/\s+/g, "")] || ALIAS[key(raw)];
  const g = (a && GRADES.find((x) => x.s === a)) || GRADE_BY_KEY.get(key(raw)) || GRADE_BY_KEY.get(key(raw).replace(/1$/, "1"));
  if (!g) throw new Error(`과목을 찾지 못함: '${subject}'. 예: 국어, 수학, 영어, 한국사, 생윤, 사문, 지1, 물리학 Ⅰ, 일본어`);
  return g;
}
const ABSOLUTE = new Set(["영어", "한국사"]);
const isAbs = (g) => ABSOLUTE.has(g.s) || g.a === "제2외국어/한문";
const r1 = (v, d = 1) => (v == null ? null : Math.round(v * 10 ** d) / 10 ** d);

function gradeOf(g, score) {
  for (const row of g.g) {
    const c = row[1];
    if (c == null || String(c).includes("미만")) continue;
    if (score >= Number(c)) return row[0];
  }
  return 9;
}
function cutOf(g, grade) {
  const row = g.g.find((r) => r[0] === grade);
  return row && row[1] != null && !String(row[1]).includes("미만") ? Number(row[1]) : null;
}

// 한 과목 위치 계산
function position(subject, score, opts = {}) {
  const g = resolve(subject);
  const s = Number(score);
  if (!Number.isFinite(s)) throw new Error(`${g.s} 점수가 숫자가 아님: ${score}`);
  const out = { subject: g.s, area: g.a, examinees: g.n };
  if (isAbs(g)) {
    // 절대평가: 원점수(또는 등급) → 등급, 그 등급 비율
    const asGrade = opts.isGrade || (s >= 1 && s <= 9 && Number.isInteger(s) && opts.allowGradeInput);
    const grade = asGrade ? s : gradeOf(g, s);
    const row = g.g.find((r) => r[0] === grade);
    const upper = g.g.filter((r) => r[0] <= grade).reduce((a, r) => a + (r[3] || 0), 0);
    Object.assign(out, {
      scoreType: asGrade ? "등급" : "원점수",
      input: s, grade, gradeRatioPct: row ? row[3] : null, cumulativeTopPct: r1(upper, 2),
      nextGradeCut: grade > 1 ? cutOf(g, grade - 1) : null,
      pointsToNextGrade: !asGrade && grade > 1 && cutOf(g, grade - 1) != null ? cutOf(g, grade - 1) - s : null,
      note: `${g.s}는 절대평가라 원점수 기준 등급만 나옴(표준점수·백분위 없음). 등급 컷은 해마다 같고 비율만 달라짐`,
    });
    return out;
  }
  const d = DIST_BY_GRADE.get(g.s);
  if (!d) throw new Error(`${g.s} 도수분포 없음`);
  const N = d.nm + d.nf;
  let above = 0, same = 0;
  for (const [sc, m, f] of d.r) { if (sc > s) above += m + f; else if (sc === s) same += m + f; }
  const below = N - above - same;
  const grade = gradeOf(g, s);
  const next = grade > 1 ? cutOf(g, grade - 1) : null;
  const minScore = d.r[d.r.length - 1][0];
  Object.assign(out, {
    scoreType: "표준점수", input: s, grade,
    higherCount: above, sameScoreCount: same, topPct: r1(((above + same) / N) * 100, 2),
    percentileEst: Math.round(((below + same / 2) / N) * 100),
    nextGradeCut: next, pointsToNextGrade: next != null ? next - s : null,
    grade1Cut: cutOf(g, 1), maxScore: d.max, maxScoreCount: d.maxn,
    outOfRange: s > d.max ? `2026학년도 최고점(${d.max})보다 높음` : s < minScore ? `2026학년도 최저점(${minScore})보다 낮음` : false,
  });
  return out;
}

function sentence(p) {
  if (p.scoreType === "표준점수") {
    const tail = p.pointsToNextGrade != null && p.pointsToNextGrade > 0 ? ` ${p.grade - 1}등급(${p.nextGradeCut}점)까지 ${p.pointsToNextGrade}점 남았습니다.` : "";
    return `${p.subject} 표준점수 ${p.input}점은 상위 ${p.topPct}%(백분위 약 ${p.percentileEst}, ${p.grade}등급) 위치입니다.${tail}`;
  }
  const tail = p.pointsToNextGrade != null && p.pointsToNextGrade > 0 ? ` ${p.grade - 1}등급까지 원점수 ${p.pointsToNextGrade}점 남았습니다.` : "";
  return `${p.subject} ${p.scoreType} ${p.input}${p.scoreType === "원점수" ? "점" : ""}은 ${p.grade}등급입니다(작년 이 등급 비율 ${p.gradeRatioPct}%).${tail}`;
}

// scores 입력을 [{subject, score, isGrade}] 로 통일. 객체({국어:131, 사문:65}) 또는 배열 모두 허용.
function normScores(scores) {
  if (!scores) throw new Error("scores가 필요함. 예: {국어:131, 수학:128, 영어:85, 한국사:40, 사문:65, 생윤:66}");
  const list = Array.isArray(scores)
    ? scores.map((x) => ({ subject: x.subject, score: x.score ?? x.raw ?? x.grade, isGrade: x.grade != null && x.score == null && x.raw == null }))
    : Object.entries(scores).map(([k, v]) => (v && typeof v === "object" ? { subject: v.subject || k, score: v.score ?? v.raw ?? v.grade, isGrade: v.grade != null && v.score == null && v.raw == null } : { subject: k, score: v }));
  return list.filter((x) => x.score !== "" && x.score != null);
}

function analyzeStudent(args) {
  const items = normScores(args.scores).map((x) => {
    try { return position(x.subject, x.score, { isGrade: x.isGrade }); }
    catch (e) { return { subject: x.subject, error: e.message }; }
  });
  const ok = items.filter((p) => !p.error);
  const rel = ok.filter((p) => p.scoreType === "표준점수");
  const strongest = rel.slice().sort((a, b) => a.topPct - b.topPct)[0];
  const weakest = rel.slice().sort((a, b) => b.topPct - a.topPct)[0];
  const near = ok.filter((p) => p.pointsToNextGrade != null && p.pointsToNextGrade > 0 && p.pointsToNextGrade <= (args.borderPoints ?? 2));
  const avgPct = rel.length ? Math.round(rel.reduce((a, p) => a + p.percentileEst, 0) / rel.length) : null;
  const who = args.name ? `${args.name} 학생` : "이 학생";
  const lines = ok.map(sentence);
  if (strongest && weakest && strongest !== weakest) lines.push(`작년 수능 기준으로 가장 강한 과목은 ${strongest.subject}(상위 ${strongest.topPct}%), 가장 약한 과목은 ${weakest.subject}(상위 ${weakest.topPct}%)입니다.`);
  if (near.length) lines.push(`등급 경계(다음 등급까지 ${args.borderPoints ?? 2}점 이내): ${near.map((p) => `${p.subject} ${p.pointsToNextGrade}점`).join(", ")}. 실수 한두 문제로 등급이 바뀌는 구간이라 집중 관리 대상입니다.`);
  return {
    source: SRC, basis: BASIS, disclaimer: NOT_PREDICTION,
    student: args.name || null,
    subjects: items,
    summary: { relativeSubjects: rel.length, avgPercentileEst: avgPct, strongest: strongest?.subject || null, weakest: weakest?.subject || null, borderSubjects: near.map((p) => p.subject) },
    counselingNote: `${who} 성적 해석 (${BASIS.split(".")[0]})\n- ` + lines.join("\n- "),
    tip: "가채점 원점수(국어·수학·탐구)는 평균·표준편차가 공개되기 전이라 표준점수로 정확히 바꿀 수 없음. 성적표(12/11)의 표준점수를 넣거나, 영어·한국사처럼 절대평가 과목만 원점수로 넣을 것",
    more: `${SITE}/scores/`,
  };
}

// CSV(이름 + 과목 열) 또는 students 배열
function parseCsv(text) {
  const rows = String(text).trim().split(/\r?\n/).map((l) => l.split(/[,\t]/).map((c) => c.trim()));
  const head = rows.shift();
  const nameIdx = head.findIndex((h) => /이름|성명|name|학생/i.test(h));
  return rows.filter((r) => r.some((c) => c)).map((r, i) => {
    const scores = {};
    head.forEach((h, j) => { if (j !== nameIdx && h && r[j] !== undefined && r[j] !== "") scores[h] = Number(r[j]); });
    return { name: nameIdx >= 0 ? r[nameIdx] : `학생${i + 1}`, scores };
  });
}

function analyzeClass(args) {
  const students = args.csv ? parseCsv(args.csv) : args.students;
  if (!Array.isArray(students) || !students.length) throw new Error("students 배열이나 csv가 필요함. csv 예: '이름,국어,수학,영어,사문,생윤\\n김민준,131,128,85,65,66'");
  if (students.length > 500) throw new Error("한 번에 500명까지");
  const border = args.borderPoints ?? 2;
  const per = {}; const rows = []; const borderList = []; const errors = [];
  for (const st of students) {
    const row = { name: st.name || null, grades: {}, avgPercentileEst: null };
    const pcts = [];
    for (const x of normScores(st.scores)) {
      let p;
      try { p = position(x.subject, x.score, { isGrade: x.isGrade }); } catch (e) { errors.push(`${st.name || "?"} ${x.subject}: ${e.message}`); continue; }
      row.grades[p.subject] = p.grade;
      const s = (per[p.subject] ||= { subject: p.subject, type: p.scoreType, n: 0, sum: 0, pctSum: 0, grades: {} });
      s.n++; s.sum += p.input; s.grades[p.grade] = (s.grades[p.grade] || 0) + 1;
      if (p.percentileEst != null) { s.pctSum += p.percentileEst; pcts.push(p.percentileEst); }
      if (p.pointsToNextGrade != null && p.pointsToNextGrade > 0 && p.pointsToNextGrade <= border) borderList.push({ name: st.name || null, subject: p.subject, score: p.input, grade: p.grade, pointsToNextGrade: p.pointsToNextGrade });
    }
    if (pcts.length) row.avgPercentileEst = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    rows.push(row);
  }
  const subjects = Object.values(per).map((s) => {
    const avg = s.sum / s.n;
    const out = { subject: s.subject, students: s.n, avgScore: r1(avg), gradeDistribution: s.grades };
    if (s.type === "표준점수") {
      out.avgPercentileEst = Math.round(s.pctSum / s.n);
      const p = position(s.subject, Math.round(avg));
      out.classAvgPosition = `반 평균 ${r1(avg)}점은 작년 전국 상위 약 ${p.topPct}% (${p.grade}등급)`;
    }
    out.grade1to2Count = (s.grades[1] || 0) + (s.grades[2] || 0);
    return out;
  });
  borderList.sort((a, b) => a.pointsToNextGrade - b.pointsToNextGrade);
  rows.sort((a, b) => (b.avgPercentileEst ?? -1) - (a.avgPercentileEst ?? -1));
  return {
    source: SRC, basis: BASIS, disclaimer: NOT_PREDICTION,
    studentCount: students.length,
    subjects,
    borderStudents: borderList.slice(0, 100),
    borderNote: `다음 등급까지 ${border}점 이내인 학생·과목. 한두 문제로 등급이 바뀌는 구간이라 우선 관리 대상`,
    students: rows,
    errors: errors.slice(0, 30),
    privacy: "입력한 학생 이름·점수는 계산에만 쓰고 저장하지 않음. 가능하면 이름 대신 번호를 쓸 것",
  };
}

function scorePosition(args) {
  const p = position(args.subject, args.score, { isGrade: args.isGrade });
  const out = { source: SRC, basis: BASIS, ...p, sentence: sentence(p) };
  if (p.scoreType === "표준점수") {
    const d = DIST_BY_GRADE.get(p.subject); const N = d.nm + d.nf;
    const around = [];
    for (let s = p.input + 3; s >= p.input - 3; s--) {
      const r = d.r.find((x) => x[0] === s); if (!r) continue;
      let ab = 0; for (const x of d.r) if (x[0] > s) ab += x[1] + x[2];
      around.push({ score: s, count: r[1] + r[2], topPct: r1(((ab + r[1] + r[2]) / N) * 100, 2), grade: gradeOf(resolve(p.subject), s) });
    }
    out.nearby = around;
  }
  return out;
}

function gradeCuts(args) {
  const exam = args.exam || "both";
  const fmt = (rows) => rows && rows.map((r) => ({ grade: r[0], cut: r[1], count: r[2], pct: r[3] }));
  if (args.subject) {
    const g = resolve(args.subject);
    return {
      source: SRC, subject: g.s, area: g.a, scoreType: isAbs(g) ? "원점수" : "표준점수",
      csat2026: exam !== "mock" ? { examinees: g.n, rows: fmt(g.g) } : undefined,
      mockSep2026: exam !== "csat" && g.m ? { examinees: g.mn, rows: fmt(g.m) } : undefined,
      note: "csat2026 = 2026학년도 수능(2025-11), mockSep2026 = 2026학년도 9월 모의평가(2025-09). cut은 그 등급의 최저 점수",
      more: `${SITE}/grades/?s=${encodeURIComponent(g.s)}`,
    };
  }
  return {
    source: SRC, note: "전 과목 1~3등급 컷 (2026학년도 수능). 과목을 지정하면 9등급 전체와 9월 모의평가를 함께 줌",
    rows: GRADES.filter((g) => !args.area || g.a.includes(args.area)).map((g) => ({ subject: g.s, area: g.a, examinees: g.n, cut1: g.g[0][1], cut2: g.g[1][1], cut3: g.g[2][1], grade1Pct: g.g[0][3] })),
  };
}

function mockVsCsat(args) {
  const rows = GRADES.filter((g) => g.m && (!args.area || g.a.includes(args.area))).map((g) => {
    const c = Number(g.g[0][1]), m = Number(g.m[0][1]);
    return { subject: g.s, area: g.a, csatCut1: g.g[0][1], mockCut1: g.m[0][1], cut1Change: Number.isFinite(c) && Number.isFinite(m) ? c - m : null, csatGrade1Pct: g.g[0][3], mockGrade1Pct: g.m[0][3], grade1PctChange: r1(g.g[0][3] - g.m[0][3], 2) };
  }).sort((a, b) => a.grade1PctChange - b.grade1PctChange);
  return {
    source: SRC,
    note: "2026학년도 9월 모의평가 → 수능 1등급 컷·비율 변화. 1등급 비율이 줄어든 과목일수록 수능에서 상위권이 더 촘촘해졌다는 뜻. 표준점수 컷 상승은 대체로 수능이 더 어려웠다는 신호(응시 집단이 달라 단정은 금물: 9월 모평은 응시 인원이 약 8만 명 적음)",
    rows,
    highlight: `영어 1등급 비율: 9월 모평 ${GRADES.find((g) => g.s === "영어").m[0][3]}% → 수능 ${GRADES.find((g) => g.s === "영어").g[0][3]}%`,
  };
}

function applicantTrends(args) {
  const from = args.fromYear || 1994, to = args.toYear || 2027;
  const yr = (y) => Number(String(y).slice(0, 4));
  const rows = APPS.filter((o) => yr(o.y) >= from && yr(o.y) <= to).map((o) => ({
    year: o.y, examDate: o.date, applicants: o.tot, current: o.jae, graduates: o.jol, gedEtc: o.gum, nonCurrentPct: o.nsu,
    examinees: o.ta, attendancePct: o.rate,
  }));
  const last = APPS[APPS.length - 1];
  const prevMax = APPS.filter((o) => o.y < "2027").reduce((a, b) => (b.nsu > a.nsu ? b : a));
  return {
    source: SRC, note: "학년도 기준(2027학년도 = 2026-11 시행). nonCurrentPct = (졸업생+검정고시 등)/지원자. 2027학년도는 지원자 기준이며 응시자는 시험 후 발표",
    rows,
    highlights: [
      `2027학년도 지원 ${last.tot.toLocaleString()}명 중 졸업생 ${last.jol.toLocaleString()}명, 검정고시 등 ${last.gum.toLocaleString()}명(합 ${last.nsu}%). 1996학년도(37.33%) 이후 가장 높은 비율`,
      `역대 최고 비율은 ${prevMax.y}학년도 ${prevMax.nsu}%`,
      "재종반·N수 수요 설명에 쓸 때는 '지원자 기준'임을 함께 밝힐 것",
    ],
    more: `${SITE}/applicants/`,
  };
}

function subjectTrends() {
  const S = HIST.subj;
  return {
    source: SRC + " · 평가원 응시원서 접수 결과(지원자 기준)",
    korean: S.kor.map(([y, a, b]) => ({ year: y, 화법과작문: a, 언어와매체: b })),
    math: S.math.map(([y, a, b, c]) => ({ year: y, 확률과통계: a, 미적분: b, 기하: c })),
    inquiry: S.tam.map(([y, a, b, c], i) => ({ year: y, 사회탐구만: a, 과학탐구만: b, 사회1과학1: c, counts: S.tamN[i] ? { 사회탐구만: S.tamN[i][1], 과학탐구만: S.tamN[i][2], 사회1과학1: S.tamN[i][3] } : null })),
    highlights: ["사탐만 선택: 2024학년도 48.2% → 2027학년도 69.6% (사탐런)", "과탐만 선택: 232,966명 → 75,036명 (3년 만에 약 3분의 1)", "확률과 통계: 2024학년도 46.7% → 2027학년도 64.9%"],
    note: "단위 %. 2023학년도 탐구 구성, 2022학년도는 자료 미수록",
    more: `${SITE}/subjects/`,
  };
}

function difficultyHistory() {
  return {
    source: SRC + " · 2026학년도 채점 결과 보도",
    topScores: HIST.top.rows.map(([y, k, ga, na, m]) => ({ year: y, 국어최고점: k, 수학가형: ga, 수학나형: na, 수학통합: m })),
    english1Pct: HIST.eng1.map(([y, v]) => ({ year: y, 영어1등급비율: v })),
    perfectScorers: HIST.perfect,
    note: HIST.top.note + " 최고점이 높을수록 평균이 낮은(어려운) 시험. 영어는 2018학년도부터 절대평가(90점 이상 1등급)",
    more: `${SITE}/grades/`,
  };
}

const SCHEDULE_2027 = [
  ["입실 완료", "08:10까지", "1교시 미선택자도 08:10까지 입실"],
  ["1교시 국어", "08:40~10:00 (80분)", "45문항"],
  ["2교시 수학", "10:30~12:10 (100분)", "30문항, 단답형 30%"],
  ["점심", "12:10~13:00", ""],
  ["3교시 영어", "13:10~14:20 (70분)", "45문항, 듣기 17문항은 13:10부터 25분 이내"],
  ["4교시 한국사", "14:50~15:20 (30분)", "필수. 미응시 시 성적 전체 무효"],
  ["4교시 탐구 제1선택", "15:35~16:05 (30분)", "15:20~15:35 문답지 회수·배부(시험 시간에 포함)"],
  ["4교시 탐구 제2선택", "16:07~16:37 (30분)", ""],
  ["5교시 제2외국어/한문", "17:05~17:45 (40분)", "선택"],
];
const AI_RULES_2027 = [
  "모든 전자기기 반입 금지: 휴대전화, 스마트안경, 스마트워치, 스마트반지, 초소형 카메라, 카메라 내장 필기구, 무선 이어폰, 전자시계 등",
  "부득이 가져오면 전원을 끄고 1교시 전에 감독관에게 제출. 안 내고 있다 적발되면 사용 여부와 관계없이 부정행위",
  "1교시 전 안경 전수 점검(책상에 내려놓음), 옷 단추마다 스티커, 양 소매·옷깃 확인. 가방은 교실 밖 복도 보관",
  "08:25~08:30 위급재난문자로 미제출 휴대전화 적발",
  "책상 위에는 수험표·신분증·수능 샤프·컴퓨터용 사인펜 등 허용 물품만. 매 교시 안경 점검, 3교시 전 소지품 재점검, 의심 시 금속탐지기",
  "장신구·모자, 단추 달린 옷은 되도록 피할 것(정부 당부)",
  "사후에도 신고 접수·AI 접속 기록 추적. 적발 시 입학 취소·퇴학, 응시 제한 10년 추진(법 개정·소급은 국회 협의 전, 미확정)",
];
function examDayGuide(args) {
  const out = {
    source: "한국교육과정평가원 2027학년도 수능 실시요강·수험생 유의사항, 2026-11-17 국무총리 대국민 담화",
    examDate: "2026-11-19 (목)", resultDate: "2026-12-11 성적 통지",
    schedule: SCHEDULE_2027.map(([what, time, note]) => ({ what, time, note })),
    aiCheatingRules: AI_RULES_2027,
    asOf: "2026-11-17 발표 기준. 수능 직전 추가 공지가 있을 수 있으니 수능 누리집(suneung.re.kr) 공지를 함께 확인",
    timeline: `${SITE}/ai-cheating/`,
  };
  if (args.format === "notice") {
    const academy = args.academyName ? `${args.academyName}에서 안내드립니다.` : "학원에서 안내드립니다.";
    out.noticeText = [
      `[2027학년도 수능 안내] ${academy}`,
      "■ 일시: 11월 19일(목), 08:10까지 시험실 입실",
      "■ 시간표: 국어 08:40 / 수학 10:30 / 영어 13:10 / 한국사 14:50 / 탐구 15:35·16:07 / 제2외국어 17:05",
      "■ 올해 달라진 점 (AI 부정행위 대책)",
      "- 휴대폰·스마트워치·무선 이어폰 등 전자기기는 가져오지 않는 것이 가장 안전합니다. 가져왔다면 전원을 끄고 1교시 전에 반드시 제출하세요.",
      "- 1교시 전 안경을 책상에 내려놓고 점검하고, 옷 단추에 스티커를 붙이며 소매·옷깃도 확인합니다. 가방은 복도에 둡니다.",
      "- 장신구·모자, 단추가 많은 옷은 피하고 아날로그 시계만 준비하세요.",
      "- 08:25~30에 재난문자를 보냅니다. 켜진 채 내지 않은 휴대폰이 울리면 부정행위로 처리됩니다.",
      "■ 준비물: 수험표, 신분증(실물), 아날로그 시계, 도시락·물",
      "■ 성적 통지: 12월 11일",
      "※ 2026-11-17 정부 발표 기준입니다. 최종 공지는 수능 누리집에서 확인해 주세요.",
    ].join("\n");
  }
  return out;
}

export const SUNEUNG_TOOLS = [
  {
    name: "suneung_analyze_student",
    description:
      "[수능·학원] 학생 한 명의 과목별 점수로 작년(2026학년도) 수능 기준 위치를 해석합니다: 과목별 상위 %, 백분위(추정), 등급, 다음 등급까지 남은 점수, 강·약 과목, 학부모 상담용 문장. 국어·수학·탐구는 표준점수, 영어·한국사는 원점수(또는 grade). 과목은 '생윤·사문·지1' 같은 줄임말도 됩니다. 예: '국어 131, 수학 128, 영어 85, 사문 65, 생윤 66인 학생 상담 자료 만들어줘'",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "학생 이름(선택, 상담 문장에만 사용, 저장 안 함)" },
        scores: { type: "object", description: "과목명: 점수. 예 {\"국어\":131,\"수학\":128,\"영어\":85,\"한국사\":40,\"사문\":65}. 등급으로 넣으려면 {\"영어\":{\"grade\":2}}" },
        borderPoints: { type: "integer", minimum: 1, maximum: 10, description: "다음 등급까지 몇 점 이내를 '경계'로 볼지 (기본 2)" },
      },
      required: ["scores"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_analyze_class",
    description:
      "[수능·학원] 반·학원 전체 학생 점수표(CSV 붙여넣기 또는 배열)를 한 번에 분석합니다: 과목별 평균·평균 백분위·등급 분포, 반 평균의 전국 위치, 다음 등급까지 2점 이내인 '경계 학생' 목록, 학생별 등급표. 작년(2026학년도) 수능 분포 기준. 예: '이 성적표로 우리 반 경계 학생 뽑아줘'",
    inputSchema: {
      type: "object",
      properties: {
        csv: { type: "string", description: "첫 줄 머리글: 이름,국어,수학,영어,한국사,사문,생윤 ... (과목명·줄임말). 빈 칸은 미응시. 쉼표나 탭 구분" },
        students: { type: "array", items: { type: "object" }, description: "csv 대신 [{name, scores:{국어:131, ...}}]" },
        borderPoints: { type: "integer", minimum: 1, maximum: 10, description: "경계 기준 점수 차 (기본 2)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_score_position",
    description:
      "[수능·학원] 한 과목 점수 하나가 작년(2026학년도) 수능에서 몇 등쯤인지: 나보다 높은 인원, 같은 점수 인원, 상위 %, 백분위(추정), 등급, 앞뒤 3점 구간표. 예: '수학 표준점수 125면 상위 몇 %야?'",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "과목 (국어, 수학, 영어, 한국사, 생윤, 지1, 물리학 Ⅰ, 일본어 등)" },
        score: { type: "number", description: "국어·수학·탐구·제2외국어는 표준점수, 영어·한국사는 원점수" },
        isGrade: { type: "boolean", description: "영어·한국사 등 절대평가 과목에서 score를 등급으로 넣었으면 true" },
      },
      required: ["subject", "score"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_grade_cuts",
    description:
      "[수능·학원] 2026학년도 수능 등급컷(등급 구분 점수·인원·비율)과 같은 해 9월 모의평가 등급컷. 과목을 빼면 36개 과목 1~3등급 컷 표. 예: '작년 수능 사문 등급컷', '과탐 1등급 컷 전부'",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "과목 (선택). 없으면 전 과목 요약" },
        area: { type: "string", description: "과목 없이 영역만 거를 때: 국어, 수학, 영어, 한국사, 사회탐구, 과학탐구, 직업탐구, 제2외국어/한문" },
        exam: { type: "string", enum: ["csat", "mock", "both"], description: "csat=수능, mock=9월 모평, both=둘 다(기본)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_mock_vs_csat",
    description:
      "[수능·학원] 2026학년도 9월 모의평가와 실제 수능의 1등급 컷·1등급 비율을 과목별로 비교합니다. '모평보다 수능에서 어려워진 과목' 설명용. 예: '작년 9평이랑 수능 1컷 차이 정리해줘'",
    inputSchema: { type: "object", properties: { area: { type: "string", description: "영역 필터 (선택): 사회탐구, 과학탐구 등" } } },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_applicant_trends",
    description:
      "[수능·학원] 1994~2027학년도 수능 지원자·응시자, 재학생·졸업생·검정고시 구성과 N수 비율, 응시율. 재종반·N수 수요 설명용. 예: '올해 N수생 비율이 역대 몇 번째야?'",
    inputSchema: { type: "object", properties: { fromYear: { type: "integer" }, toYear: { type: "integer" } } },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_subject_trends",
    description:
      "[수능·학원] 국어(화작·언매)·수학(확통·미적·기하)·탐구(사탐만·과탐만·혼합) 선택 비율 2023~2027학년도. 사탐런·확통런 상담용. 예: '사탐런 얼마나 심해졌어?'",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_difficulty_history",
    description:
      "[수능·학원] 역대 수능 난이도 지표: 국어·수학 표준점수 최고점(2017~2026), 영어 1등급 비율(2018~2026), 최근 만점자 수. 예: '불국어였던 해 알려줘'",
    inputSchema: { type: "object", properties: {} },
    annotations: READ_ONLY,
  },
  {
    name: "suneung_exam_day_guide",
    description:
      "[수능·학원] 2027학년도 수능(11/19) 시간표, 입실 시각, 반입 금지 물품, AI 부정행위 대책(11/17 정부 발표), 성적 통지일. format='notice'면 수강생·학부모에게 바로 보낼 안내문을 만들어 줍니다. 예: '우리 학원 이름으로 수능 안내 문자 만들어줘'",
    inputSchema: {
      type: "object",
      properties: {
        format: { type: "string", enum: ["data", "notice"], description: "data=항목 데이터(기본), notice=안내문 텍스트 포함" },
        academyName: { type: "string", description: "안내문에 넣을 학원 이름 (선택)" },
      },
    },
    annotations: READ_ONLY,
  },
];
export const SUNEUNG_TOOL_NAMES = new Set(SUNEUNG_TOOLS.map((t) => t.name));

export async function callSuneungTool(name, args = {}) {
  switch (name) {
    case "suneung_analyze_student": return analyzeStudent(args);
    case "suneung_analyze_class": return analyzeClass(args);
    case "suneung_score_position": return scorePosition(args);
    case "suneung_grade_cuts": return gradeCuts(args);
    case "suneung_mock_vs_csat": return mockVsCsat(args);
    case "suneung_applicant_trends": return applicantTrends(args);
    case "suneung_subject_trends": return subjectTrends();
    case "suneung_difficulty_history": return difficultyHistory();
    case "suneung_exam_day_guide": return examDayGuide(args);
    default: throw new Error(`알 수 없는 수능 도구: ${name}`);
  }
}
