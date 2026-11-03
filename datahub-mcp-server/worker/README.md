# datahub-mcp-server (Cloudflare Workers)

2026-11-03부터 `https://api.datapopcorn.ai/mcp`는 이 Worker가 서빙한다. 이전 방식(맥북 launchd + Cloudflare Tunnel)은
도메인이 Dev@datapopcorn.ai 계정으로 옮겨진 뒤 Error 1000으로 멈췄고, 터널 호스트에도 접속할 수 없어서 Worker로 옮겼다.

- 계정: Dev@datapopcorn.ai's Account, Worker 이름 `datapopcorn-datahub-mcp`, 커스텀 도메인 `api.datapopcorn.ai`
- 도구: guide, neis_list_office_codes, neis_search_schools, neis_get_meals (Node 버전과 같은 이름·인자)
- 비밀값: `NEIS_API_KEY` (`npx wrangler secret put NEIS_API_KEY`). NEIS의 `sample` 키는 2026-11-03 기준 ERROR-290으로 거절됨
- 배포: 이 폴더에서 `npx wrangler deploy`. `landing.html`은 `../public/index.html` 복사본이다
