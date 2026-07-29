import { z } from "zod";

const NEIS_KEY = process.env.NEIS_API_KEY;
const BASE_URL = "https://open.neis.go.kr/hub";
const REQUEST_TIMEOUT_MS = 10_000;
export const MAX_MEAL_RANGE_DAYS = 31;
export const MAX_MEAL_PAGES = 10;
export const MAX_MEAL_ROWS = 1_000;

const OFFICE_CODES = {
  서울: "B10",
  부산: "C10",
  대구: "D10",
  인천: "E10",
  광주: "F10",
  대전: "G10",
  울산: "H10",
  세종: "I10",
  경기: "J10",
  강원: "K10",
  충북: "M10",
  충남: "N10",
  전북: "P10",
  전남: "Q10",
  경북: "R10",
  경남: "S10",
  제주: "T10",
};

const dateSchema = z.string().regex(/^\d{8}$/, "YYYYMMDD 형식이어야 합니다.").optional();

function parseDate(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("유효한 YYYYMMDD 날짜여야 합니다.");
  }
  return date;
}

export function validateMealQuery({ date, fromDate, toDate }) {
  if (date && (fromDate || toDate)) {
    throw new Error("date 또는 fromDate/toDate 범위 중 하나만 지정하세요.");
  }
  if (!date && (!fromDate || !toDate)) {
    throw new Error("date 또는 fromDate와 toDate를 함께 지정해야 합니다.");
  }
  if (date) {
    parseDate(date);
    return;
  }

  const from = parseDate(fromDate);
  const to = parseDate(toDate);
  const rangeDays = Math.floor((to - from) / 86_400_000) + 1;

  if (rangeDays < 1) {
    throw new Error("toDate는 fromDate와 같거나 이후여야 합니다.");
  }
  if (rangeDays > MAX_MEAL_RANGE_DAYS) {
    throw new Error(`급식 조회 기간은 최대 ${MAX_MEAL_RANGE_DAYS}일입니다.`);
  }
}

export async function neisGet(endpoint, params, fetchImpl = fetch) {
  if (!NEIS_KEY) {
    throw new Error("NEIS_API_KEY가 설정되지 않았습니다.");
  }

  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("KEY", NEIS_KEY);
  url.searchParams.set("Type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("NEIS API 요청 시간이 초과됐습니다.");
    }
    throw new Error("NEIS API에 연결할 수 없습니다.");
  }

  if (!res.ok) {
    throw new Error(`NEIS API HTTP ${res.status}`);
  }
  return res.json();
}

function asText(value) {
  return {
    content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
  };
}

export function asError(message) {
  return { content: [{ type: "text", text: `NEIS 오류: ${message}` }], isError: true };
}

function upstreamError(data) {
  return `NEIS: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}`;
}

export function createMealsHandler(get = neisGet) {
  return async ({ officeCode, schoolCode, date, fromDate, toDate, mealCode }) => {
    try {
      validateMealQuery({ date, fromDate, toDate });
      const rows = [];
      const pSize = 100;

      for (let pIndex = 1; pIndex <= MAX_MEAL_PAGES; pIndex += 1) {
        const data = await get("mealServiceDietInfo", {
          ATPT_OFCDC_SC_CODE: officeCode,
          SD_SCHUL_CODE: schoolCode,
          MLSV_YMD: date,
          MLSV_FROM_YMD: fromDate,
          MLSV_TO_YMD: toDate,
          MMEAL_SC_CODE: mealCode,
          pIndex,
          pSize,
        });

        if (!data.mealServiceDietInfo) {
          return data.RESULT ? asError(upstreamError(data)) : asText(data);
        }

        const totalCount = Number(data.mealServiceDietInfo[0]?.head?.[0]?.list_total_count ?? 0);
        if (totalCount > MAX_MEAL_ROWS) {
          return asError(`조회 결과가 ${MAX_MEAL_ROWS}건을 초과합니다. 기간이나 조건을 더 좁혀주세요.`);
        }

        const pageRows = data.mealServiceDietInfo[1]?.row ?? [];
        if (rows.length + pageRows.length > MAX_MEAL_ROWS) {
          return asError(`조회 결과가 ${MAX_MEAL_ROWS}건을 초과합니다. 기간이나 조건을 더 좁혀주세요.`);
        }
        rows.push(...pageRows);

        if (pageRows.length === 0 || rows.length >= totalCount) {
          return asText(rows);
        }
      }

      return asError(`최대 ${MAX_MEAL_PAGES}페이지까지만 조회할 수 있습니다. 기간이나 조건을 더 좁혀주세요.`);
    } catch (err) {
      return asError(err instanceof Error ? err.message : "급식 정보를 가져오지 못했습니다.");
    }
  };
}

export function registerNeisTools(server) {
  server.tool(
    "neis_list_office_codes",
    "[NEIS] 지역명(서울/부산/제주 등) -> NEIS 시도교육청 코드(ATPT_OFCDC_SC_CODE) 매핑을 반환합니다.",
    {},
    async () => asText(OFFICE_CODES),
  );

  server.tool(
    "neis_search_schools",
    "[NEIS] schoolInfo API로 학교를 검색합니다. 시도교육청 코드와 학교명(부분 일치)으로 필터링합니다.",
    {
      officeCode: z.string().describe("시도교육청 코드, 예: B10 (서울). neis_list_office_codes로 조회 가능"),
      schoolName: z.string().optional().describe("학교명 부분 일치 검색어"),
      pIndex: z.number().int().min(1).optional().default(1),
      pSize: z.number().int().min(1).max(100).optional().default(20),
    },
    async ({ officeCode, schoolName, pIndex, pSize }) => {
      try {
        const data = await neisGet("schoolInfo", {
          ATPT_OFCDC_SC_CODE: officeCode,
          SCHUL_NM: schoolName,
          pIndex,
          pSize,
        });
        if (!data.schoolInfo) {
          return data.RESULT ? asError(upstreamError(data)) : asText(data);
        }
        return asText(data.schoolInfo[1]?.row ?? []);
      } catch (err) {
        return asError(err instanceof Error ? err.message : "학교 정보를 가져오지 못했습니다.");
      }
    },
  );

  server.tool(
    "neis_get_meals",
    "[NEIS] mealServiceDietInfo API로 특정 학교의 급식 정보를 조회합니다. date 또는 최대 31일 범위를 지정해야 하며, 필요 시 여러 페이지를 자동으로 이어붙여 반환합니다.",
    {
      officeCode: z.string().describe("시도교육청 코드, 예: B10"),
      schoolCode: z.string().describe("표준학교코드 SD_SCHUL_CODE"),
      date: dateSchema.describe("특정 급식일자 YYYYMMDD. fromDate/toDate와 함께 쓰지 않음"),
      fromDate: dateSchema.describe("검색 시작일 YYYYMMDD. toDate와 함께 필수, 최대 31일"),
      toDate: dateSchema.describe("검색 종료일 YYYYMMDD. fromDate와 함께 필수, 최대 31일"),
      mealCode: z.enum(["1", "2", "3"]).optional().describe("급식 코드 (1:조식, 2:중식, 3:석식)"),
    },
    createMealsHandler(),
  );
}
