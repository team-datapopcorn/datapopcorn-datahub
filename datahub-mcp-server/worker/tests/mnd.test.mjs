// 국방부 병영식단(mil_) 도구 테스트. 실제 인증키가 있으면(MND_OPENAPI_KEY) 실서버, 없으면 국방부 응답 형식을 흉내 낸 가짜 서버로 로직을 확인한다.
// 파싱은 국방부 sample 키의 실제 응답(첫 5행)으로도 확인한다.
import assert from "node:assert/strict";
import { MND_TOOLS, MND_TOOL_NAMES, MND_UNITS, callMndTool, parseDish, rowDate, findUnit } from "../mnd.js";

const UA = { "user-agent": "Mozilla/5.0 (compatible; DataPopcornDataMCP-test)" };
const called = new Set();
assert.equal(MND_TOOLS.length, 4);
assert.equal(MND_UNITS.length, 34);
assert.equal(findUnit("육군훈련소").code, "ATC");
assert.equal(findUnit("논산 훈련소").code, "ATC");
assert.equal(findUnit("제5322부대").code, "5322");
assert.throws(() => findUnit("9999부대"));
assert.equal(rowDate("2025-05-30(금)"), "20250530");
assert.deepEqual(parseDish("깍두기(임가공)"), { name: "깍두기(임가공)", allergens: [] });
assert.deepEqual(parseDish("닭강정(05)(06)(12)(15)").allergens.map((a) => a.name), ["대두", "밀", "토마토", "닭고기"]);

// 1) 실제 sample 응답 형식 확인 (네트워크)
const sres = await fetch("https://openapi.mnd.go.kr/sample/json/DS_TB_MNDT_DATEBYMLSVC_ATC/1/5/", { headers: UA });
const sample = await sres.json();
const srow = sample.DS_TB_MNDT_DATEBYMLSVC_ATC.row;
assert.ok(srow.length === 5 && rowDate(srow[0].dates) && "lunc" in srow[0] && "sum_cal" in srow[0]);
console.log("ok   sample 응답 형식(육군훈련소)", srow[0].dates, parseDish(srow[0].lunc)?.name);

assert.equal(rowDate("2026-11-9(월)"), "20261109");
assert.equal(rowDate("20180712"), "20180712");

// 2) 키 없을 때: 국방부 개방포털 공개 JSON 다운로드(월 단위 필터)로 조회. 실제 네트워크.
{
  const r = await callMndTool("mil_get_meals", { unit: "ATC", fromDate: "2026-11-01", toDate: "2026-11-07" }, {});
  assert.equal(r.source, "mnd-opendata");
  assert.ok(r.dayCount >= 1 && r.days[0].meals, "포털 경로로 육군훈련소 11월 첫 주 식단을 받아야 함");
  console.log("ok   포털(키 없음) mil_get_meals ATC 2026-11-01~07", r.dayCount + "일", r.days[0].date, r.days[0].totalKcal + "kcal");
  const e = await callMndTool("mil_get_meals", { unit: "7652", fromDate: "2027-06-01", toDate: "2027-06-03" }, {});
  assert.equal(e.dayCount, 0);
  assert.ok(e.note);
  console.log("ok   포털(키 없음) 빈 달은 오류 없이 안내");
}

