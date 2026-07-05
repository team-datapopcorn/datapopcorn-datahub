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

export function registerGuideTools(server) {
  server.tool(
    "guide",
    "이 MCP 서버를 처음 쓰는 경우 가장 먼저 호출할 것. 서버 목적, 현재 등록된 데이터 소스, 각 툴 사용법과 예시를 안내합니다.",
    {},
    async () => ({ content: [{ type: "text", text: GUIDE_TEXT }] }),
  );
}

export const SERVER_INSTRUCTIONS =
  "개인 데이터허브(datapopcorn)를 노출하는 MCP 서버. 처음 사용하거나 어떤 툴을 써야 할지 모르면 " +
  "먼저 `guide` 툴을 호출해서 사용법과 현재 등록된 데이터 소스 목록을 확인할 것.";
