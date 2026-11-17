import LANDING_PAGE from "./landing.html";
import { TOOL_TITLES } from "./titles.js";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import { handleAuthRoutes } from "./auth.js";
import { recordRpc, handleAdmin, purgeExpired } from "./usage.js";
import { geo, appName, hostOf } from "./context.js";
import { ANALYSIS_TOOLS, ANALYSIS_TOOL_NAMES, callAnalysisTool, listPrompts, getPrompt, listResources, readResource } from "./analysis.js";
import { WEATHER_TOOLS, WEATHER_TOOL_NAMES, callWeatherTool } from "./weather.js";
import { BIKE_TOOLS, BIKE_TOOL_NAMES, callBikeTool } from "./bike.js";
import { STATS_TOOLS, STATS_TOOL_NAMES, callStatsTool } from "./stats.js";
import { DATA_TOOLS, DATA_TOOL_NAMES, callDataTool } from "./datatools.js";
import { BIZ_TOOLS, BIZ_TOOL_NAMES, callBizTool } from "./biz.js";
import { KR_TOOLS, KR_TOOL_NAMES, callKrTool } from "./krutil.js";
import { NEIS2_TOOLS, NEIS2_TOOL_NAMES, callNeis2Tool } from "./neis2.js";
import { WEATHER2_TOOLS, WEATHER2_TOOL_NAMES, callWeather2Tool } from "./weather2.js";
import { CAL_TOOLS, CAL_TOOL_NAMES, callCalTool } from "./calendar.js";
import { ECON_TOOLS, ECON_TOOL_NAMES, callEconTool } from "./econ.js";
import { UCI_TOOLS, UCI_TOOL_NAMES, callUciTool } from "./uci.js";
import { RESEARCH_TOOLS, RESEARCH_TOOL_NAMES, callResearchTool } from "./research.js";
import { SUNEUNG_TOOLS, SUNEUNG_TOOL_NAMES, callSuneungTool } from "./suneung.js";

const SERVER_NAME = "datahub-mcp-server";
const SERVER_VERSION = "0.5.2";
const NEIS_BASE_URL = "https://open.neis.go.kr/hub";
const SERVER_INSTRUCTIONS =
  "데이터팝콘 데이터 MCP. 한국 공공데이터 조회(NEIS·날씨·환율 등), 통계 검정·예측(stats_), 비즈니스 지표(biz_), " +
  "CSV 정리(data_), 한국 실무 계산(kr_), 수능·학원 상담(suneung_) 도구가 있다. 분류별 목록과 예시는 `guide` 도구에 있다. " +
  "계산 도구는 입력으로 받은 숫자만 계산하며, 결과에 해석과 출처(source)가 함께 들어 있다.";
