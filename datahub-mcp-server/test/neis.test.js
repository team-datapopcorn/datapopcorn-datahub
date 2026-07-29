import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_MEAL_RANGE_DAYS,
  asError,
  createMealsHandler,
  validateMealQuery,
} from "../tools/neis.js";

test("validateMealQuery accepts one date or a bounded date range", () => {
  assert.doesNotThrow(() => validateMealQuery({ date: "20260303" }));
  assert.doesNotThrow(() => validateMealQuery({ fromDate: "20260301", toDate: "20260331" }));
});

test("validateMealQuery rejects missing, mixed, malformed, reversed, and oversized ranges", () => {
  assert.throws(() => validateMealQuery({}), /date 또는 fromDate/);
  assert.throws(() => validateMealQuery({ date: "20260303", fromDate: "20260301", toDate: "20260303" }), /하나만/);
  assert.throws(() => validateMealQuery({ date: "20260230" }), /유효한/);
  assert.throws(() => validateMealQuery({ fromDate: "20260331", toDate: "20260301" }), /이후/);
  assert.throws(
    () => validateMealQuery({ fromDate: "20260301", toDate: "20260401" }),
    new RegExp(`최대 ${MAX_MEAL_RANGE_DAYS}일`),
  );
});

test("meal handler returns a structured MCP error before upstream calls for invalid queries", async () => {
  let called = false;
  const handler = createMealsHandler(async () => {
    called = true;
    return {};
  });

  const result = await handler({ officeCode: "B10", schoolCode: "7010057" });
  assert.equal(called, false);
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /date 또는 fromDate/);
});

test("meal handler paginates bounded results", async () => {
  const calls = [];
  const handler = createMealsHandler(async (_endpoint, params) => {
    calls.push(params.pIndex);
    if (params.pIndex === 1) {
      return { mealServiceDietInfo: [{ head: [{ list_total_count: 2 }] }, { row: [{ id: 1 }] }] };
    }
    return { mealServiceDietInfo: [{ head: [{ list_total_count: 2 }] }, { row: [{ id: 2 }] }] };
  });

  const result = await handler({ officeCode: "B10", schoolCode: "7010057", date: "20260303" });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.isError, undefined);
  assert.match(result.content[0].text, /"id": 1/);
  assert.match(result.content[0].text, /"id": 2/);
});

test("meal handler limits oversized reported or returned NEIS responses", async () => {
  const oversized = createMealsHandler(async () => ({
    mealServiceDietInfo: [{ head: [{ list_total_count: 1001 }] }, { row: [] }],
  }));
  const oversizedResult = await oversized({ officeCode: "B10", schoolCode: "7010057", date: "20260303" });
  assert.equal(oversizedResult.isError, true);
  assert.match(oversizedResult.content[0].text, /1000건/);

  const inconsistent = createMealsHandler(async () => ({
    mealServiceDietInfo: [{ head: [{ list_total_count: 1 }] }, { row: Array.from({ length: 1001 }, (_, id) => ({ id })) }],
  }));
  const inconsistentResult = await inconsistent({ officeCode: "B10", schoolCode: "7010057", date: "20260303" });
  assert.equal(inconsistentResult.isError, true);
  assert.match(inconsistentResult.content[0].text, /1000건/);
});

test("meal handler marks NEIS application errors as MCP errors", async () => {
  const handler = createMealsHandler(async () => ({
    RESULT: { CODE: "INFO-300", MESSAGE: "인증키가 유효하지 않습니다." },
  }));

  const result = await handler({ officeCode: "B10", schoolCode: "7010057", date: "20260303" });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /INFO-300/);
});

test("meal handler marks thrown upstream errors as MCP errors", async () => {
  const unavailable = createMealsHandler(async () => {
    throw new Error("NEIS API HTTP 503");
  });
  const unavailableResult = await unavailable({ officeCode: "B10", schoolCode: "7010057", date: "20260303" });
  assert.equal(unavailableResult.isError, true);
  assert.match(unavailableResult.content[0].text, /HTTP 503/);
});

test("asError uses MCP isError semantics", () => {
  assert.deepEqual(asError("실패"), {
    content: [{ type: "text", text: "NEIS 오류: 실패" }],
    isError: true,
  });
});
