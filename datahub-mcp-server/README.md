# datahub-mcp-server

개인 데이터허브를 MCP 서버로 노출하는 프로젝트. 서버 하나에 데이터 소스별 툴을 계속 추가하는 구조.

처음 써보는 사람은 [MANUAL.md](./MANUAL.md) 먼저 볼 것 (설치부터 Claude Code 연결까지 단계별 안내).

## 현재 배포 상태

`https://api.datapopcorn.ai/mcp` 로 실제 운영 중. `https://api.datapopcorn.ai/` (경로 없이)는 서버 설명 +
연결 방법 + 현재 툴 목록을 보여주는 랜딩페이지 — 목록은 페이지가 그 자리에서 `/mcp`에 물어봐서 그리는
거라 하드코딩 아님, 새 툴 배포하면 자동으로 같이 바뀜.

- 호스트: `datapopcorn-popcorn-mbp` (Tailscale 태그, macOS, brew/sudo 없이 Node/cloudflared 바이너리 직접 설치)
- 노출 방식: Cloudflare Tunnel (`datahub-mcp` 터널, `protocol: http2` 강제 — 이 네트워크에서 QUIC 기본값이 막혀서 http2로 바꿈)
- 상시 구동: launchd user agent 2개
  - `ai.datapopcorn.mcp-server` — `node http.js` (PORT=3000, NEIS_API_KEY 설정됨)
  - `ai.datapopcorn.cloudflared-mcp` — `cloudflared tunnel run datahub-mcp`
  - 재부팅/크래시 시 `KeepAlive`로 자동 재시작
- `NEIS_API_KEY`는 저 호스트의 plist에만 있음 — 이 저장소에는 안 들어감
- 인증 없음 (지금은 NEIS 공개데이터만 서빙하니 의도적으로 생략, 새 소스 붙이기 전 추가 필요)

## 구성

- `index.js` — 로컬용 진입점 (stdio transport). Claude Code/Desktop이 명령어로 직접 띄워서 씀.
- `http.js` — 원격 배포용 진입점 (Streamable HTTP transport). `/mcp` 경로로 HTTP 요청 받음, 리버스 프록시 뒤에 세워서 `https://api.datapopcorn.ai/mcp` 같은 URL로 노출하는 용도. stateless (요청마다 서버 새로 생성) — 지금 툴들이 전부 읽기 전용 API 프록시라 세션 유지할 이유 없음.
- `tools/guide.js` — 모든 소스 공통. 서버 접속 시 안내되는 `instructions`와, 처음 쓰는 사람이 호출할 `guide` 툴(사용법 + 현재 등록된 소스/툴 목록)을 등록.
- `tools/neis.js` — 1호 소스. NEIS Open API 급식/학교 정보를 라이브로 조회. 툴 이름은 전부 `neis_` 접두어. index.js/http.js 둘 다 이 모듈을 등록해서 씀.
  - `neis_list_office_codes` — 지역명 -> 시도교육청 코드 매핑
  - `neis_search_schools` — 학교 검색 (schoolInfo API)
  - `neis_get_meals` — 급식 정보 조회, 페이지네이션 자동 처리 (mealServiceDietInfo API)

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
앞단에서 TLS 종료하고 도메인 붙이는 걸 전제로 함. 지금은 공개 데이터(NEIS)만
서빙하니 인증 없이 노출해도 괜찮지만, 개인 건강/재무 같은 소스 붙이는 순간 인증 레이어 반드시 추가할 것.

**실제로 쓴 방식: Cloudflare Tunnel** (공인 IP/포트포워딩/방화벽 설정 없이 홈서버·노트북에서도 됨, 도메인이
Cloudflare에 있으면 이 방식이 제일 간단):

```
cloudflared tunnel login                              # 브라우저에서 Cloudflare 계정 인증 1회
cloudflared tunnel create datahub-mcp
cloudflared tunnel route dns datahub-mcp api.datapopcorn.ai   # DNS 자동 등록
```

`~/.cloudflared/config.yml`:

```yaml
tunnel: <위에서 생성된 터널 ID>
credentials-file: /Users/<user>/.cloudflared/<터널 ID>.json
protocol: http2   # 네트워크에 따라 QUIC(기본값)이 막히는 경우 있음 — 그럴 때만 필요

ingress:
  - hostname: api.datapopcorn.ai
    service: http://localhost:3000
  - service: http_status:404
```

```
cloudflared tunnel run datahub-mcp
```

VPS에 공인 IP 있어서 nginx/Caddy로 직접 열고 싶으면 이 방식도 됨 (일반적인 리버스 프록시 설정):

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

두 방식 다 프로세스(`node http.js`, cloudflared면 `cloudflared tunnel run`)는 계속 떠 있어야 하니
`pm2`/`systemd`/(macOS는 `launchd`)로 등록해서 재시작/재부팅 살아남게 할 것.

## 새 소스 추가하는 법

1. `tools/<source>.js`에 `export function register<Source>Tools(server) { server.tool(...) }` 형태로 작성
2. **툴 이름은 반드시 소스 접두어를 붙임** — `neis_search_schools`처럼 `<source>_<action>` 형태. 접두어 없이
   `search_schools`, `get_status` 같은 이름 쓰면 소스가 늘어날수록 이름이 겹치거나 헷갈림.
3. `index.js`와 `http.js` 둘 다에서 import 후 `register<Source>Tools(server)` 한 줄씩 추가
4. `tools/guide.js`의 안내 텍스트에도 새 소스/툴 목록 추가 (에이전트가 `guide` 툴로 전체 목록을 알 수 있게)

## Claude Code에 연결

로컬(stdio):

```
claude mcp add datahub -- node /Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server/index.js
```

원격(이미 떠 있는 배포에 URL로 붙기):

```
claude mcp add --transport http datahub https://api.datapopcorn.ai/mcp
```

Claude 데스크탑도 커넥터 설정에서 저 URL 그대로 등록하면 됨 (자세한 순서는 `MANUAL.md` 참고).