const GUIDE_HEAD = `# 데이터팝콘 데이터 MCP 사용 가이드

한국 공공데이터 조회, 데이터 분석(통계·예측), 비즈니스 지표 계산, 한국 실무 계산을 한 서버에서 쓰는 MCP.
도구 이름 앞의 접두어가 분류다(예: \`stats_\` 통계, \`biz_\` 비즈니스 지표, \`kr_\` 한국 실무 계산).
모든 도구는 읽기 전용이며, 입력한 숫자·CSV는 계산에만 쓰고 저장하지 않는다.

## 추천 흐름

1. 질문이 막연하면 \`analysis_get_skill\`(stage=pipeline)로 데이터팝콘 분석 4단계(가설 → 수집 → 의심 → 정리)부터.
2. 데이터는 조회 도구(neis_, weather_, fx_, wb_, uci_, wiki_, suneung_)로 가져오거나, 사용자가 붙여 넣은 CSV를 \`data_\` 도구로 정리.
3. 숫자는 \`stats_\`(검정·예측)·\`biz_\`(퍼널·코호트·RFM·LTV 등)로 계산하고, 결론 전에 \`analysis_traps_checklist\`로 함정 점검.
`;
const GUIDE_TAIL = `
## 사용 예시 (자연어로 그냥 물어보면 됨)

- "서울 B10 가락고등학교 이번 달 급식에서 우유·땅콩 들어간 메뉴 빼줘"
- "A안 전환 120/2400, B안 150/2380인데 유의미해?"
- "이 주문 CSV로 RFM 고객 세분화 해줘"
- "월 MRR 표로 순매출유지율(NRR)이랑 퀵레이쇼 계산해줘"
- "프리랜서 강사료 300만원 3.3% 떼면 실수령 얼마야?"
- "국어 131, 수학 128, 영어 85, 사문 65, 생윤 66인 학생 상담 자료 만들어줘" (수능·학원)
- "다음 주 영업일 기준 5일 뒤 날짜"
- "원/달러 환율 최근 3개월 추이"
- "'생성형 인공지능' 위키 관심도 최근 1년 추이"

## 참고

- 데이터팝콘 계정(Google 로그인)으로 가입·로그인한 사용자만 호출할 수 있음. 모든 도구는 읽기 전용.
- 외부 원천(NEIS, Open-Meteo, Frankfurter(ECB), 업비트, World Bank, UCI, Wikimedia, OpenAlex, Nager.Date)의 값은 각 원천 기준이며, 결과의 source·출처 표기를 함께 전달할 것.
`;
const JSON_RPC_VERSION = "2.0";
const LATEST_PROTOCOL_VERSION = "2025-11-25";
const SUPPORTED_PROTOCOL_VERSIONS = new Set([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
]);

const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
};

const OFFICE_CODES = {
  서울: "B10", 부산: "C10", 대구: "D10", 인천: "E10", 광주: "F10", 대전: "G10", 울산: "H10", 세종: "I10",
  경기: "J10", 강원: "K10", 충북: "M10", 충남: "N10", 전북: "P10", 전남: "Q10", 경북: "R10", 경남: "S10", 제주: "T10",
};

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };

const TOOL_DEFINITIONS_BASE = [
  {
    name: "guide",
    description: "이 서버의 사용법, 분류별 도구 목록, 추천 분석 흐름과 예시 질문을 안내하는 문서를 돌려줍니다.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "neis_list_office_codes",
    description: "[NEIS] 지역명(서울/부산/제주 등) -> NEIS 시도교육청 코드(ATPT_OFCDC_SC_CODE) 매핑을 반환합니다.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
  {
    name: "neis_search_schools",
    description: "[NEIS] schoolInfo API로 학교를 검색합니다. 시도교육청 코드와 학교명(부분 일치)으로 필터링합니다. 예: '서울 가락고등학교 학교코드 찾아줘'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: { type: "string", description: "시도교육청 코드, 예: B10 (서울). neis_list_office_codes로 조회 가능" },
        schoolName: { type: "string", description: "학교명 부분 일치 검색어" },
        pIndex: { type: "integer", minimum: 1, default: 1 },
        pSize: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      },
      required: ["officeCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_get_meals",
    description: "[NEIS] mealServiceDietInfo API로 특정 학교의 급식 정보를 조회합니다. 필요 시 여러 페이지를 자동으로 이어붙여 반환합니다. 예: '학교코드 7010057 이번 달 급식 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: { type: "string", description: "시도교육청 코드, 예: B10" },
        schoolCode: { type: "string", description: "표준학교코드 SD_SCHUL_CODE" },
        date: { type: "string", description: "특정 급식일자 YYYYMMDD" },
        fromDate: { type: "string", description: "검색 시작일 YYYYMMDD" },
        toDate: { type: "string", description: "검색 종료일 YYYYMMDD" },
        mealCode: { type: "string", description: "급식 코드 (1:조식, 2:중식, 3:석식)" },
      },
      required: ["officeCode", "schoolCode"],
    },
    annotations: READ_ONLY,
  },
];

