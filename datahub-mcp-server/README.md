# datahub-mcp-server

개인 데이터허브를 MCP 서버로 노출하는 프로젝트. 서버 하나에 데이터 소스별 툴을 계속 추가하는 구조.

처음 써보는 사람은 [MANUAL.md](./MANUAL.md) 먼저 볼 것 (설치부터 Claude Code 연결까지 단계별 안내).

- `index.js` — 로컬용 진입점 (stdio transport). Claude Code/Desktop이 명령어로 직접 띄워서 씀.
- `http.js` — 원격 배포용 진입점 (Streamable HTTP transport). `/mcp` 경로로 HTTP 요청 받음, 리버스 프록시 뒤에 세워서 `https://api.datapopcorn.ai/mcp` 같은 URL로 노출하는 용도. stateless (요청마다 서버 새로 생성) — 지금 툴들이 전부 읽기 전용 API 프록시라 세션 유지할 이유 없음.
- `tools/neis.js` — 1호 소스. NEIS Open API 급식/학교 정보를 라이브로 조회. index.js/http.js 둘 다 이 모듈을 등록해서 씀.
  - `list_office_codes` — 지역명 -> 시도교육청 코드 매핑
  - `search_schools` — 학교 검색 (schoolInfo API)
  - `get_meals` — 급식 정보 조회, 페이지네이션 자동 처리 (mealServiceDietInfo API)

## 실행 (로컬, stdio)

```
npm install
NEIS_API_KEY=발급받은키 npm start
```

`NEIS_API_KEY` 안 주면 `sample` 키로 동작 (rate/size 제한 있음).

## 실행 (원격 배포용, HTTP)

```
npm install
PORT=3000 NEIS_API_KEY=발급받은키 npm run start:http
```

기본 경로는 `/mcp`, `MCP_PATH` 환경변수로 바꿀 수 있음. 이 프로세스 자체는 인증/HTTPS 없음 —
앞단에 리버스 프록시(nginx/Caddy 등)로 TLS 종료하고 도메인 붙이는 걸 전제로 함. 지금은 공개 데이터(NEIS)만
서빙하니 인증 없이 노출해도 괜찮지만, 개인 건강/재무 같은 소스 붙이는 순간 인증 레이어 반드시 추가할 것.

nginx 리버스 프록시 예시 (`api.datapopcorn.ai` -> 로컬 3000번 포트):

```nginx
server {
    listen 443 ssl;
    server_name api.datapopcorn.ai;

    location /mcp {
        proxy_pass http://127.0.0.1:3000/mcp;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_buffering off;   # SSE 스트리밍 끊기지 않게
    }
}
```

프로세스는 계속 떠 있어야 하니 `pm2`나 `systemd` 서비스로 등록해서 재시작/재부팅 살아남게 할 것.

## 새 소스 추가하는 법

1. `tools/<source>.js`에 `export function register<Source>Tools(server) { server.tool(...) }` 형태로 작성
2. `index.js`에서 import 후 `register<Source>Tools(server)` 한 줄 추가

다음 후보: Haerapy 상태, 제주 골프, 울릉도 맛집, 개인 건강/재무/식단 데이터 (지금 `data-hub/src/sampleData.js`에 하드코딩된 것들).

## Claude Code에 연결

```
claude mcp add datahub -- node /Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server/index.js
```
