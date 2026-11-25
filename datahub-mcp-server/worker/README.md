# datahub-mcp-server (Cloudflare Workers)

2026-11-03부터 `https://api.datapopcorn.ai/mcp`는 이 Worker가 서빙한다. 이전 방식(맥북 launchd + Cloudflare Tunnel)은
도메인이 Dev@datapopcorn.ai 계정으로 옮겨진 뒤 Error 1000으로 멈췄고, 터널 호스트에도 접속할 수 없어서 Worker로 옮겼다.

- 계정: Dev@datapopcorn.ai's Account, Worker 이름 `datapopcorn-datahub-mcp`, 커스텀 도메인 `api.datapopcorn.ai`
- 도구: v0.7.1 기준 111개(15개 분류, 군부대 식단 4개 추가). 목록은 `GET https://api.datapopcorn.ai/tools`(공개, 이름·설명만) 또는 아래 '도구 100개 확장' 표
- 비밀값: `NEIS_API_KEY`, `DATAGOKR_KEY`(공공데이터포털 일반 인증키, 기상청·에어코리아), `SEOUL_OPEN_DATA_KEY`(서울 열린데이터, 따릉이) (`npx wrangler secret put <이름>`). NEIS의 `sample` 키는 2026-11-03 기준 ERROR-290으로 거절됨
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
- 맥락 기록(v0.4.2, `context.js`): 로그인 시 Cloudflare 기준 국가·지역·도시·네트워크(ASN 조직명), 브라우저 기기·OS·브라우저, 로그인을 시작한 사이트(Referer 호스트), 첫 방문 유입 쿠키 `dp_mcp_ref`(datapopcorn.ai/data-mcp와 이 서버 첫 화면이 심음, referrer 호스트·utm, 90일). MCP 요청은 User-Agent·initialize의 clientInfo로 앱 이름(Claude Code, Codex, ChatGPT, Aside 등)과 요청 출발지(사용자 기기/클라우드, ASN 추정). IP 원문은 저장하지 않는다
- 보관·삭제(v0.4.3, 개인정보처리방침 9항과 일치): 매일 03:00 KST cron이 1년 지난 이용 기록과 마지막 로그인 후 1년 지난 계정(기록 포함)을 삭제. 탈퇴 요청은 `POST /admin/delete-user {"email": "..."}`(ADMIN_TOKEN)로 D1·KV 삭제와 토큰 폐기
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

## 도구 100개 확장 (v0.5.0~0.5.2, 2026-11-17)

10개였던 도구를 사업화 목적으로 100개로 늘렸다(이후 수능 9개가 더해져 109개). 방향은 2026-11-03 사업화 검토 결론을 따른다:
공공데이터를 감싸기만 한 MCP는 무료화되는 중이라, **분석·비즈니스 계산 도구와 검증된 한국 데이터**에 무게를 뒀다.

| 분류(접두어) | 파일 | 개수 | 외부 원천 |
|---|---|---|---|
| 비즈니스 지표 `biz_` | `biz.js` | 16 | 없음(계산) |
| 통계 검정·예측 `stats_` | `stats.js` | 18 | 없음(계산, R 결과와 대조) |
| 데이터 정리 `data_` | `datatools.js` | 10 | 없음(CSV 최대 5,000행) |
| 한국 실무 계산 `kr_` | `krutil.js` | 12 | 없음(세율은 일반 규칙, 결과에 한계 명시) |
| 수능·학원 상담 `suneung_` | `suneung.js`, `suneung-data.js` | 9 | 2026학년도 스냅샷(다른 세션 작업) |
| 학교·급식 `neis_` | `worker.js`, `neis2.js` | 3+7 | NEIS (`NEIS_API_KEY`) |
| 날씨·대기질 `weather_` | `kma.js` | 8 | 기상청 단기예보·ASOS 일자료, 에어코리아 대기오염정보 (공공데이터포털 `DATAGOKR_KEY`), 일출·일몰은 NOAA 식으로 자체 계산 |
| 달력·공휴일 `cal_` | `calendar.js` | 5 | Nager.Date |
| 환율 `fx_` | `econ.js` | 3 | Frankfurter(ECB 기준율) |
| 국가 비교 `wb_` | `econ.js` | 2 | World Bank |
| 실습 데이터셋 `uci_` | `uci.js` | 4 | UCI ML Repository(CC BY 4.0, 하루 캐시) |
| 관심도·논문 `wiki_` `paper_` | `research.js` | 4 | Wikimedia, OpenAlex → 429면 Crossref로 자동 전환 |
| 분석 스킬 `analysis_`, 따릉이 `bike_`, `guide` | 기존 | 4+1+1 | |

