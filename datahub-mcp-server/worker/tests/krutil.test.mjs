import assert from "node:assert/strict";
import { KR_TOOLS, KR_TOOL_NAMES, callKrTool as c } from "../krutil.js";

const called = new Set();
const t = async (name, args) => { called.add(name); return c(name, args); };
const eq = (a, b, m) => assert.deepEqual(a, b, m ?? `${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
eq(KR_TOOLS.length, 12); eq(KR_TOOL_NAMES.size, 12);

let r = await t("kr_validate_business_number", { number: "124-81-00998" });
eq([r.checksumValid, r.typeHint], [true, "영리법인 본점"]);
eq((await c("kr_validate_business_number", { number: "1248100997" })).checksumValid, false);
await assert.rejects(c("kr_validate_business_number", { number: "123" }));

r = await t("kr_validate_corporate_number", { number: "130111-0006246" }); eq(r.checksumValid, true);
eq((await c("kr_validate_corporate_number", { number: "1301110006247" })).checksumValid, false);

r = await t("kr_vat", { supplyAmount: "50,000" }); eq([r.vat, r.totalAmount], [5000, 55000]);
r = await c("kr_vat", { totalAmount: 55000 }); eq([r.supplyAmount, r.vat], [50000, 5000]);
r = await c("kr_vat", { totalAmount: 10000 }); eq([r.supplyAmount, r.vat], [9091, 909]);

r = await t("kr_withholding_tax", { amount: 1000000 }); eq([r.incomeTax, r.localIncomeTax, r.totalWithheld, r.net], [30000, 3000, 33000, 967000]);
r = await c("kr_withholding_tax", { amount: 1000000, type: "기타소득" }); eq([r.incomeTax, r.localIncomeTax, r.net], [80000, 8000, 912000]);
r = await c("kr_withholding_tax", { amount: 100000, type: "기타소득" }); eq(r.totalWithheld, 0);
r = await c("kr_withholding_tax", { amount: 30000 }); eq(r.totalWithheld, 0);
r = await c("kr_withholding_tax", { amount: 500000, amountType: "net" });
assert.ok(r.net >= 500000); const prev = await c("kr_withholding_tax", { amount: r.gross - 1 }); assert.ok(prev.net < 500000); eq([r.gross, r.net], [517060, 500000]);

r = await t("kr_amount_in_korean", { amount: 1234000 });
eq([r.korean, r.formal, r.mixed], ["일백이십삼만사천", "금 일백이십삼만사천원정", "123만 4천원"]);
eq((await c("kr_amount_in_korean", { amount: 1234567 })).mixed, "123만 4,567원");
eq((await c("kr_amount_in_korean", { text: "1억 2천만원" })).amount, 120000000);
eq((await c("kr_amount_in_korean", { text: "삼천오백만원" })).amount, 35000000);
eq((await c("kr_amount_in_korean", { text: "금 일백이십삼만사천원정" })).amount, 1234000);
eq((await c("kr_amount_in_korean", { text: "123만 4,567원" })).amount, 1234567);

r = await t("kr_area_convert", { value: 1, unit: "평" }); eq(r.squareMeters, 3.3058);
r = await c("kr_area_convert", { value: 84, unit: "㎡" }); eq(r.pyeong, 25.41);

r = await t("kr_hangul_initials", { text: "데이터팝콘", query: "ㄷㅇㅌ", items: ["데이터팝콘", "데이트", "도움말"] });
eq([r.initials, r.matches], ["ㄷㅇㅌㅍㅋ", ["데이터팝콘", "데이트"]]);
eq((await c("kr_hangul_initials", { query: "팝ㅋ", items: ["데이터팝콘", "팝업"] })).matches, ["데이터팝콘"]);

const rom = async (text, mode) => (await c("kr_romanize", { text, mode })).romanized;
called.add("kr_romanize");
eq(await rom("종로"), "Jongno"); eq(await rom("신라"), "Silla"); eq(await rom("백마"), "Baengma"); eq(await rom("같이"), "Gachi");
eq(await rom("서울"), "Seoul"); eq(await rom("부산"), "Busan"); eq(await rom("독립"), "Dongnip"); eq(await rom("좋아"), "Joa");
eq(await rom("홍길동", "name"), "Hong Gildong");

r = await t("kr_josa", { words: ["서울", "부산", "3", "API", "SQL", "10", "Google"], josa: "을/를" });
eq(r.results.map((x) => x.result), ["서울을", "부산을", "3을", "API를", "SQL을", "10을", "Google을"]);
r = await c("kr_josa", { words: ["서울", "부산", "학교", "100"], josa: "으로" });
eq(r.results.map((x) => x.result), ["서울로", "부산으로", "학교로", "100으로"]);
eq((await c("kr_josa", { word: "사과", josa: "이/가" })).results[0].result, "사과가");
eq((await c("kr_josa", { word: "1000", josa: "은" })).results[0].result, "1000은");

r = await t("kr_loan_schedule", { principal: "100,000,000", annualRatePct: 5, months: 360 });
eq(r.monthlyPayment, 536822); eq(r.schedule.length, 360); eq(r.schedule.at(-1).balance, 0);
r = await c("kr_loan_schedule", { principal: 12000000, annualRatePct: 6, months: 12, method: "원금균등" });
eq([r.firstRepaymentMonthPayment, r.totalInterest], [1060000, 390000]);
r = await c("kr_loan_schedule", { principal: 12000000, annualRatePct: 6, months: 12, method: "만기일시" });
eq([r.totalInterest, r.lastMonthPayment], [720000, 12060000]);
r = await c("kr_loan_schedule", { principal: 12000000, annualRatePct: 6, months: 12, graceMonths: 2 });
eq([r.schedule[0].payment, r.schedule[1].principal, r.schedule.length], [60000, 0, 14]);

r = await t("kr_savings_interest", { product: "적금", amount: 100000, annualRatePct: 3, months: 12 });
eq([r.interestBeforeTax, r.tax, r.interestAfterTax, r.maturityAmount], [19500, 3000, 16500, 1216500]);
r = await c("kr_savings_interest", { amount: 10000000, annualRatePct: 3, months: 12 }); eq([r.interestBeforeTax, r.tax, r.maturityAmount], [300000, 46200, 10253800]);
r = await c("kr_savings_interest", { amount: 10000000, annualRatePct: 3, months: 12, interest: "월복리", tax: "비과세" }); eq([r.interestBeforeTax, r.tax], [304159, 0]);

r = await t("kr_age", { birthDate: "1990-05-15", referenceDate: "2026-11-17" });
eq([r.manAge, r.yearAge, r.nextBirthday, r.daysUntilNextBirthday], [36, 36, "2027-05-15", 179]);
eq((await c("kr_age", { birthDate: "1990-05-15", referenceDate: "2026-03-01" })).manAge, 35);
r = await c("kr_age", { birthDate: "2000-02-29", referenceDate: "2026-02-27" }); eq([r.manAge, r.nextBirthday, r.daysUntilNextBirthday], [25, "2026-02-28", 1]);
assert.ok(Number.isInteger((await c("kr_age", { birthDate: "1990-01-01" })).manAge));

eq([...KR_TOOL_NAMES].filter((n) => !called.has(n)), []);
console.log(`krutil.test: OK (${called.size}/12 tools)`);
