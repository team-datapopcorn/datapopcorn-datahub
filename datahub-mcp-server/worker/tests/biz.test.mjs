import assert from "node:assert/strict";
import { BIZ_TOOLS, BIZ_TOOL_NAMES, callBizTool as c } from "../biz.js";

const called = new Set();
const t = async (name, args) => { called.add(name); return c(name, args); };
const eq = (a, b, m) => assert.deepEqual(a, b, m ?? `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);

eq(BIZ_TOOLS.length, 16); eq(BIZ_TOOL_NAMES.size, 16);
for (const tool of BIZ_TOOLS) { assert.match(tool.description, /^\[비즈니스\]/); assert.equal(tool.inputSchema.type, "object"); }

let r = await t("biz_funnel_conversion", { steps: [{ name: "방문", count: "10,000" }, { name: "장바구니", count: 1200 }, { name: "결제", count: 300 }] });
eq(r.steps[1].stepConversionPct, 12); eq(r.steps[2].stepConversionPct, 25); eq(r.overallConversionPct, 3); eq(r.biggestDropOff.from, "방문"); eq(r.biggestDropOff.dropOffPct, 88);

r = await t("biz_cohort_retention", { period: "week", events: [
  { userId: "u1", date: "2026-11-02" }, { userId: "u1", date: "2026-11-09" }, { userId: "u2", date: "2026-11-03" },
  { userId: "u3", date: "2026-11-09" }, { userId: "u3", date: "2026-11-10" }] });
eq(r.cohorts[0], { cohort: "2026-11-02", size: 2, retentionPct: [100, 50] }); eq(r.cohorts[1].retentionPct, [100, null]); eq(r.averageRetentionPct, [100, 50]);
r = await c("biz_cohort_retention", { matrix: [{ cohort: "1월", counts: [100, 40, 30] }, { cohort: "2월", counts: [200, 60] }] });
eq(r.averageRetentionPct, [100, 33.3, 30]);

r = await t("biz_rfm_segment", { asOfDate: "2026-11-10", transactions: [
  { customerId: "c1", date: "2026-11-10", amount: 50000 }, { customerId: "c1", date: "2026-11-01", amount: 30000 }, { customerId: "c1", date: "2026-10-20", amount: 20000 },
  { customerId: "c2", date: "2026-06-01", amount: 10000 }, { customerId: "c3", date: "2026-10-01", amount: 15000 }, { customerId: "c3", date: "2026-09-01", amount: 15000 }] });
const c1 = r.topCustomers.find((x) => x.customerId === "c1"), c2 = r.topCustomers.find((x) => x.customerId === "c2");
eq([c1.R, c1.F, c1.M, c1.segment, c1.recencyDays, c1.monetary], [4, 4, 4, "챔피언", 0, 100000]); eq(c2.segment, "휴면"); eq(c2.recencyDays, 162);

r = await t("biz_pareto_abc", { items: [["A", 50], ["B", 30], ["C", 10], ["D", 5], ["E", 3], ["F", 2]].map(([name, value]) => ({ name, value })) });
eq(r.items.map((x) => x.class).join(""), "AABBCC"); eq(r.top20PctItems, 2); eq(r.top20PctSharePct, 80);

r = await t("biz_ltv_cac", { arpu: "30,000", grossMarginPct: 70, monthlyChurnPct: 5, cac: 200000 });
eq([r.ltv, r.ltvToCac, r.cacPaybackMonths, r.avgLifetimeMonths], [420000, 2.1, 9.5, 20]); assert.match(r.verdict, /약함/);

r = await t("biz_break_even", { fixedCosts: 5000000, unitPrice: 20000, unitVariableCost: 8000, expectedUnits: 500 });
eq([r.breakEvenUnits, r.breakEvenRevenue, r.expectedProfit, r.marginOfSafetyPct], [417, 8333333, 1000000, 16.7]);
await assert.rejects(c("biz_break_even", { fixedCosts: 1, unitPrice: 5, unitVariableCost: 6 }));

r = await t("biz_unit_economics", { price: 29000, cogs: 9000, shippingCost: 3000, platformFeePct: 5.6, adCostPerOrder: 4000 });
eq([r.netRevenue, r.vat, r.costs.platformFee, r.contributionMarginBeforeAd, r.contributionMargin, r.contributionMarginPct], [26364, 2636, 1624, 12740, 8740, 33.2]);

r = await t("biz_price_elasticity", { points: [{ price: 10000, quantity: 500 }, { price: 12000, quantity: 420 }] });
eq(r.elasticity, -0.96); assert.match(r.interpretation, /비탄력적/);
r = await c("biz_price_elasticity", { points: [{ price: 1, quantity: 1000 }, { price: 2, quantity: 250 }, { price: 4, quantity: 62.5 }] });
eq([r.elasticity, r.rSquared], [-2, 1]);

r = await t("biz_nps", { scores: [10, 9, 7, 3, 8, 10] });
eq([r.promoters, r.passives, r.detractors, r.nps], [3, 2, 1, 33.3]);
r = await c("biz_nps", { counts: { promoters: 50, passives: 30, detractors: 20 } }); eq(r.nps, 30);

r = await t("biz_saas_metrics", { months: [{ month: "2026-10", startMrr: 10000000, newMrr: 2000000, expansionMrr: 500000, churnedMrr: 800000 }] });
eq([r.months[0].endMrr, r.months[0].nrrPct, r.months[0].grrPct, r.months[0].mrrChurnPct, r.months[0].quickRatio], [11700000, 97, 92, 8, 3.13]);

r = await t("biz_ad_metrics", { impressions: 50000, clicks: 1200, cost: 600000, conversions: 40, revenue: 1800000 });
eq([r.ctrPct, r.cpc, r.cvrPct, r.cpa, r.roasPct, r.roiPct, r.cpm], [2.4, 500, 3.33, 15000, 300, 200, 12000]);
r = await c("biz_ad_metrics", { campaigns: [{ name: "A", cost: 100, revenue: 150, clicks: 10 }, { name: "B", cost: 100, revenue: 400, clicks: 20 }] });
eq(r.campaigns[0].name, "B"); eq(r.total.roasPct, 275);

r = await t("biz_market_concentration", { firms: [{ name: "A", share: 40 }, { name: "B", share: 30 }, { name: "C", share: 20 }, { name: "D", share: 10 }], merge: ["C", "D"] });
eq([r.hhi, r.cr3Pct, r.cr4Pct, r.marketDominancePresumed, r.merger.deltaHhi, r.merger.postHhi, r.merger.safeHarbor], [3000, 90, 100, true, 400, 3400, false]);
r = await c("biz_market_concentration", { firms: [{ name: "A", sales: 30 }, { name: "B", sales: 20 }], marketTotal: 100 }); eq(r.hhi, 1300);

r = await t("biz_markup_margin", { cost: 6000, marginPct: 40 });
eq([r.supplyPrice, r.consumerPriceWithVat, r.markupPct], [10000, 11000, 66.67]);
r = await c("biz_markup_margin", { cost: 6000, price: 11000, priceIncludesVat: true }); eq(r.marginPct, 40);
await assert.rejects(c("biz_markup_margin", { marginPct: 40, markupPct: 50 }));

r = await t("biz_inventory_eoq", { annualDemand: 12000, orderCost: 50000, holdingCostPerUnit: 2000, leadTimeDays: 7 });
eq([r.eoq, r.eoqRounded, r.ordersPerYear, r.reorderPoint, r.annualOrderingAndHoldingCost], [774.6, 775, 15.5, 231, 1549193]);
r = await c("biz_inventory_eoq", { annualDemand: 12000, orderCost: 50000, holdingCostPerUnit: 2000, leadTimeDays: 7, dailyDemandStd: 5, serviceLevelPct: 95 });
eq([r.zScore, r.safetyStock, r.reorderPoint], [1.64, 22, 252]);

r = await t("biz_survey_likert", { questions: [{ question: "q2", responses: [1, 2, 3, 2, 5] }, { question: "q1", responses: [5, 4, 4, 3, 5, 9] }] });
eq([r.questions[0].question, r.questions[0].mean, r.questions[0].top2BoxPct, r.questions[0].invalidResponses], ["q1", 4.2, 80, 1]);
eq([r.questions[1].mean, r.questions[1].bottom2BoxPct], [2.6, 60]);

r = await t("biz_revenue_bridge", { periodA: [{ segment: "X", price: 100, quantity: 10 }, { segment: "Y", revenue: 500 }], periodB: [{ segment: "X", price: 120, quantity: 12 }, { segment: "Y", revenue: 400 }, { segment: "Z", revenue: 100 }] });
const x = r.segments.find((s) => s.segment === "X");
eq([r.totalChange, x.change, x.contributionToChangePct, x.volumeEffect, x.priceEffect, r.segments.find((s) => s.segment === "Z").status], [440, 440, 100, 200, 240, "신규"]);

await assert.rejects(c("biz_nope", {}));
eq([...BIZ_TOOL_NAMES].filter((n) => !called.has(n)), []);
for (const n of BIZ_TOOL_NAMES) JSON.stringify(n);
console.log(`biz.test: OK (${called.size}/16 tools)`);