- 모든 도구에 `title`(`titles.js`)과 `readOnlyHint: true`를 붙인다(Claude 커넥터 디렉터리 요건). 새 도구는 `titles.js`에 한 줄, 새 분류는 `worker.js`의 `TOOL_GROUPS`에 한 줄 추가
- 디스패치: `worker.js`의 `EXTRA_MODULES`(이름 집합 → call 함수). 오류는 `isError: true`와 한국어 메시지
- 테스트: `tests/*.test.mjs` (모듈별, 실제 API 호출 포함). `for t in tests/*.test.mjs; do node $t; done`
- 운영 검증(2026-11-17): 실제 OAuth 로그인(dev@datapopcorn.ai) 토큰으로 `/mcp`의 109개 도구를 모두 호출해 109/109 성공
- 배포 메모: Aside 샌드박스에서는 esbuild 네이티브 바이너리가 실행되지 않아 `esbuild-wasm`으로 번들한 뒤 `wrangler deploy --no-bundle`로 올렸다. 일반 터미널에서는 그대로 `npx wrangler deploy`
- 알려진 한계: OpenAlex 무키 한도는 Cloudflare 공용 IP에서 금방 차서 Crossref 대체가 자주 쓰일 수 있음(`OPENALEX_API_KEY` 비밀값을 넣으면 OpenAlex 우선). 업비트 시세 도구 2개(crypto_)는 v0.5.3에서 뺐다: 업비트 Open API 약관 제5조가 영리목적 이용·재배포를 금지
- 날씨는 v0.6.0에서 Open-Meteo(무료 API는 비상업 전용)를 걷어내고 기상청·에어코리아(공공누리, 상업 이용 가능)로 교체. 지명 표는 시군구 약 300곳 좌표 + KMA LCC 격자 변환(일부 1칸 차이 가능), ASOS 91개 지점은 API로 이름 대조 완료
- 공공데이터포털 개발계정 키는 API별 일 10,000회 한도이고 재난 한 장 잡과 같이 쓴다. 사용량이 늘면 운영계정 전환 신청 필요


## 군부대 식단 (mil_, v0.7.1, 2026-11-25 배포)

- **운영 구조(중요)**: Cloudflare Worker에서는 국방부 서버(포털·OpenAPI 모두)가 연결 시간 초과(HTTP 522)로 막힌다(2026-11-25 운영 확인, 해외 IP 차단 추정). 그래서 데이터팝콘 맥 launchd `ai.datapopcorn.mnd-sync`(매일 06:20·18:20, LLM 없음)가 `~/datapopcorn-jobs/mnd-sync/mnd-sync.mjs`(= `scripts/mnd-sync.mjs` + `worker/mnd.js` 사본)로 포털에서 34개 부대 전체 식단을 받아, 바뀐 연도만 `POST /admin/mnd-sync`(Bearer `MND_SYNC_TOKEN`)로 올린다. Worker는 KV `MND_KV`(datapopcorn-mnd-meals) 사본(`u:{코드}` 메타, `y:{코드}:{연도}` 행)을 먼저 읽고, 사본이 없을 때만 실시간 경로를 8초 제한으로 시도한다. 첫 동기화 34/34, 207,003행. 토큰 원본은 Aside Vault "데이터 MCP 군부대 식단 동기화 토큰", 맥에는 `~/.config/datapopcorn/mnd-sync.env`(600). 로그 `~/datapopcorn-jobs/mnd-sync/sync.log`. `mnd.js`를 바꾸면 맥의 사본도 같이 바꾼다.
- 포털 원본에 엑셀 수식(`IF(A8="",H7,A8)`)의 이스케이프 안 된 따옴표가 섞여 JSON이 깨지는 부대가 있다(2171·5397·7296). `parsePortalRows`가 줄 단위·필드 단위로 복구하고 수식 값은 빈칸 처리.

- 출처: 국방부 공공데이터 개방(data.mnd.go.kr) 부대별 병영 표준식단 OpenAPI `https://openapi.mnd.go.kr/{KEY}/json/DS_TB_MNDT_DATEBYMLSVC_{부대코드}/{시작}/{끝}/`. 2026-11-21 OA-9400~9899 전수 확인으로 34개 부대(육군훈련소 ATC 포함). 목록은 `mnd.js`의 `MND_UNITS`.
- 이용조건: 공공누리 제3유형(출처표시+변경금지). 메뉴 이름은 원문 그대로 반환하고 알레르기 번호만 분리해 해석, 응답마다 `attribution` 포함.
- 인증키: Worker 시크릿 `MND_OPENAPI_KEY`(값은 기록하지 않음, 원본은 Aside Vault "국방부 OpenAPI 인증키"). 2026-11-25 이인영 I-PIN 로그인으로 발급·등록. 포털 로그인은 I-PIN 본인인증만 가능.
- 호출 방식(v0.7.0): 기본은 국방부 개방포털 시트 화면의 공개 JSON 다운로드 `opendata.mnd.go.kr/openinf/opencom/down2json.jsp`(POST, 로그인 불필요)를 `filterCol=dates&txtFilter=YYYY-MM`(국방부 표준식단 MND만 YYYYMM) 월 필터로 1회 호출하고 Worker 캐시에 3시간 보관. 응답 0바이트 = 그 달 식단 없음. 포털이 실패하면 인증키로 OpenAPI를 1000행씩 전체(최대 12번) 읽음. OpenAPI 행은 날짜순 정렬이 아니어서(육군훈련소 확인) 앞뒤만 보고 멈추면 최근 식단을 놓친다. 부대별로 날짜 표기(`2026-11-30(월)`, `2026-11-30`, `2026-11-9(월)`, `20180712`)와 헤더 순서(MND, 7021, 7017)가 달라 `HEADER_OVERRIDE`로 처리. openapi.mnd.go.kr는 user-agent 없는 요청을 400으로 거절.
- 도구: `mil_list_units`, `mil_get_meals`, `mil_compare_meals`, `mil_meal_allergen_check`. 테스트 `tests/mnd.test.mjs`(실제 sample 응답 형식 + 가짜 서버로 로직 검증).
