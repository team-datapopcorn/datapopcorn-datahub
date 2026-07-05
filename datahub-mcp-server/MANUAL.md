# datahub-mcp-server 사용 매뉴얼 (초보자용)

이 서버는 "MCP(Model Context Protocol)"라는 표준으로 데이터를 노출해서, Claude Code 같은 AI 코딩 도구가
직접 API를 호출해 실시간 데이터를 가져올 수 있게 해줌. 코드 몰라도 아래 순서대로 따라 하면 됨.

## 0. 사전 준비물

- Node.js 18 이상 설치되어 있어야 함. 터미널에 아래 입력해서 버전 확인:
  ```
  node -v
  ```
  숫자가 `v18.x.x` 이상이면 OK. 없다면 https://nodejs.org 에서 LTS 버전 설치.

## 1. 프로젝트 위치로 이동

```
cd /Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server
```

## 2. 필요한 패키지 설치

```
npm install
```

한 번만 하면 됨. `node_modules` 폴더 생기면 성공.

## 3. NEIS API 키 발급받기 (선택)

키 없어도 `sample` 키로 동작은 하는데, 조회 결과가 1페이지/5건으로 제한됨. 제대로 쓰려면:

1. https://open.neis.go.kr 접속
2. 회원가입 후 "인증키 신청" 메뉴에서 키 발급 신청
3. 마이페이지에서 발급된 키 확인 후 복사

## 4. 서버 혼자 실행해서 잘 뜨는지 확인

```
NEIS_API_KEY=발급받은키붙여넣기 npm start
```

키 없으면 그냥 `npm start`만 실행해도 됨(sample 키로 동작). 터미널이 멈춘 것처럼 보이는 게 정상 —
서버가 계속 대기 중이라는 뜻. 끄려면 `Ctrl + C`.

## 5. Claude Code에 등록하기

새 터미널 열고:

```
claude mcp add datahub -- node /Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server/index.js
```

NEIS API 키를 항상 자동으로 넘기고 싶으면:

```
claude mcp add datahub --env NEIS_API_KEY=발급받은키 -- node /Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server/index.js
```

등록 잘 됐는지 확인:

```
claude mcp list
```

`datahub`가 목록에 보이면 성공.

## 5-1. Claude 데스크탑에 커넥터로 등록하기 (Claude Code 없이 쓰고 싶으면)

Claude Desktop 앱은 "Settings > Connectors" 화면에 직접 명령 실행형 로컬 서버를 등록하는 버튼은 없고,
설정 파일(json)을 직접 편집해서 등록함. 순서:

1. Claude 데스크탑 앱 실행 → 좌측 상단 메뉴 또는 `Settings`(설정) 열기
2. `Developer` 탭 → `Edit Config` 버튼 클릭 (파일이 없으면 자동 생성됨)
   - 직접 찾아서 열어도 됨:
     - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
     - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
3. 아래처럼 `mcpServers`에 항목 추가 (파일이 비어있으면 전체를 이 내용으로):

```json
{
  "mcpServers": {
    "datahub": {
      "command": "node",
      "args": [
        "/Users/popcorn/Documents/GitHub/datapopcorn-datahub/datahub-mcp-server/index.js"
      ],
      "env": {
        "NEIS_API_KEY": "발급받은키"
      }
    }
  }
}
```

기존에 다른 `mcpServers` 항목 있으면 `datahub` 블록만 추가하면 됨 (콤마 잘 챙기기).
`NEIS_API_KEY` 없으면 `env` 통째로 빼도 됨 (sample 키로 동작).

4. 파일 저장
5. Claude 데스크탑 완전히 종료 후(맥은 `Cmd+Q`, 트레이 아이콘에서 종료) 재실행
6. 새 대화창 하단(또는 입력창 옆) 망치/플러그 아이콘 클릭 → `datahub` 툴 목록 보이면 성공

## 5-2. `https://api.datapopcorn.ai/mcp` — 이미 떠 있음, 그냥 URL로 붙이면 됨

이 서버는 이미 배포되어 실행 중. 새로 설치할 필요 없이 아래처럼 URL만 등록하면 바로 씀:

- Claude Code:
  ```
  claude mcp add --transport http datahub https://api.datapopcorn.ai/mcp
  ```
- Claude 데스크탑: `설정 > 커넥터 > 커넥터 추가` 에서 URL `https://api.datapopcorn.ai/mcp` 입력

