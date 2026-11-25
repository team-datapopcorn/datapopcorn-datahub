// KOSIS(kosis_) 도구 테스트. 가짜 서버로 검색 필터(국제·북한통계 제외)·수치 변환·출처를 확인하고,
// KOSIS_API_KEY 환경변수가 있으면 실서버로 출생아수(DT_1B8000F)를 한 번 조회한다.
import assert from "node:assert/strict";
import { KOSIS_TOOLS, callKosisTool } from "../kosis.js";

assert.equal(KOSIS_TOOLS.length, 4);
const realFetch = globalThis.fetch;
const env = { KOSIS_API_KEY: "TESTKEY" };
globalThis.fetch = async (url) => {
  const u = new URL(url);
  assert.equal(u.searchParams.get("apiKey"), "TESTKEY");
  if (u.pathname.endsWith("statisticsSearch.do")) return Response.json([
    { ORG_ID: "101", ORG_NM: "국가데이터처", TBL_ID: "DT_A", TBL_NM: "국내 표", STAT_ID: "1", VW_CD: "MT_ZTITLE", MT_ATITLE: "인구 > 출생", STAT_DB_CNT: "3" },
    { ORG_ID: "101", ORG_NM: "국가데이터처", TBL_ID: "DT_X", TBL_NM: "아시아 표", VW_CD: "MT_RTITLE01", MT_ATITLE: "아주지역 통계 > 인구" },
    { ORG_ID: "101", ORG_NM: "국가데이터처", TBL_ID: "DT_2", TBL_NM: "OECD 표", VW_CD: "MT_RTITLE", MT_ATITLE: "국제기구별 통계 > OECD" },
  ]);
  if (u.pathname.endsWith("statisticsData.do")) {
    const type = u.searchParams.get("type");
    if (type === "PRD") return Response.json([{ PRD_SE: "년", STRT_PRD_DE: "1970", END_PRD_DE: "2025" }]);
    if (type === "ITM") return Response.json([{ OBJ_ID: "ITEM", ITM_ID: "T1", ITM_NM: "항목" }, { OBJ_ID: "A", OBJ_ID_SN: "1", OBJ_NM: "구분", ITM_ID: "11", ITM_NM: "출생아수(명)" }]);
    if (type === "TBL") return Response.json([{ TBL_NM: "가짜 표" }]);
    return Response.json([]);
  }
  if (u.pathname.endsWith("statisticsParameterData.do")) {
    assert.equal(u.searchParams.get("objL1"), "11+");
    assert.equal(u.searchParams.get("newEstPrdCnt"), "2");
    return Response.json([
      { TBL_NM: "가짜 표", PRD_DE: "2024", ITM_NM: "항목", C1_OBJ_NM: "구분", C1_NM: "출생아수(명)", DT: "238,317", LST_CHN_DE: "2025-10-29" },
      { TBL_NM: "가짜 표", PRD_DE: "2025", ITM_NM: "항목", C1_OBJ_NM: "구분", C1_NM: "출생아수(명)", DT: "-", LST_CHN_DE: "2026-09-21" },
    ]);
  }
  if (u.pathname.endsWith("statisticsExplData.do")) return Response.json([{ statsNm: "인구동향조사" }, { writingPurps: "목적" }]);
  return Response.json({ err: "21", errMsg: "잘못된 요청변수" });
};
const s = await callKosisTool("kosis_search_tables", { query: "출생" }, env);
assert.deepEqual(s.tables.map((t) => t.tblId), ["DT_A"]);
assert.match(s.excluded, /2건 제외/);
const d = await callKosisTool("kosis_get_data", { orgId: "101", tblId: "DT_A", objL1: "11", recent: 2 }, env);
assert.equal(d.rows[0].value, 238317);
assert.equal(d.rows[1].value, null); assert.equal(d.rows[1].raw, "-");
assert.match(d.attribution, /국가데이터처 국가통계포털\(KOSIS\)/);
const i = await callKosisTool("kosis_table_info", { orgId: "101", tblId: "DT_A" }, env);
assert.equal(i.dimensions[0].param, "objL1"); assert.equal(i.items[0].itmId, "T1");
const e = await callKosisTool("kosis_survey_info", { statId: "1962004" }, env);
assert.equal(e.info["조사명"], "인구동향조사");
await assert.rejects(() => callKosisTool("kosis_get_data", { orgId: "101", tblId: "DT A" }, env), /형식/);
await assert.rejects(() => callKosisTool("kosis_search_tables", { query: "x" }, {}), /KOSIS_API_KEY/);
console.log("ok   가짜 서버: 검색 필터, 수치 변환, 표 구조, 조사 설명, 입력 검증");
globalThis.fetch = realFetch;

if (process.env.KOSIS_API_KEY) {
  const live = await callKosisTool("kosis_get_data", { orgId: "101", tblId: "DT_1B8000F", objL1: "11", recent: 2 }, { KOSIS_API_KEY: process.env.KOSIS_API_KEY });
  assert.ok(live.rows.length >= 1 && live.rows[0].value > 100000);
  console.log("ok   실서버: 출생아수", live.rows.map((r) => `${r.period} ${r.value}`).join(", "));
}
console.log("kosis: all 4 tools passed");