class JsonRpcError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// 추가 도구 모듈: 이름 집합으로 찾아 해당 모듈의 call 함수로 보낸다. label은 오류 메시지 앞머리.
const EXTRA_MODULES = [
  { names: STATS_TOOL_NAMES, call: callStatsTool, label: "통계 계산" },
  { names: DATA_TOOL_NAMES, call: callDataTool, label: "데이터 정리" },
  { names: BIZ_TOOL_NAMES, call: callBizTool, label: "비즈니스 지표 계산" },
  { names: KR_TOOL_NAMES, call: callKrTool, label: "한국 실무 계산" },
  { names: NEIS2_TOOL_NAMES, call: callNeis2Tool, label: "NEIS 조회" },
  { names: WEATHER2_TOOL_NAMES, call: callWeather2Tool, label: "날씨 조회" },
  { names: CAL_TOOL_NAMES, call: callCalTool, label: "달력 계산" },
  { names: ECON_TOOL_NAMES, call: callEconTool, label: "경제 데이터 조회" },
  { names: UCI_TOOL_NAMES, call: callUciTool, label: "UCI 데이터셋 조회" },
  { names: RESEARCH_TOOL_NAMES, call: callResearchTool, label: "리서치 조회" },
  { names: SUNEUNG_TOOL_NAMES, call: callSuneungTool, label: "수능 조회" },
];

const TOOL_DEFINITIONS = [
  ...TOOL_DEFINITIONS_BASE, ...NEIS2_TOOLS, ...WEATHER_TOOLS, ...WEATHER2_TOOLS, ...BIKE_TOOLS, ...CAL_TOOLS,
  ...ANALYSIS_TOOLS, ...STATS_TOOLS, ...DATA_TOOLS, ...BIZ_TOOLS, ...KR_TOOLS,
  ...ECON_TOOLS, ...UCI_TOOLS, ...RESEARCH_TOOLS, ...SUNEUNG_TOOLS,
];

// 모든 도구에 title(최상위 + annotations.title)과 readOnlyHint를 붙인다. 이 서버의 도구는 전부 읽기 전용.
for (const t of TOOL_DEFINITIONS) {
  const title = TOOL_TITLES[t.name] || t.name;
  t.title = title;
  t.annotations = { readOnlyHint: true, destructiveHint: false, openWorldHint: true, ...(t.annotations || {}), title };
}

