// 실행: node tests/stats.test.mjs
import assert from "node:assert/strict";
import { STATS_TOOLS, STATS_TOOL_NAMES, callStatsTool } from "../stats.js";

const near = (a, b, tol = 1e-3, msg = "") => assert.ok(Math.abs(a - b) <= tol, `${msg} expected ${b}, got ${a}`);
const called = new Set();
const call = async (n, a) => { called.add(n); return callStatsTool(n, a); };
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; };

// R sleep 데이터 (group1, group2)
const g1 = [0.7, -1.6, -0.2, -1.2, -0.1, 3.4, 3.7, 0.8, 0.0, 2.0];
const g2 = [1.9, 0.8, 1.1, 0.1, -0.1, 4.4, 5.5, 1.6, 4.6, 3.4];

await test("describe", async () => {
  const r = await call("stats_describe", { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  near(r.mean, 5.5); near(r.median, 5.5); near(r.std, 3.0277); near(r.q1, 3.25); near(r.q3, 7.75); near(r.skewness, 0);
  const s = await call("stats_describe", { values: ["1,200", "1,500", "900", 30000] });
  assert.equal(s.max, 30000); assert.ok(s.skewness > 1);
});
await test("percentile", async () => {
  const r = await call("stats_percentile", { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], percentiles: [50, 90] });
  near(r.percentiles[0].value, 5.5); near(r.percentiles[1].value, 9.1);
});
await test("histogram", async () => {
  const r = await call("stats_histogram", { values: [21, 25, 33, 38, 41, 45, 47, 52, 58, 63], width: 10 });
  assert.equal(r.histogram.reduce((a, b) => a + b.count, 0), 10);
  const r2 = await call("stats_histogram", { values: [1, 2, 3, 4, 5, 6, 7, 8], bins: 4 });
  assert.deepEqual(r2.histogram.map((b) => b.count), [2, 2, 2, 2]);
});
await test("outliers", async () => {
  const v = [10, 12, 11, 13, 12, 11, 10, 12, 13, 11, 12, 11, 10, 12, 95];
  const r = await call("stats_zscore_outliers", { values: v });
  assert.equal(r.iqrOutliers[0].index, 14); assert.equal(r.zOutliers[0].index, 14);
});
await test("welch ttest (R: t=-1.8608, df=17.776, p=0.07939)", async () => {
  const r = await call("stats_ttest", { a: g1, b: g2 });
  near(r.t, -1.8608); near(r.df, 17.776, 2e-3); near(r.pValue, 0.07939, 2e-4);
  near(r.ci.lower, -3.3654832, 2e-3); near(r.ci.upper, 0.2054832, 2e-3);
});
await test("paired ttest (R: t=-4.0621, p=0.002833)", async () => {
  const r = await call("stats_paired_ttest", { before: g2, after: g1 });
  near(r.t, -4.0621); assert.equal(r.df, 9); near(r.pValue, 0.002833, 2e-5);
});
await test("ab test", async () => {
  const r = await call("stats_ab_test_proportions", { conversionsA: 200, visitorsA: "2,000", conversionsB: 250, visitorsB: 2000 });
  near(r.z, 2.502, 2e-3); near(r.pValue, 0.01235, 3e-4); assert.equal(r.significant, true); near(r.relLiftPct, 25);
});
await test("sample size", async () => {
  const r = await call("stats_sample_size", { baselineRate: 0.1, mde: 0.02 });
  assert.equal(r.perGroup, 3841);
  const r2 = await call("stats_sample_size", { baselineRate: 10, mde: 20, mdeType: "relative" });
  assert.equal(r2.perGroup, 3841);
});
await test("CI wilson + mean", async () => {
  const r = await call("stats_confidence_interval", { successes: 81, n: 263 });
  near(r.lower, 0.2553, 2e-4); near(r.upper, 0.3662, 2e-4);
  const m = await call("stats_confidence_interval", { values: g1 }); // R t.test(g1): 95% CI -0.5297804 2.0297804
  near(m.lower, -0.5298, 2e-4); near(m.upper, 2.0298, 2e-4);
});
await test("chi-square", async () => {
  const r = await call("stats_chi_square", { table: [[10, 20], [30, 40]] });
  near(r.chiSquare, 0.7937); near(r.pValue, 0.3730, 2e-4); assert.equal(r.df, 1);
  const y = await call("stats_chi_square", { table: [[10, 20], [30, 40]], yates: true }); // R chisq.test: X2=0.44643, p=0.504
  near(y.chiSquare, 0.4464); near(y.pValue, 0.504, 1e-3);
});
await test("anova (F=27, p=0.001)", async () => {
  const r = await call("stats_anova_oneway", { groups: { a: [1, 2, 3], b: [4, 5, 6], c: [7, 8, 9] } });
  near(r.F, 27); near(r.pValue, 0.001, 1e-5); near(r.etaSquared, 0.9);
});
await test("regression", async () => {
  const r = await call("stats_linear_regression", { x: [1, 2, 3, 4, 5], y: [2, 4, 5, 4, 5], newX: [6] });
  near(r.coefficients[0].estimate, 2.2); near(r.coefficients[1].estimate, 0.6); near(r.rSquared, 0.6); near(r.predictions[0].y, 5.8);
  near(r.coefficients[1].pValue, 0.1240, 2e-4); // R summary(lm): slope p = 0.124
  const xs = [[1, 2], [2, 1], [3, 4], [4, 3], [5, 6], [6, 5]], y = xs.map(([a, b]) => 1 + 2 * a + 3 * b);
  const m = await call("stats_linear_regression", { x: xs, y: y.map((v, i) => v + (i % 2 ? 0.01 : -0.01)), xNames: ["광고", "가격"] });
  near(m.coefficients[1].estimate, 2, 0.05); near(m.coefficients[2].estimate, 3, 0.05); assert.ok(m.rSquared > 0.999);
});
await test("corr matrix", async () => {
  const r = await call("stats_correlation_matrix", { series: { a: [1, 2, 3, 4, 5], b: [2, 4, 6, 8, 10], c: [5, 4, 3, 2, 1] } });
  near(r.matrix.a.b, 1); near(r.matrix.a.c, -1);
});
await test("moving average", async () => {
  const r = await call("stats_moving_average", { values: [1, 2, 3, 4, 5], window: 3 });
  assert.equal(r.rows[1].sma, null); near(r.rows[2].sma, 2); near(r.rows[4].sma, 4); near(r.rows[1].ema, 1.5);
});
await test("growth", async () => {
  const r = await call("stats_growth_rates", { values: [100, 110, 121], lag: 2 });
  near(r.rows[1].popPct, 10); near(r.rows[2].lagPct, 21); near(r.cagrPerPeriodPct, 10);
  const r2 = await call("stats_growth_rates", { values: [100, 121], periodsPerYear: 1 });
  near(r2.cagrAnnualPct, 21);
});
await test("forecast", async () => {
  const lin = Array.from({ length: 12 }, (_, i) => 10 + 2 * i);
  const r = await call("stats_forecast", { values: lin, horizon: 3 });
  near(r.forecast[0], 34, 0.5); near(r.forecast[2], 38, 0.5);
  const season = [0, 5, 10, 5];
  const sv = Array.from({ length: 24 }, (_, i) => 100 + i + season[i % 4]);
  const h = await call("stats_forecast", { values: sv, horizon: 4, seasonLength: 4 });
  assert.equal(h.model, "Holt-Winters additive");
  sv.push(...[24, 25, 26, 27].map((i) => 100 + i + season[i % 4]));
  h.forecast.forEach((f, i) => near(f, sv[24 + i], 2, `hw step ${i}`));
  assert.ok(h.fitMapePct < 2);
});
await test("seasonality", async () => {
  const dates = [], values = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(Date.UTC(2026, 10, 2 + i)); // 2026-11-02 월
    dates.push(d.toISOString().slice(0, 10));
    values.push([0, 6].includes(d.getUTCDay()) ? 200 : 100);
  }
  const r = await call("stats_seasonality", { dates, values });
  assert.equal(r.strongestPattern, "요일");
  assert.ok(r.weekday.find((w) => w.key === "토").index > 1.5);
});
await test("margin of error", async () => {
  const r = await call("stats_margin_of_error", { n: 1000 });
  near(r.moe, 0.031, 2e-4);
  const r2 = await call("stats_margin_of_error", { targetMoe: 3 });
  assert.equal(r2.requiredN, 1068); // 1067.07 → 올림
  const r3 = await call("stats_margin_of_error", { n: 500, population: 1000 });
  assert.ok(r3.moe < 0.0438 && r3.fpc < 1);
});
await test("input errors", async () => {
  await assert.rejects(() => callStatsTool("stats_describe", { values: ["abc"] }), /숫자가 아닙니다/);
  await assert.rejects(() => callStatsTool("stats_paired_ttest", { before: [1, 2], after: [1, 2, 3] }), /길이/);
});

assert.equal(STATS_TOOLS.length, 18);
for (const n of STATS_TOOL_NAMES) assert.ok(called.has(n), `not tested: ${n}`);
console.log(`stats: ${pass} tests passed, ${called.size}/18 tools covered`);
