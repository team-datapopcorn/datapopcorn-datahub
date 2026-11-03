# datahub-mcp-server (Cloudflare Workers)

2026-11-03부터 `https://api.datapopcorn.ai/mcp`는 이 Worker가 서빙한다. 이전 방식(맥북 launchd + Cloudflare Tunnel)은
도메인이 Dev@datapopcorn.ai 계정으로 옮겨진 뒤 Error 1000으로 멈췄고, 터널 호스트에도 접속할 수 없어서 Worker로 옮겼다.

- 계정: Dev@datapopcorn.ai's Account, Worker 이름 `datapopcorn-datahub-mcp`, 커스텀 도메인 `api.datapopcorn.ai`
- 도구: guide, neis_list_office_codes, neis_search_schools, neis_get_meals (Node 버전과 같은 이름·인자)
- 비밀값: `NEIS_API_KEY` (`npx wrangler secret put NEIS_API_KEY`). NEIS의 `sample` 키는 2026-11-03 기준 ERROR-290으로 거절됨
- 배포: 이 폴더에서 `npx wrangler deploy`. `landing.html`은 `../public/index.html` 복사본이다

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