// 3) 가짜 서버(포털 장애 → OpenAPI 대체 경로, 키 있음): ATC는 오름차순 2500행, 5322는 내림차순(최신이 앞)
function makeRows(n, newestFirst) {
  const rows = [];
  const start = Date.UTC(2026, 0, 1);
  const days = Math.ceil(n / 5);
  for (let d = 0; d < days; d++) {
    const date = new Date(start + d * 864e5).toISOString().slice(0, 10) + "(금)";
    const dishes = [["쌀밥", "백미밥", "쌀밥", "", "300kcal"], ["소고기무국(05)(16)", "제육볶음(05)(06)(10)", "닭강정(05)(06)(12)(15)", "", "250kcal"], ["배추김치(09)", "새우튀김(01)(06)(09)", "깍두기", "츄러스(02)(06)", "50kcal"], ["", "인절미꿔바로우(05)(06)(10)", "", "", "200kcal"], ["우유(02)", "", "", "", "130kcal"]];
    for (const [b, l, dn, ex, c] of dishes) rows.push({ dates: date, brst: b, brst_cal: b ? c : "", lunc: l, lunc_cal: l ? c : "", dinr: dn, dinr_cal: dn ? c : "", adspcfd: ex, adspcfd_cal: ex ? "180kcal" : "", sum_cal: "3200.5kcal" });
  }
  rows.length = n;
  return newestFirst ? rows.reverse() : rows;
}
const DB = { DS_TB_MNDT_DATEBYMLSVC_ATC: makeRows(2500, false), DS_TB_MNDT_DATEBYMLSVC_5322: makeRows(1600, true) };
let calls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  calls++;
  // 포털 다운로드는 장애로 가정 → 인증키가 있으면 OpenAPI 전체 조회로 대체되는지 확인
  if (String(url).includes("opendata.mnd.go.kr")) return new Response("", { status: 503 });
  const m = String(url).match(/openapi\.mnd\.go\.kr\/([^/]+)\/json\/([^/]+)\/(\d+)\/(\d+)\//);
  assert.ok(m, "URL 형식");
  const [, key, svc, s, e] = m;
  if (key !== "TESTKEY") return new Response(JSON.stringify({ RESULT: { CODE: "INFO-100", MESSAGE: "인증키가 유효하지 않습니다." } }));
  const all = DB[svc];
  if (!all) return new Response(JSON.stringify({ RESULT: { CODE: "INFO-200", MESSAGE: "해당하는 데이터가 없습니다." } }));
  return new Response(JSON.stringify({ [svc]: { list_total_count: all.length, row: all.slice(+s - 1, +e) } }));
};
const env = { MND_OPENAPI_KEY: "TESTKEY" };
async function t(name, args, check) { const r = await callMndTool(name, args, env); called.add(name); assert.match(r.source, /^mnd-/); check(r); console.log("ok  ", name, JSON.stringify(args)); }

await t("mil_list_units", { query: "훈련소" }, (r) => { assert.equal(r.count, 1); assert.equal(r.units[0].code, "ATC"); });
await t("mil_list_units", {}, (r) => assert.equal(r.count, 34));
await t("mil_get_meals", { unit: "육군훈련소", fromDate: "2026-06-01", toDate: "2026-06-03" }, (r) => {
  assert.equal(r.dayCount, 3); const d = r.days[0];
  assert.equal(d.date, "2026-06-01"); assert.equal(d.totalKcal, 3200.5);
  assert.deepEqual(d.meals["중식"].dishes.map((x) => x.name), ["백미밥", "제육볶음", "새우튀김", "인절미꿔바로우"]);
  assert.equal(d.meals["중식"].kcal, 800); assert.ok(d.meals["증특식"]);
});
await t("mil_get_meals", { unit: "5322", date: "20260215", meal: "중식" }, (r) => {
  assert.equal(r.dayCount, 1); assert.deepEqual(Object.keys(r.days[0].meals), ["중식"]);
});
await t("mil_get_meals", { unit: "ATC", date: "2028-01-01" }, (r) => { assert.equal(r.dayCount, 0); assert.ok(r.note); });
await t("mil_compare_meals", { units: ["ATC", "5322", "7652"], date: "2026-02-15", meal: "중식" }, (r) => {
  assert.equal(r.units.length, 3); assert.ok(r.units[0].meals["중식"]); assert.ok(r.units[1].meals["중식"]); assert.equal(r.units[2].note, "이 날짜 식단 없음");
});
await t("mil_meal_allergen_check", { unit: "ATC", date: "2026-06-01", allergens: ["새우", 4] }, (r) => {
  const l = r.days[0].meals["중식"];
  assert.deepEqual(l.avoid.map((x) => x.name), ["새우튀김"]); assert.ok(l.safe.includes("제육볶음"));
});
await assert.rejects(() => callMndTool("mil_get_meals", { unit: "ATC", fromDate: "2026-01-01", toDate: "2026-03-01" }, env), /최대 31일/);
await assert.rejects(() => callMndTool("mil_meal_allergen_check", { unit: "ATC", date: "2026-06-01", allergens: ["초콜릿"] }, env));
await assert.rejects(() => callMndTool("mil_get_meals", { unit: "ATC", date: "2026-06-01" }, { MND_OPENAPI_KEY: "BAD" }), /INFO-100/);
globalThis.fetch = realFetch;
assert.deepEqual([...called].sort(), [...MND_TOOL_NAMES].sort());
console.log(`mnd: all ${MND_TOOLS.length} tools passed (mock API calls: ${calls})`);
