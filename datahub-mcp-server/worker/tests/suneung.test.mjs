import { SUNEUNG_TOOLS, SUNEUNG_TOOL_NAMES, callSuneungTool } from "../suneung.js";
import { run, assert } from "./_h.mjs";
assert(SUNEUNG_TOOLS.length === 9 && SUNEUNG_TOOL_NAMES.size === 9, "9개 아님");
const csv = "이름,국어,수학,영어,한국사,사문,생윤,지1\n김A,131,128,85,40,65,66,\n이B,133,124,92,45,,64,67\n박C,117,111,71,33,58,,60";
await run("suneung", { names: SUNEUNG_TOOL_NAMES, call: callSuneungTool }, [
  ["suneung_score_position", { subject: "국어", score: 133 }, (r) => (assert(r.topPct === 4.67 && r.grade === 1, "국어133=4.67%/1등급 " + r.topPct), r.sentence)],
  ["suneung_score_position", { subject: "수학", score: 128 }, (r) => (assert(r.topPct === 4.62 && r.grade === 1, "수학128 " + r.topPct), r.sentence)],
  ["suneung_score_position", { subject: "수학", score: 147 }, (r) => (assert(r.maxScoreCount === 780, "만점자780"), `국어? out=${r.outOfRange}`)],
  ["suneung_score_position", { subject: "영어", score: 89 }, (r) => (assert(r.grade === 2 && r.pointsToNextGrade === 1, "영어89=2등급"), r.sentence)],
  ["suneung_score_position", { subject: "지1", score: 65 }, (r) => (assert(r.subject === "지구과학 Ⅰ" && r.grade === 1, "지1 65=1등급"), r.sentence)],
  ["suneung_score_position", { subject: "물리학 Ⅰ", score: 60 }, (r) => r.sentence],
  ["suneung_score_position", { subject: "없는과목", score: 50 }, "expectError"],
  ["suneung_analyze_student", { name: "김민준", scores: { 국어: 131, 수학: 128, 영어: 85, 한국사: 40, 사문: 65, 생윤: 66 } }, (r) => (assert(r.subjects.length === 6 && !r.subjects.some((s) => s.error), "6과목"), "\n" + r.counselingNote)],
  ["suneung_analyze_student", { scores: { 영어: { grade: 2 }, 국어: 120 } }, (r) => r.subjects.map((s) => s.subject + s.grade).join(",")],
  ["suneung_analyze_class", { csv }, (r) => (assert(r.studentCount === 3 && r.subjects.length === 7, "3명7과목 " + r.subjects.length), JSON.stringify(r.borderStudents.slice(0, 4)) + " | " + r.subjects.map((s) => s.subject + ":" + (s.classAvgPosition || s.avgScore)).join(" / "))],
  ["suneung_analyze_class", {}, "expectError"],
  ["suneung_grade_cuts", { subject: "사문" }, (r) => (assert(r.csat2026.rows.length === 9 && r.mockSep2026.rows.length === 9, "9"), `사문 1컷 ${r.csat2026.rows[0].cut} 9월 ${r.mockSep2026.rows[0].cut}`)],
  ["suneung_grade_cuts", { area: "과학탐구" }, (r) => (assert(r.rows.length === 8, "과탐8"), r.rows.map((x) => x.subject + x.cut1).join(","))],
  ["suneung_mock_vs_csat", {}, (r) => (assert(r.rows.length === 36, "36 " + r.rows.length), r.highlight + " | " + r.rows.slice(0, 3).map((x) => x.subject + x.grade1PctChange).join(","))],
  ["suneung_applicant_trends", { fromYear: 2020 }, (r) => (assert(r.rows.at(-1).applicants === 551864, "2027"), r.highlights[0] + " / " + r.highlights[1])],
  ["suneung_subject_trends", {}, (r) => (assert(r.inquiry.at(-1).사회탐구만 === 69.6, "69.6"), "ok")],
  ["suneung_difficulty_history", {}, (r) => (assert(r.english1Pct.length === 9, "9"), "ok")],
  ["suneung_exam_day_guide", { format: "notice", academyName: "데이터팝콘학원" }, (r) => (assert(r.noticeText.includes("데이터팝콘학원"), "name"), "\n" + r.noticeText)],
]);
