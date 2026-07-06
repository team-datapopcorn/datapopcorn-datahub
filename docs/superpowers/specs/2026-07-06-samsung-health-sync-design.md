# Samsung Health 일일 수집 파이프라인 설계

날짜: 2026-07-06
상태: 승인됨
대상 폴더: `samsung-health/` (신규)

## 목표

갤럭시 밴드로 측정되는 삼성헬스 데이터(걸음수/활동량, 수면, 심박수, 운동 기록)를
하루 1회 자동으로 홈맥에 수집해 SQLite에 적재한다.

## 배경 제약

- 삼성헬스는 개인용 공개 REST API가 없다. 폰에서 데이터를 내보내는 브릿지가 필수.
- 브릿지로 **Health Sync 앱**(유료)을 사용한다: 삼성헬스 → Google Drive에 CSV 자동 업로드.
  걸음·수면·심박·운동 전부 지원하며, 설정 후 유지보수가 없다.
- 건강 데이터는 개인 정보다. CSV 원본과 SQLite DB는 git에 커밋하지 않는다(gitignore).
- `datahub-mcp-server/http.js`에는 아직 인증이 없으므로 MCP 툴 노출은 이번 범위에서 제외한다.
  (CLAUDE.md 규칙: 인증 없이 개인 데이터 소스를 연결하지 않는다.)

## 데이터 흐름

```
갤럭시 밴드 → 삼성헬스 앱 → Health Connect
  → Health Sync 앱 (폰에서 자동, 매일) → Google Drive CSV 폴더
  → 홈맥 launchd (매일 06:00) → sync_health.py
  → rclone으로 CSV 내려받기 → 파싱 → SQLite upsert
```

## 구성요소

`samsung-health/` 폴더:

| 파일 | 역할 |
|------|------|
| `sync_health.py` | rclone으로 Drive 폴더의 새 CSV를 내려받고, 4종 데이터를 파싱해 SQLite에 idempotent upsert |
| `health.db` | SQLite 저장소. gitignore 대상 |
| `raw/` | 내려받은 CSV 원본 보관. gitignore 대상 |
| `ai.datapopcorn.samsung-health.plist` | launchd 유저 에이전트. 매일 06:00 실행. 기존 `ai.datapopcorn.mcp-server` 패턴과 동일 |
| `README.md` | 설치 절차: Health Sync 설정, rclone 인증, launchd 로드 |

### SQLite 스키마 (초안)

- `steps_daily(date PRIMARY KEY, steps, distance_m, calories)`
- `sleep_sessions(start_time PRIMARY KEY, end_time, duration_min, stage_summary)`
- `heart_rate(measured_at PRIMARY KEY, bpm)`
- `exercises(start_time PRIMARY KEY, type, duration_min, distance_m, calories)`

실제 컬럼은 Health Sync가 생성하는 실제 CSV 포맷을 확인한 뒤 확정한다.
파서는 폰 설정 완료 후 실제 CSV 기준으로 작성한다.

### Idempotency

- 자연 키(date/start_time/measured_at) 기준 `INSERT OR REPLACE`.
- 같은 CSV를 여러 번 처리해도 중복 행이 생기지 않는다.
- 마지막 처리 파일/시각을 상태로 기록해 불필요한 재다운로드를 줄인다.

## 사전 설정 (수동 1회)

1. 폰에 Health Sync 설치 → 삼성헬스 → Google Drive CSV 동기화 설정 (걸음·수면·심박·운동).
2. 홈맥에서 `rclone config`로 Google Drive 원격 인증 (토큰 자동갱신).
3. launchd plist 로드.

## 에러 처리

- 실행 로그를 파일로 남긴다.
- CSV 포맷이 예상과 다르면 해당 행만 스킵하고 경고 로그. 전체 실패로 만들지 않는다.
- rclone/네트워크 실패 시 비정상 종료 코드 + 로그. 다음 날 실행에서 밀린 파일까지 처리된다.

## 검증

- Health Sync가 실제로 만든 CSV 하나를 받아 수동 실행 → DB 내용 확인.
- 같은 파일 재실행 → 행 수 불변(중복 없음) 확인.

## 범위 밖 (이번에 하지 않음)

- datahub-mcp-server 툴 노출 (`tools/health.js`) — http.js 인증 추가 이후.
- 대시보드/시각화.
- 알림.
