import assert from "node:assert/strict";
import { NEIS2_TOOLS, NEIS2_TOOL_NAMES, callNeis2Tool } from "../neis2.js";
const env = process.env.NEIS_API_KEY ? { NEIS_API_KEY: process.env.NEIS_API_KEY } : {};
const S = { officeCode: "B10", schoolCode: "7010057" }; // 가락고등학교
const called = new Set();
async function t(name, args, check) {
  const r = await callNeis2Tool(name, args, env);
  called.add(name);
  check(r);
  console.log("ok", name);
}
assert.equal(NEIS2_TOOLS.length, 7);
await t("neis_get_school_schedule", { ...S, month: "2026-03" }, (r) => {
  assert.ok(r.events.length > 0); assert.ok(r.events.some((e) => e.name.includes("3·1절")));
});
await t("neis_get_timetable", { schoolLevel: "고", ...S, grade: "1", className: "1", fromDate: "2026-11-02", toDate: "20261106" }, (r) => {
  assert.ok(r.days.length > 0); assert.ok(r.days[0].periods[0].subject);
});
await t("neis_get_class_info", { ...S, year: "2026", grade: "1" }, (r) => assert.ok(r.grades[0].classCount >= 1));
await t("neis_get_school_majors", S, (r) => assert.ok(r.majors.length >= 1));
await t("neis_search_academies", { officeCode: "B10", zone: "강남구", limit: 10 }, (r) => {
  assert.ok(r.academies.length > 0); assert.ok(r.academies[0].name); assert.ok(r.total > 10);
});
await t("neis_get_meal_nutrition", { ...S, fromDate: "2026-11-02", toDate: "2026-11-06" }, (r) => {
  const m = r.meals[0];
  assert.ok(m.dishes.length > 0 && !/\(\d/.test(m.dishes.join(""))); assert.ok(m.caloriesKcal > 0);
  assert.ok(typeof m.nutrition["단백질(g)"] === "number"); assert.ok(m.origin["쌀"]);
});
await t("neis_meal_allergen_check", { ...S, date: "2026-11-02", allergens: ["돼지고기", 5] }, (r) => {
  assert.ok(r.meals[0].avoid.some((d) => d.name.includes("불고기"))); assert.ok(r.meals[0].safe.length > 0);
});
await assert.rejects(() => callNeis2Tool("neis_meal_allergen_check", { ...S, date: "20261102", allergens: ["초콜릿"] }, env));
await assert.rejects(() => callNeis2Tool("neis_get_timetable", { schoolLevel: "대", ...S, fromDate: "2026-11-02", toDate: "2026-11-02" }, env));
assert.deepEqual([...called].sort(), [...NEIS2_TOOL_NAMES].sort());
console.log("neis2: all 7 tools passed");