// 소개 페이지(/)의 "도구 범위" 목록용 분류. 접두어로 묶고, 안 맞는 새 도구는 "기타"로 자동 노출.
// 새 소스를 붙이면 여기에 한 줄(제목·요약)만 추가하면 됨.
const TOOL_GROUPS = [
  { match: (n) => n === "guide", title: "시작 가이드", summary: "서버 사용법, 분류별 도구 목록, 추천 흐름과 예시 질문" },
  { match: (n) => n.startsWith("suneung_"), title: "수능 · 학원 상담", summary: "학생·반 성적표 해석(상위 %·백분위·등급·경계 학생), 등급컷·9월 모평 비교, N수·선택과목 추이, 난이도 이력, 수능날 안내문" },
  { match: (n) => n.startsWith("biz_"), title: "비즈니스 지표", summary: "퍼널·코호트 리텐션, RFM 세분화, LTV/CAC, 손익분기, 광고 ROAS, SaaS MRR, 가격탄력성" },
  { match: (n) => n.startsWith("stats_"), title: "통계 검정 · 예측", summary: "기술통계, t검정·A/B 테스트·표본 크기, 카이제곱·분산분석, 회귀, 이동평균·성장률, 수요 예측" },
  { match: (n) => n.startsWith("data_"), title: "데이터 정리 (CSV · 텍스트)", summary: "CSV 프로파일·품질 점검, 그룹 집계·피벗, 중복 제거·조인, 날짜 정규화, 단어 빈도·키워드" },
  { match: (n) => n.startsWith("kr_"), title: "한국 실무 계산", summary: "사업자번호 검증, 부가세·3.3% 원천징수, 금액 한글 표기, 대출 상환표·예적금 이자, 평 환산, 만 나이" },
  { match: (n) => n.startsWith("analysis_"), title: "데이터 분석 스킬", summary: "4단계 분석 지침(가설→수집→의심→정리), 함정 체크리스트, 숫자 이상치·급변점 점검, 상관관계" },
  { match: (n) => n.startsWith("neis_"), title: "학교 · 급식 (NEIS)", summary: "학교 검색, 급식·영양·알레르기 확인, 학사일정, 시간표, 학급·학과 정보, 학원·교습소 검색" },
  { match: (n) => n.startsWith("weather_"), title: "날씨 · 대기질", summary: "일별 관측·16일 예보, 미세먼지 등급, 도시 비교, 월별 기후 평년, 일출·일몰, 해상 파고" },
  { match: (n) => n.startsWith("cal_"), title: "달력 · 공휴일", summary: "공휴일 조회, 영업일 수 계산, N영업일 뒤 날짜, 날짜 정보·차이" },
  { match: (n) => n.startsWith("fx_") || n.startsWith("crypto_"), title: "환율 · 코인 시세", summary: "ECB 기준 환율 조회·추이·환산, 업비트 시세·캔들" },
  { match: (n) => n.startsWith("wb_"), title: "국가 비교 (World Bank)", summary: "GDP·인구·물가·실업률 등 국가 지표 조회, 국가 간 순위 비교" },
  { match: (n) => n.startsWith("uci_"), title: "실습 데이터셋 (UCI)", summary: "공개 데이터셋 검색, 메타데이터·변수 설명, 앞부분 미리보기, 강의용 추천 목록" },
  { match: (n) => n.startsWith("wiki_") || n.startsWith("paper_"), title: "관심도 · 논문 리서치", summary: "위키백과 조회수 추이(관심도 대리지표)·비교, 문서 요약, 논문 검색" },
  { match: (n) => n.startsWith("bike_"), title: "서울 따릉이", summary: "일별 대여·반납 이용 현황 조회" },
];

function publicToolCatalog() {
  const groups = TOOL_GROUPS.map((g) => ({ title: g.title, summary: g.summary, tools: [] }));
  const etc = { title: "기타", summary: "", tools: [] };
  for (const t of TOOL_DEFINITIONS) {
    const i = TOOL_GROUPS.findIndex((g) => g.match(t.name));
    const desc = String(t.description || "").replace(/^\[[^\]]+\]\s*/, "");
    (i >= 0 ? groups[i] : etc).tools.push({ name: t.name, description: desc });
  }
  if (etc.tools.length) {
    etc.summary = etc.tools.map((t) => t.name).join(", ");
    groups.push(etc);
  }
  return { total: TOOL_DEFINITIONS.length, groups: groups.filter((g) => g.tools.length) };
}

