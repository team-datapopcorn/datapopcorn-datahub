// 실제 data.go.kr 호출 테스트. 실행: DATAGOKR_KEY=... node tests/kma.test.mjs (키는 출력하지 않음)
import { KMA_TOOLS, KMA_TOOL_NAMES, callKmaTool, latLonToGrid, sunTimes } from "../kma.js";
const env = { DATAGOKR_KEY: process.env.DATAGOKR_KEY };
const assert = (c, m) => { if (!c) throw new Error(m); };
const redact = (s) => String(s).replace(/serviceKey=[^&\s]+/g, "serviceKey=***");
assert(KMA_TOOLS.length === 8 && KMA_TOOL_NAMES.size === 8, "8개 아님");
for (const t of KMA_TOOLS) assert(t.description.startsWith("[날씨]") && t.inputSchema && t.annotations.readOnlyHint, "정의 " + t.name);
// 오프라인 기준값
const g = (a, b) => JSON.stringify(latLonToGrid(a, b));
assert(g(37.5735, 126.979) === '{"nx":60,"ny":127}' && g(35.1798, 129.075) === '{"nx":98,"ny":76}' && g(33.4996, 126.5312) === '{"nx":53,"ny":38}', "격자");
const s1 = sunTimes(Date.UTC(2026, 5, 21), 37.5665, 126.978), s2 = sunTimes(Date.UTC(2026, 11, 22), 37.5665, 126.978);
const mins = (t) => +t.slice(0, 2) * 60 + +t.slice(3);
assert(Math.abs(mins(s1.sunrise) - mins("05:11")) <= 2 && Math.abs(mins(s1.sunset) - mins("19:57")) <= 2 && Math.abs(mins(s2.sunrise) - mins("07:43")) <= 2 && Math.abs(mins(s2.sunset) - mins("17:17")) <= 2, "일출일몰");

const cases = [
  ["weather_find_location", { region: "강릉시" }, (r) => (assert(r.nx > 0 && r.nearestAsosStation.name.includes("강릉") && r.dustForecastRegion === "영동", "강릉"), `${r.location} ${r.nx},${r.ny} ${r.nearestAsosStation.name} ${r.dustForecastRegion}`)],
  ["weather_find_location", { region: "경기도 고양시" }, (r) => (assert(r.dustForecastRegion === "경기북부", "고양"), `${r.location} ${r.nx},${r.ny} ${r.nearestAsosStation.name}`)],
  ["weather_get_daily", { region: "서울", fromDate: "2026-10-01", toDate: "2026-10-31" }, (r) => (assert(r.count === 31 && r.station.stnId === 108 && r.summary.tempAvg > 5 && r.summary.tempAvg < 25, "daily"), JSON.stringify(r.summary))],
  ["weather_get_forecast", { region: "부산", hourly: true }, (r) => (assert(r.daily.length >= 2 && r.nx === 98 && r.hourly.length > 10, "fcst"), `${r.발표} ${JSON.stringify(r.daily[1])} 현재 ${JSON.stringify(r.현재)}`)],
  ["weather_get_air_quality", { region: "종로구" }, (r) => (assert(r.측정소수 > 5 && r.시도평균.pm10 != null, "air"), `${r.sidoName} pm10 ${r.시도평균.pm10}(${r.시도평균.pm10등급}) pm25 ${r.시도평균.pm25} 예보 ${JSON.stringify(r.예보.slice(0, 2))}`)],
  ["weather_get_air_quality", { stationName: "종로구" }, (r) => (assert(r.rows.length > 0, "station"), JSON.stringify(r.rows[0]))],
  ["weather_compare_cities", { cities: ["서울", "부산", "대구"], fromDate: "2026-07-01", toDate: "2026-08-31" }, (r) => (assert(r.cities.length === 3 && r.cities.every((c) => c.days === 62), "compare"), JSON.stringify(r.ranking))],
  ["weather_monthly_climate", { region: "서울", years: 10, month: 12 }, (r) => (assert(r.months[0].tempAvg < 3 && r.months[7].tempAvg > 23 && r.focusMonthByYear.length === 10, "climate"), `1월 ${r.months[0].tempAvg} 8월 ${r.months[7].tempAvg}`)],
  ["weather_get_sun_times", { region: "강릉시", fromDate: "2026-12-30", toDate: "2027-01-02" }, (r) => (assert(r.rows.length === 4, "sun"), JSON.stringify(r.rows[2]))],
  ["weather_marine", { spot: "해운대" }, (r) => (assert(r.daily.some((d) => d.최대파고m != null), "marine"), JSON.stringify(r.daily[0]))],
];
const done = new Set();
let fail = 0;
for (const [name, args, check] of cases) {
  try { const r = await callKmaTool(name, args, env); console.log("ok  ", name, check(r)); done.add(name); }
  catch (e) { fail++; console.log("FAIL", name, redact(e.message)); }
}
// 모든 해상 프리셋에서 파고가 나오는지
for (const spot of ["해운대 앞바다", "강릉 경포 앞바다", "제주 중문 앞바다", "속초 앞바다", "태안 만리포 앞바다", "목포 앞바다"]) {
  try { const r = await callKmaTool("weather_marine", { spot }, env); assert(r.daily.some((d) => d.최대파고m != null), spot); }
  catch (e) { fail++; console.log("FAIL marine", spot, redact(e.message)); }
}
// 잘못된 입력은 한국어 오류
for (const [name, args] of [["weather_get_daily", { region: "없는도시xyz", fromDate: "2026-10-01", toDate: "2026-10-02" }], ["weather_get_daily", { fromDate: "2099-01-01", toDate: "2099-01-02" }], ["weather_get_forecast", {}]]) {
  try { const r = await callKmaTool(name, args, name === "weather_get_forecast" ? {} : env); fail++; console.log("FAIL expected error", name); }
  catch (e) { console.log("ok   (expected error)", name, e.message.slice(0, 60)); }
}
const missing = [...KMA_TOOL_NAMES].filter((n) => !done.has(n));
if (missing.length) { fail++; console.log("not covered", missing); }
console.log(fail ? `kma: ${fail} failed` : `kma: all 8 tools passed`);
if (fail) process.exit(1);
