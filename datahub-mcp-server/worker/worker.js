import LANDING_PAGE from "./landing.html";

const SERVER_NAME = "datahub-mcp-server";
const SERVER_VERSION = "0.2.0";
const NEIS_BASE_URL = "https://open.neis.go.kr/hub";
const SERVER_INSTRUCTIONS =
  "개인 데이터허브(datapopcorn)를 노출하는 MCP 서버. 처음 사용하거나 어떤 툴을 써야 할지 모르면 " +
  "먼저 `guide` 툴을 호출해서 사용법과 현재 등록된 데이터 소스 목록을 확인할 것.";
const GUIDE_TEXT = `# datahub-mcp-server 사용 가이드

이 서버는 개인 데이터허브(datapopcorn)를 MCP 도구로 노출하는 서버. 데이터 소스별로 툴이 묶여 있고,
새 소스가 생기면 여기 계속 추가됨. 처음이면 이 가이드부터 읽고 시작할 것.

## 지금 쓸 수 있는 소스: NEIS (학교/급식, 공개 데이터) — 툴 이름 전부 \`neis_\` 접두어

- \`neis_list_office_codes\` — 지역명(서울/부산/제주 등) -> 시도교육청 코드 매핑. 다른 툴 쓰기 전에 코드 모르면 먼저 호출.
- \`neis_search_schools\` — 학교 검색. \`officeCode\`(필수, 예: B10) + \`schoolName\`(선택, 부분 일치)으로 학교코드(SD_SCHUL_CODE) 찾기.
- \`neis_get_meals\` — 급식 정보 조회. \`officeCode\` + \`schoolCode\`(neis_search_schools로 찾은 값) + 날짜 조건(\`date\` 또는 \`fromDate\`/\`toDate\`)으로 조회, 여러 페이지 자동 처리.

일반적인 흐름: neis_list_office_codes로 지역 코드 확인 → neis_search_schools로 학교코드 확인 → neis_get_meals로 급식 조회.
학교코드를 이미 알고 있으면 앞 단계 생략 가능.

새 소스가 추가되면 그 소스도 자기 접두어(예: \`haerapy_\`, \`golf_\`)를 씀 — 이름이 겹치거나 헷갈릴 일 없게 하기 위함.

## 사용 예시 (자연어로 그냥 물어보면 됨)

- "서울 지역 학교 코드 알려줘"
- "서울 B10, 가락고등학교 학교코드 찾아줘"
- "서울 B10, 학교코드 7010057 학교 이번 달 급식 알려줘"

## 참고

- 지금은 공개 데이터(NEIS)만 있어서 인증 없이 열려 있음. 개인 건강/재무 등 비공개 소스가 추가되면
  인증이 붙을 예정 — 그 전까지는 아무나 호출 가능한 읽기 전용 서버.
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

const TOOL_DEFINITIONS = [
  {
    name: "guide",
    description: "이 MCP 서버를 처음 쓰는 경우 가장 먼저 호출할 것. 서버 목적, 현재 등록된 데이터 소스, 각 툴 사용법과 예시를 안내합니다.",
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

export default {
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
    default:
      throw new JsonRpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${message.method}`);
  }
}

function initializeResult(params = {}) {
  const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
  const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
  return {
    protocolVersion,
    capabilities: { tools: {} },
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
  switch (params.name) {
    case "guide":
      return asText(GUIDE_TEXT);
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