function buildGuide() {
  const cat = publicToolCatalog();
  const body = cat.groups
    .map((g) => `## ${g.title} (${g.tools.length}개)\n\n${g.tools.map((t) => `- \`${t.name}\` — ${t.description.split(/(?<=[.다])\s/)[0]}`).join("\n")}`)
    .join("\n\n");
  return `${GUIDE_HEAD}\n지금 등록된 도구: ${cat.total}개\n\n${body}\n${GUIDE_TAIL}`;
}

// /mcp 본체. OAuthProvider가 토큰을 확인한 요청만 여기로 온다(ctx.props에 로그인한 사용자).
const mcpService = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return new Response(LANDING_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    if (url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        server: SERVER_NAME,
        runtime: "cloudflare-workers",
        timestamp: new Date().toISOString(),
      });
    }

    if (url.pathname !== "/mcp") {
      return jsonResponse(
        {
          status: "ok",
          server: SERVER_NAME,
          endpoint: "/mcp",
          runtime: "cloudflare-workers",
        },
        { status: url.pathname === "/" ? 200 : 404 }
      );
    }

    if (request.method === "GET") {
      return new Response("This MCP endpoint uses Streamable HTTP over POST.", {
        status: 405,
        headers: {
          ...corsHeaders(),
          allow: "POST, OPTIONS",
          "content-type": "text/plain; charset=utf-8",
        },
      });
    }

    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return jsonRpcErrorResponse(null, ERROR_CODES.INVALID_REQUEST, "Only POST is supported.", 405);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (_error) {
      return jsonRpcErrorResponse(null, ERROR_CODES.PARSE_ERROR, "Invalid JSON body.");
    }

    const messages = Array.isArray(payload) ? payload : [payload];
    const responses = [];

    for (const message of messages) {
      const response = await handleMessage(message, env);
      if (response) {
        responses.push(response);
      }
    }

    if (responses.length === 0) {
      return new Response(null, {
        status: 202,
        headers: {
          ...corsHeaders(),
          "mcp-session-id": getOrCreateSessionId(request),
        },
      });
    }

    return jsonResponse(Array.isArray(payload) ? responses : responses[0], {
      headers: {
        "mcp-session-id": getOrCreateSessionId(request),
      },
    });
  },
};

async function handleMessage(message, env) {
  if (!isJsonRpcMessage(message)) {
    return jsonRpcError(null, ERROR_CODES.INVALID_REQUEST, "Invalid JSON-RPC message.");
  }

  if (message.id === undefined) {
    await handleNotification(message);
    return null;
  }

  try {
    const result = await handleRequest(message, env);
    return {
      jsonrpc: JSON_RPC_VERSION,
      id: message.id,
      result,
    };
  } catch (error) {
    const code = error instanceof JsonRpcError ? error.code : ERROR_CODES.INTERNAL_ERROR;
    const messageText = error instanceof Error ? error.message : String(error);

    return jsonRpcError(message.id, code, messageText);
  }
}

function isJsonRpcMessage(message) {
  return (
    message &&
    typeof message === "object" &&
    message.jsonrpc === JSON_RPC_VERSION &&
    typeof message.method === "string"
  );
}

async function handleNotification(message) {
  if (message.method === "notifications/initialized" || message.method?.startsWith("notifications/")) {
    return;
  }

  throw new JsonRpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unknown notification: ${message.method}`);
}

async function handleRequest(message, env) {
  switch (message.method) {
    case "initialize":
      return initializeResult(message.params);
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOL_DEFINITIONS };
    case "tools/call":
      return callTool(message.params, env);
    case "prompts/list":
      return { prompts: listPrompts() };
    case "prompts/get": {
      const p = getPrompt(message.params?.name, message.params?.arguments || {});
      if (!p) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown prompt: ${message.params?.name}`);
      return p;
    }
    case "resources/list":
      return { resources: listResources() };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "resources/read": {
      const r = readResource(message.params?.uri);
      if (!r) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown resource: ${message.params?.uri}`);
      return r;
    }
    default:
      throw new JsonRpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${message.method}`);
  }
}

function initializeResult(params = {}) {
  const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
  const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
  return {
    protocolVersion,
    capabilities: { tools: {}, prompts: {}, resources: {} },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    instructions: SERVER_INSTRUCTIONS,
  };
}

function asText(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

async function neisGet(env, endpoint, params) {
  const url = new URL(`${NEIS_BASE_URL}/${endpoint}`);
  url.searchParams.set("KEY", env.NEIS_API_KEY || "sample");
  url.searchParams.set("Type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NEIS API HTTP ${res.status}`);
  return res.json();
}

function neisResultMessage(data) {
  const r = data.RESULT;
  return r ? `NEIS: ${r.CODE} - ${r.MESSAGE}` : data;
}

