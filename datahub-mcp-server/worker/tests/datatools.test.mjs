// 실행: node tests/datatools.test.mjs
import assert from "node:assert/strict";
import { DATA_TOOLS, DATA_TOOL_NAMES, callDataTool, parseCsv, parseDateStr } from "../datatools.js";

const called = new Set();
const call = async (n, a) => { called.add(n); return callDataTool(n, a); };
let pass = 0;
const test = async (name, fn) => { await fn(); pass++; };

const SALES = "\uFEFF주문일,지역,채널,매출,수량\r\n2026-11-01,서울,온라인,\"1,200\",3\r\n2026-11-01,부산,오프라인,800,2\r\n2026-11-02,서울,오프라인,1500,5\r\n2026-11-02,서울,온라인,700,1\r\n2026-11-03,부산,온라인,900,2\r\n2026-11-03,대구,온라인,,1\r\n";

await test("parser", async () => {
  const t = parseCsv('a,b\n"x, ""quoted""",2\r\n\n"multi\nline",3');
  assert.deepEqual(t.headers, ["a", "b"]);
  assert.equal(t.rows[0][0], 'x, "quoted"');
  assert.equal(t.rows[1][0], "multi\nline");
  const tsv = parseCsv("이름\t점수\n가\t1\n나\t2");
  assert.equal(tsv.delimiter, "tab"); assert.equal(tsv.rows.length, 2);
  const big = parseCsv("v\n" + Array.from({ length: 6000 }, (_, i) => i).join("\n"));
  assert.equal(big.rows.length, 5000); assert.ok(big.truncated);
});
await test("profile", async () => {
  const r = await call("data_profile_csv", { csv: SALES });
  assert.equal(r.rows, 6);
  const sales = r.profile.find((c) => c.column === "매출");
  assert.equal(sales.type, "number"); assert.equal(sales.missing, 1); assert.equal(sales.max, 1500); assert.equal(sales.mean, 1020);
  assert.equal(r.profile.find((c) => c.column === "주문일").type, "date");
  assert.equal(r.profile.find((c) => c.column === "지역").top[0].value, "서울");
});
await test("quality", async () => {
  const csv = "id,금액,메모\n1,100, 공백\n2,120,ok\n2,120,ok\n3,abc,ok\n4,110,ok\n5,9999,ok\n6,105,ok\n7,,ok";
  const r = await call("data_quality_check", { csv });
  const types = r.issues.map((i) => i.type);
  for (const t of ["duplicate_rows", "missing", "mixed_types", "outliers", "whitespace"]) assert.ok(types.includes(t), `missing issue ${t}`);
  assert.equal(r.issues[0].severity, "high");
});
await test("group aggregate", async () => {
  const r = await call("data_group_aggregate", { csv: SALES, groupBy: "지역", metrics: [{ column: "매출", agg: "sum" }, { column: "수량", agg: "mean" }, { column: "*", agg: "count" }] });
  const seoul = r.rows.find((x) => x.지역 === "서울");
  assert.equal(seoul.매출_sum, 3400); assert.equal(seoul.수량_mean, 3); assert.equal(seoul.rows_count, 3);
  assert.equal(r.rows[0].지역, "서울");
  const med = await call("data_group_aggregate", { csv: SALES, groupBy: ["지역", "채널"], metrics: [{ column: "매출", agg: "median" }] });
  assert.equal(med.groupCount, 5);
});
await test("pivot", async () => {
  const r = await call("data_pivot_table", { csv: SALES, rows: "지역", columns: "채널", value: "매출", agg: "sum" });
  const seoul = r.table.find((x) => x.지역 === "서울");
  assert.equal(seoul.온라인, 1900); assert.equal(seoul.오프라인, 1500); assert.equal(r.table.find((x) => x.지역 === "대구").오프라인, null);
  const c = await call("data_pivot_table", { csv: SALES, rows: ["주문일"], columns: "지역", agg: "count" });
  assert.equal(c.table.find((x) => x.주문일 === "2026-11-02").서울, 2);
});
await test("csv to json", async () => {
  const r = await call("data_csv_to_json", { csv: SALES, limit: 2 });
  assert.equal(r.records[0].매출, 1200); assert.equal(r.records.length, 2); assert.equal(r.totalRows, 6);
  const s = await call("data_csv_to_json", { csv: "a,b\n15%,\"₩3,000원\"", castNumbers: true });
  assert.equal(s.records[0].a, 15); assert.equal(s.records[0].b, 3000);
});
await test("dedupe", async () => {
  const csv = "email,name,가입일\na@x.com,철수,2026-01-01\nA@x.com ,철수2,2026-02-01\nb@x.com,영희,2026-03-01";
  const r = await call("data_dedupe", { csv, keys: ["email"] });
  assert.equal(r.removedCount, 1); assert.ok(r.csv.includes("철수,") && !r.csv.includes("철수2"));
  const l = await call("data_dedupe", { csv, keys: "email", keep: "last" });
  assert.ok(l.csv.includes("철수2") && !/\n.*철수,/.test(l.csv));
});
await test("join", async () => {
  const orders = "주문ID,회원ID,금액\n1,u1,100\n2,u2,200\n3,u9,300";
  const users = "회원ID,이름,금액\nu1,철수,0\nu2,영희,0";
  const left = await call("data_join_tables", { leftCsv: orders, rightCsv: users, on: "회원ID" });
  assert.equal(left.resultRows, 3); assert.equal(left.unmatchedLeftRows, 1); assert.ok(left.columns.includes("금액_right"));
  assert.equal(left.records[0].이름, "철수");
  const inner = await call("data_join_tables", { leftCsv: orders, rightCsv: users, on: ["회원ID"], how: "inner" });
  assert.equal(inner.resultRows, 2);
});
await test("normalize dates", async () => {
  const inp = ["2026년 11월 17일", "26.11.17", "2026/11/17", "11/17/2026", "20261117", "2026-11-17 14:30", "2026.11.17 오후 2시 30분", "17/11/2026", "Nov 17, 2026", "2026-02-30", "내일"];
  const r = await call("data_normalize_dates", { values: inp });
  const iso = r.results.map((x) => x.iso);
  assert.deepEqual(iso.slice(0, 9), ["2026-11-17", "2026-11-17", "2026-11-17", "2026-11-17", "2026-11-17", "2026-11-17T14:30", "2026-11-17T14:30", "2026-11-17", "2026-11-17"]);
  assert.deepEqual(r.unparsed, ["2026-02-30", "내일"]);
  assert.equal(parseDateStr("2026-11-17T09:05:00Z"), "2026-11-17T09:05:00");
  assert.equal(parseDateStr("2026년 11월 17일 (화) 오전 12:10"), "2026-11-17T00:10");
});
const REVIEWS = "배송이 빠르고 포장이 꼼꼼해요. 배송이 정말 빨라요! 가격은 비싸지만 품질이 좋아요.\n포장이 꼼꼼해서 좋아요. 배송 빠르고 가격도 괜찮아요. The quality is great and the price is fair.";
await test("word frequency", async () => {
  const r = await call("data_word_frequency", { text: REVIEWS, topN: 5 });
  const top = Object.fromEntries(r.top.map((x) => [x.term, x.count]));
  assert.equal(top["배송"], 3); assert.equal(top["포장"], 2); assert.ok(!("the" in top));
  const r2 = await call("data_word_frequency", { text: [REVIEWS], stopwords: ["배송"], topN: 50 });
  assert.ok(!r2.top.some((x) => x.term === "배송"));
  assert.ok(r2.top.some((x) => x.term === "가격"));
});
await test("ngrams", async () => {
  const r = await call("data_keyword_ngrams", { text: REVIEWS, n: 2, topN: 3 });
  assert.ok(r.top.some((x) => x.term === "배송 빠르고" && x.count === 2));
  const r3 = await call("data_keyword_ngrams", { text: REVIEWS, n: 3 });
  assert.ok(r3.top.every((x) => x.term.split(" ").length === 3));
});
await test("errors", async () => {
  await assert.rejects(() => callDataTool("data_group_aggregate", { csv: SALES, groupBy: "없는열", metrics: [{ column: "매출", agg: "sum" }] }), /열이 없습니다/);
  await assert.rejects(() => callDataTool("data_profile_csv", { csv: "" }), /CSV/);
});

assert.equal(DATA_TOOLS.length, 10);
for (const n of DATA_TOOL_NAMES) assert.ok(called.has(n), `not tested: ${n}`);
console.log(`datatools: ${pass} tests passed, ${called.size}/10 tools covered`);
