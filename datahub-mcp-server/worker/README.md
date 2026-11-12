# datahub-mcp-server (Cloudflare Workers)

2026-11-03부터 `https://api.datapopcorn.ai/mcp`는 이 Worker가 서빙한다. 이전 방식(맥북 launchd + Cloudflare Tunnel)은
도메인이 Dev@datapopcorn.ai 계정으로 옮겨진 뒤 Error 1000으로 멈췄고, 터널 호스트에도 접속할 수 없어서 Worker로 옮겼다.

- 계정: Dev@datapopcorn.ai's Account, Worker 이름 `datapopcorn-datahub-mcp`, 커스텀 도메인 `api.datapopcorn.ai`
- 도구: guide, neis_list_office_codes, neis_search_schools, neis_get_meals (Node 버전과 같은 이름·인자)
- 비밀값: `NEIS_API_KEY` (`npx wrangler secret put NEIS_API_KEY`). NEIS의 `sample` 키는 2026-11-03 기준 ERROR-290으로 거절됨
- 배포: 이 폴더에서 `npx wrangler deploy`. `landing.html`은 `../public/index.html` 복사본이다

## 인증 (v0.4.0, 2026-11-12)

`/mcp`는 데이터팝콘 계정(Google 로그인)으로 가입·로그인한 사용자만 부를 수 있다. MCP 표준 OAuth 2.1 흐름이다.

- 라이브러리: `@cloudflare/workers-oauth-provider` (토큰·코드는 KV에 해시로만 저장, props 암호화)
- 토큰 없는 요청 → 401 + `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`
- 클라이언트 등록: DCR `/register`, CIMD 지원. 인가 `/authorize`(동의 화면 → Google 로그인 → `/callback`), 토큰 `/token`. PKCE S256 필수
- 토큰: access 1시간, refresh 30일. 코드를 재사용하면 해당 grant 전체가 폐기된다
- Google OAuth 클라이언트: GCP 프로젝트 `datapopcorn-account`(datapopcorn@gmail.com 소유, 프로덕션 게시, 범위 openid·email·profile). 리디렉션 URI `https://api.datapopcorn.ai/callback`
- 비밀값: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`npx wrangler secret put`). KV: `OAUTH_KV`
- 사용 기록(v0.4.1): D1 `datapopcorn-mcp-usage`(`USAGE_DB`)의 `users`·`events`·`clients`. 로그인과 MCP 요청의 method·도구 이름·성공 여부·응답 시간만 남기고 도구 인자는 저장하지 않는다. 스키마는 `migrations/`(`npx wrangler d1 migrations apply datapopcorn-mcp-usage --remote`)
- 관리자 통계: `GET /admin/stats` (`Authorization: Bearer <ADMIN_TOKEN>`). dashboard.datapopcorn.ai의 "MCP 사용자" 탭이 원격 맥 `data/mcp-admin-token`으로 중계한다(대표 계정만)
- 사용자 목록: `npx wrangler kv key list --binding OAUTH_KV --remote --prefix dp-user:` (이메일·가입일·마지막 로그인). 차단은 해당 키의 `blocked`를 true로

## 데이터 분석 스킬 (v0.3.0, 2026-11-03)

데이터팝콘 분석 4단계 스킬(공개 저장소 `team-datapopcorn/datapopcorn-analysis-plugin`)을 MCP로 제공한다.

| MCP 기능 | 이름 | 내용 |
|---|---|---|
| 도구 | `analysis_get_skill` | 단계별 지침 (pipeline, 1-hypothesis, 2-collect, 3-suspect, 4-report) + MCP 환경 안내 |
| 도구 | `analysis_traps_checklist` | 함정 10개(+트렌드 6개) traps_check.md 양식. 3-suspect 본문에서 파싱 |
| 도구 | `analysis_suspect_numbers` | 숫자 배열·날짜·세그먼트 → 표본 크기, 평균 vs 중앙값, IQR 이상치, 기간 공백·상한, 기준 기간, 급변점과 baseline 평탄도 계산 후 traps_check.md 초안 |
| 프롬프트 | `analysis_pipeline`, `analysis_1_hypothesis` ~ `analysis_4_report` | 스킬 본문 + 참고 파일 + 사용자 주제 |
| 리소스 | `datapopcorn://skills/<skill>/<file>` | 스킬 원문 9개 파일 (리포트 템플릿 포함) |

스킬이 바뀌면: `node scripts/sync-skills.mjs` (GitHub main에서 받음, `--local <폴더>`로 로컬도 가능) → `npx wrangler deploy`.
`skills-bundle.js`는 생성 파일이라 직접 고치지 않는다.