async function callTool(params, env) {
  if (!params || typeof params !== "object" || typeof params.name !== "string") {
    throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "tools/call params.name is required.");
  }
  const args = params.arguments || {};
  const extra = EXTRA_MODULES.find((m) => m.names.has(params.name));
  if (extra) {
    try {
      return asText(await extra.call(params.name, args, env));
    } catch (error) {
      return { content: [{ type: "text", text: `${extra.label} 오류: ${error.message}` }], isError: true };
    }
  }
  if (ANALYSIS_TOOL_NAMES.has(params.name)) {
    try {
      return asText(callAnalysisTool(params.name, args));
    } catch (error) {
      return { content: [{ type: "text", text: `입력 오류: ${error.message}` }], isError: true };
    }
  }
  if (WEATHER_TOOL_NAMES.has(params.name)) {
    try {
      return asText(await callWeatherTool(params.name, args));
    } catch (error) {
      return { content: [{ type: "text", text: `날씨 조회 오류: ${error.message}` }], isError: true };
    }
  }
  if (BIKE_TOOL_NAMES.has(params.name)) {
    try {
      return asText(await callBikeTool(params.name, args, env));
    } catch (error) {
      return { content: [{ type: "text", text: `따릉이 조회 오류: ${error.message}` }], isError: true };
    }
  }
  switch (params.name) {
    case "guide":
      return asText(buildGuide());
    case "neis_list_office_codes":
      return asText(OFFICE_CODES);
    case "neis_search_schools": {
      if (!args.officeCode) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "officeCode is required.");
      const data = await neisGet(env, "schoolInfo", {
        ATPT_OFCDC_SC_CODE: args.officeCode,
        SCHUL_NM: args.schoolName,
        pIndex: args.pIndex ?? 1,
        pSize: Math.min(args.pSize ?? 20, 100),
      });
      if (!data.schoolInfo) return asText(neisResultMessage(data));
      return asText(data.schoolInfo[1]?.row ?? []);
    }
    case "neis_get_meals": {
      if (!args.officeCode || !args.schoolCode) {
        throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "officeCode and schoolCode are required.");
      }
      const rows = [];
      let pIndex = 1;
      while (pIndex <= 20) {
        const data = await neisGet(env, "mealServiceDietInfo", {
          ATPT_OFCDC_SC_CODE: args.officeCode,
          SD_SCHUL_CODE: args.schoolCode,
          MLSV_YMD: args.date,
          MLSV_FROM_YMD: args.fromDate,
          MLSV_TO_YMD: args.toDate,
          MMEAL_SC_CODE: args.mealCode,
          pIndex,
          pSize: 100,
        });
        if (!data.mealServiceDietInfo) return asText(neisResultMessage(data));
        const total = data.mealServiceDietInfo[0].head[0].list_total_count;
        const pageRows = data.mealServiceDietInfo[1]?.row ?? [];
        rows.push(...pageRows);
        if (pageRows.length === 0 || rows.length >= total) break;
        pIndex += 1;
      }
      return asText(rows);
    }
    default:
      throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown tool: ${params.name}`);
  }
}

function getOrCreateSessionId(request) {
  const existingSessionId = request.headers.get("mcp-session-id");
  return existingSessionId || crypto.randomUUID();
}

function jsonRpcError(id, code, message) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message,
    },
  };
}

function jsonRpcErrorResponse(id, code, message, status = 400) {
  return jsonResponse(jsonRpcError(id, code, message), { status });
}

function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
  });
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers":
      "authorization, content-type, mcp-protocol-version, mcp-session-id, MCP-Protocol-Version, Mcp-Session-Id",
    "access-control-expose-headers": "mcp-session-id, Mcp-Session-Id",
  };
}

// 공개 페이지(/, /health)와 로그인 화면(/authorize, /callback). 나머지는 404.
const publicService = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = await handleAuthRoutes(request, env);
    if (auth) return auth;
    const admin = await handleAdmin(request, env);
    if (admin) return admin;
    if (url.pathname === "/" && request.method === "GET") {
      const headers = new Headers({ "content-type": "text/html; charset=utf-8" });
      // 첫 방문 유입 기록(이미 있으면 유지): 어디서 왔는지(referrer 호스트)와 utm 태그만
      if (!/(?:^|;\s*)dp_mcp_ref=/.test(request.headers.get("cookie") || "")) {
        const q = url.searchParams, rh = hostOf(request.headers.get("referer") || "");
        const ref = { s: q.get("utm_source"), m: q.get("utm_medium"), c: q.get("utm_campaign"), h: rh && rh !== url.hostname ? rh : null, p: "api.datapopcorn.ai/", t: Date.now() };
        const v = btoa(JSON.stringify(ref)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
        headers.append("set-cookie", `dp_mcp_ref=${v}; Domain=.datapopcorn.ai; Path=/; Max-Age=7776000; Secure; SameSite=Lax`);
      }
      return new Response(LANDING_PAGE, { headers });
    }
    if (url.pathname === "/tools" && request.method === "GET") {
      // 도구 이름·설명만 공개(호출은 여전히 로그인 필요). 소개 페이지가 이걸 읽어서 목록을 그림.
      return jsonResponse(publicToolCatalog(), { headers: { "cache-control": "public, max-age=300" } });
    }
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION, auth: "oauth2.1", runtime: "cloudflare-workers", timestamp: new Date().toISOString() });
    }
    return jsonResponse({ error: "not_found", endpoint: "/mcp" }, { status: 404 });
  },
};

const ORIGIN = "https://api.datapopcorn.ai";

const provider = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: {
    // 호출 기록: JSON-RPC 메시지의 method와 도구 이름만 남긴다(인자 X). 기록 실패가 응답을 막지 않게 waitUntil.
    async fetch(request, env, ctx) {
      const t0 = Date.now();
      let messages = [];
      if (request.method === "POST") {
        try {
          const body = await request.clone().json();
          messages = (Array.isArray(body) ? body : [body]).map((m) => ({
            method: m?.method,
            tool: m?.method === "tools/call" ? m?.params?.name : null,
            clientName: m?.method === "initialize" ? m?.params?.clientInfo?.name : null,
            clientVer: m?.method === "initialize" ? m?.params?.clientInfo?.version : null,
          }));
        } catch {}
      }
      const res = await mcpService.fetch(request, env);
      const ua = request.headers.get("user-agent") || "";
      const init = messages.find((m) => m.clientName);
      const c = { ...geo(request), ua, app: appName(init?.clientName || "", ua), app_ver: init?.clientVer ? String(init.clientVer).slice(0, 30) : null };
      const rec = recordRpc(env, { userId: ctx.props?.userId || ctx.auth?.userId, clientId: ctx.auth?.clientId, messages, ok: res.status < 400, ms: Date.now() - t0, ctx: c }).catch((e) => console.error("usage log", e?.message));
      ctx.waitUntil?.(rec);
      return res;
    },
  },
  defaultHandler: publicService,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp", "offline_access"],
  requiredScopes: ["mcp"],
  resourceMetadata: {
    resource: `${ORIGIN}/mcp`,
    authorization_servers: [ORIGIN],
    resource_name: "DataPopcorn Data MCP",
  },
  clientIdMetadataDocumentEnabled: true,
  accessTokenTTL: 3600,
  refreshTokenTTL: 60 * 60 * 24 * 30,
});

export default {
  fetch: (request, env, ctx) => provider.fetch(request, env, ctx),
  // 매일 03:00 KST: 보관기간(1년) 지난 이용 기록과 1년간 로그인 없는 계정 삭제
  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeExpired(env).then((r) => console.log("purge", JSON.stringify(r))));
  },
};
