import { z } from "zod";

const NEIS_KEY = process.env.NEIS_API_KEY || "sample";
const BASE_URL = "https://open.neis.go.kr/hub";

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

async function neisGet(endpoint, params) {
  const url = new URL(`${BASE_URL}/${endpoint}`);
  url.searchParams.set("KEY", NEIS_KEY);
  url.searchParams.set("Type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`NEIS API HTTP ${res.status}`);
  }
  return res.json();
}

function asText(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

export function registerNeisTools(server) {
  server.tool(
    "list_office_codes",
    "지역명(서울/부산/제주 등) -> NEIS 시도교육청 코드(ATPT_OFCDC_SC_CODE) 매핑을 반환합니다.",
    {},
    async () => asText(OFFICE_CODES),
  );

  server.tool(
    "search_schools",
    "NEIS schoolInfo API로 학교를 검색합니다. 시도교육청 코드와 학교명(부분 일치)으로 필터링합니다.",
    {
      officeCode: z.string().describe("시도교육청 코드, 예: B10 (서울). list_office_codes로 조회 가능"),
      schoolName: z.string().optional().describe("학교명 부분 일치 검색어"),
      pIndex: z.number().int().min(1).optional().default(1),
      pSize: z.number().int().min(1).max(100).optional().default(20),
    },
    async ({ officeCode, schoolName, pIndex, pSize }) => {
      const data = await neisGet("schoolInfo", {
        ATPT_OFCDC_SC_CODE: officeCode,
        SCHUL_NM: schoolName,
        pIndex,
        pSize,
      });
      if (!data.schoolInfo) {
        return asText(data.RESULT ? `NEIS: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}` : data);
      }
      const rows = data.schoolInfo[1]?.row ?? [];
      return asText(rows);
    },
  );

  server.tool(
    "get_meals",
    "NEIS mealServiceDietInfo API로 특정 학교의 급식 정보를 조회합니다. 필요 시 여러 페이지를 자동으로 이어붙여 반환합니다.",
    {
      officeCode: z.string().describe("시도교육청 코드, 예: B10"),
      schoolCode: z.string().describe("표준학교코드 SD_SCHUL_CODE"),
      date: z.string().optional().describe("특정 급식일자 YYYYMMDD"),
      fromDate: z.string().optional().describe("검색 시작일 YYYYMMDD"),
      toDate: z.string().optional().describe("검색 종료일 YYYYMMDD"),
      mealCode: z.string().optional().describe("급식 코드 (1:조식, 2:중식, 3:석식)"),
    },
    async ({ officeCode, schoolCode, date, fromDate, toDate, mealCode }) => {
      const rows = [];
      let pIndex = 1;
      const pSize = 100;

      while (true) {
        const data = await neisGet("mealServiceDietInfo", {
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
          return asText(data.RESULT ? `NEIS: ${data.RESULT.CODE} - ${data.RESULT.MESSAGE}` : data);
        }

        const totalCount = data.mealServiceDietInfo[0].head[0].list_total_count;
        const pageRows = data.mealServiceDietInfo[1]?.row ?? [];
        rows.push(...pageRows);

        if (pageRows.length === 0 || rows.length >= totalCount) break;
        pIndex += 1;
      }

      return asText(rows);
    },
  );
}
