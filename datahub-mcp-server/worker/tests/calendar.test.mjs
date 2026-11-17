import assert from "node:assert/strict";
import { CAL_TOOLS, CAL_TOOL_NAMES, callCalTool } from "../calendar.js";
const called = new Set();
async function t(name, args, check) {
  const r = await callCalTool(name, args);
  called.add(name); check(r); console.log("ok", name);
}
assert.equal(CAL_TOOLS.length, 5);
await t("cal_holidays", { year: 2026 }, (r) => { assert.ok(r.count >= 15); assert.ok(r.holidays.some((h) => h.name === "추석")); });
await t("cal_holidays", { year: 2026, countryCode: "us" }, (r) => assert.ok(r.count >= 10));
// 2026-09: 30일, 주말 8일, 평일 추석 24·25(목·금) → 20영업일
await t("cal_business_days", { from: "2026-09-01", to: "20260930" }, (r) => {
  assert.equal(r.calendarDays, 30); assert.equal(r.businessDays, 20); assert.equal(r.holidaysOnWeekdays.length, 2);
});
// 2026-09-23(수) + 1영업일 → 24·25 추석, 26·27 주말 → 2026-09-28(월)
await t("cal_add_business_days", { date: "2026-09-23", days: 1 }, (r) => { assert.equal(r.result, "2026-09-28"); assert.equal(r.skippedHolidays.length, 2); });
await t("cal_add_business_days", { date: "2026-09-28", days: -1 }, (r) => assert.equal(r.result, "2026-09-23"));
await t("cal_date_info", { date: "2026-12-25" }, (r) => {
  assert.equal(r.weekday, "금요일"); assert.equal(r.isHoliday, true); assert.equal(r.quarter, 4); assert.equal(r.dayOfYear, 359); assert.equal(r.isoWeek, 52);
});
await t("cal_date_info", {}, (r) => assert.equal(r.daysFromToday, 0));
await t("cal_date_diff", { from: "2026-01-31", to: "2026-03-15" }, (r) => {
  assert.equal(r.days, 43); assert.deepEqual(r.monthsAndDays, { months: 1, days: 15 }); assert.deepEqual(r.weeks, { weeks: 6, days: 1 });
});
await t("cal_date_diff", { from: "2026-03-15", to: "2026-01-31" }, (r) => assert.equal(r.days, -43));
await assert.rejects(() => callCalTool("cal_date_info", { date: "2026-02-30" }));
assert.deepEqual([...called].sort(), [...CAL_TOOL_NAMES].sort());
console.log("calendar: all 5 tools passed");
