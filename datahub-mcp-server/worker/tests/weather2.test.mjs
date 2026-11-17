import assert from "node:assert/strict";
import { WEATHER2_TOOLS, WEATHER2_TOOL_NAMES, callWeather2Tool } from "../weather2.js";
const called = new Set();
// 이 맥 네트워크에서 api.open-meteo.com(예보 호스트)이 막혀 있을 수 있어 먼저 확인하고, 막혔으면 해당 케이스는 건너뜀
const forecastUp = await fetch("https://api.open-meteo.com/v1/forecast?latitude=37.5&longitude=127&daily=weather_code", { signal: AbortSignal.timeout(8000) }).then((r) => r.ok, () => false);
if (!forecastUp) console.log("SKIP: api.open-meteo.com 연결 불가 → 예보 케이스 건너뜀");
async function t(name, args, check, needsForecast = false) {
  if (needsForecast && !forecastUp) { called.add(name); console.log("skip", name); return; }
  const r = await callWeather2Tool(name, args);
  called.add(name); check(r); console.log("ok", name);
}
assert.equal(WEATHER2_TOOLS.length, 7);
await t("weather_get_forecast", { region: "부산", days: 3, hourly: true }, (r) => {
  assert.equal(r.daily.length, 3); assert.ok(r.daily[0].weather); assert.equal(r.hourly.length, 48);
}, true);
await t("weather_get_forecast", { region: "강릉" }, (r) => assert.ok(r.location.includes("강릉")), true);
await t("weather_get_air_quality", { region: "서울" }, (r) => {
  assert.ok(r.daily.length >= 3); assert.ok(["좋음", "보통", "나쁨", "매우나쁨"].includes(r.daily[0].pm10Grade));
});
await t("weather_geocode", { name: "여수" }, (r) => { assert.ok(r.count > 0); assert.ok(r.results[0].latitude > 33); });
await t("weather_compare_cities", { cities: ["서울", "부산", "대구"], fromDate: "2025-08-01", toDate: "20250831" }, (r) => {
  assert.equal(r.cities.length, 3); assert.equal(r.ranking.warmest.length, 3); assert.ok(r.cities[0].hottestDay.tempMax > 25);
});
await t("weather_monthly_climate", { region: "서울", years: 3, month: 8 }, (r) => {
  assert.equal(r.months.length, 12); assert.ok(r.months[7].avgTemp > r.months[0].avgTemp); assert.equal(r.monthTrend.byYear.length, 3);
});
await t("weather_get_sun_times", { region: "제주", fromDate: "2025-12-01", toDate: "2025-12-03" }, (r) => {
  assert.equal(r.rows.length, 3); assert.ok(r.rows[0].sunrise.startsWith("07")); assert.ok(r.rows[0].daylightHours > 9);
});
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
await t("weather_get_sun_times", { region: "서울", fromDate: today, toDate: today }, (r) => assert.equal(r.rows.length, 1), true);
await t("weather_marine", { spot: "해운대", days: 3 }, (r) => { assert.equal(r.daily.length, 3); assert.ok(r.daily[0].waveHeightMaxM !== null); });
await assert.rejects(() => callWeather2Tool("weather_marine", { latitude: 36.0, longitude: 127.8 }));
await assert.rejects(() => callWeather2Tool("weather_compare_cities", { cities: ["서울"], fromDate: "2025-01-01", toDate: "2025-01-02" }));
assert.deepEqual([...called].sort(), [...WEATHER2_TOOL_NAMES].sort());
console.log("weather2: all 7 tools passed");