확인:
```
curl -X POST https://api.datapopcorn.ai/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
`neis_list_office_codes`, `neis_search_schools`, `neis_get_meals` 나오면 정상.

## 5-3. (참고) 이 서버는 이렇게 배포되어 있음 — 똑같이 따라 하고 싶을 때

내가 직접 서버 구축해서 똑같은 걸 만들고 싶으면 이 순서 그대로 따라 하면 됨 (VPS든 집에 있는
맥/리눅스 박스든 상관없음, 공인 IP나 포트포워딩 필요 없음):

1. 이 폴더(`datahub-mcp-server`) 서버로 복사, `npm install`
2. Node 없으면 https://nodejs.org 에서 받은 바이너리 압축 풀어서 씀 (brew/sudo 없이도 가능)
3. [cloudflared](https://github.com/cloudflare/cloudflared/releases) 받아서 로그인 (도메인이 Cloudflare에 있어야 함):
   ```
   cloudflared tunnel login          # 브라우저 열어서 계정 인증
   cloudflared tunnel create datahub-mcp
   cloudflared tunnel route dns datahub-mcp api.datapopcorn.ai
   ```
4. `~/.cloudflared/config.yml` 작성 (터널 ID/credentials 경로는 3번 결과에서 나옴):
   ```yaml
   tunnel: <터널 ID>
   credentials-file: /Users/<user>/.cloudflared/<터널 ID>.json
   protocol: http2
   ingress:
     - hostname: api.datapopcorn.ai
       service: http://localhost:3000
     - service: http_status:404
   ```
   `protocol: http2`는 QUIC(기본값)이 네트워크에서 막혀있을 때만 필요 — 안 막혀 있으면 빼도 됨.
5. 두 프로세스를 계속 띄워둠 (`node http.js`, `cloudflared tunnel run datahub-mcp`) — macOS는 launchd,
   리눅스는 systemd로 등록해서 재부팅에도 살아남게 할 것. 자세한 launchd plist 예시는 `README.md` 참고.
6. 5-2의 curl로 확인.

주의: 지금은 인증 없이 공개. NEIS는 어차피 공개 데이터라 괜찮지만, Haerapy/개인 건강·재무 같은
소스를 여기 붙이는 순간 아무나 그 데이터에 접근 가능해짐 — 그 전에 API 키/토큰 인증 레이어 반드시 추가할 것.

## 6. 실제로 써보기

Claude Code든 Claude 데스크탑이든 대화창에서 그냥 자연어로 물어보면 됨. 예시:

- "datahub guide 보여줘" (뭐가 있는지 처음 확인할 때)
- "서울 지역 학교 코드 알려줘"
- "서울 B10, 학교코드 7010057 학교 이번 달 급식 알려줘"
- "제주 지역 고등학교 검색해줘"

Claude가 알아서 `neis_list_office_codes`, `neis_search_schools`, `neis_get_meals` 툴을 호출함. 직접 함수 이름
몰라도 됨 — 자연어로 요청하면 AI가 알맞은 툴 골라서 씀. 뭐가 있는지 먼저 보고 싶으면 `guide` 툴을 부르라고
하면 전체 소스/툴 목록과 예시를 보여줌.

## 7. 문제 생기면

| 증상 | 원인/해결 |
| --- | --- |
| `npm install` 에러 | Node.js 버전 확인 (`node -v`), 18 미만이면 업데이트 |
| `npm start` 하자마자 바로 꺼짐 | 에러 메시지 확인, `node index.js`로 직접 실행해서 로그 보기 |
| Claude Code에서 툴이 안 보임 | `claude mcp list`로 등록 확인, 안 되어 있으면 5번 다시 |
| Claude 데스크탑에서 툴이 안 보임 | config json 문법 오류(콤마/괄호) 확인, 저장 후 앱 완전 종료했다가 재실행했는지 확인 |
| 급식/학교 조회 결과가 이상하게 적음 | `sample` 키 쓰는 중일 가능성 큼 — 3번에서 진짜 키 발급받기 |
| "NEIS API HTTP xxx" 에러 | NEIS 서버 쪽 문제거나 파라미터(officeCode/schoolCode) 오타 확인 |
| `curl`로 `/mcp` 호출했는데 404 | `MCP_PATH` 환경변수 바꿨는지 확인, 리버스 프록시 경로 설정 다시 확인 |
| HTTP 모드에서 응답이 뚝뚝 끊김 | 리버스 프록시에서 `proxy_buffering off` (SSE 스트리밍용) 빠졌는지 확인 |

## 8. 새 데이터 소스 추가하고 싶을 때 (개발자용)

`README.md`의 "새 소스 추가하는 법" 참고. 초보자는 이 부분 몰라도 지금 있는 NEIS 기능 쓰는 데 문제 없음.
