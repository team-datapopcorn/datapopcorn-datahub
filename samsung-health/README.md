# samsung-health

갤럭시 밴드 → 삼성헬스 데이터를 매일 1회 SQLite로 수집하는 파이프라인.
현재 폰에서 동기화 중인 소스: 걸음(분 단위), 심박수. 수면·운동은 Health Sync 앱에서
항목을 켜면 폴더가 생기고 자동 라우팅되지만, 파서 컬럼은 실제 CSV 확인 후 맞춰야 함
(`parsers.py` docstring 참고).

## 데이터 흐름

```
갤럭시 밴드 → 삼성헬스 앱 → Health Connect
  → Health Sync 앱 (폰, 자동) → Google Drive "Health Sync <종류>" 폴더별 CSV
  → 홈맥 launchd (매일 06:00) → sync_health.py → health.db (SQLite)
```

Health Sync는 종류별 폴더(예: `Health Sync 걸음`, `Health Sync 심박수`)에
일/주/월 단위 CSV를 중복 기록함 (`걸음 2026.07.05 Samsung Health.csv`,
`걸음 27-2026 ...`, `걸음 6월 2026 ...`). 중복은 자연 키 upsert로 해소됨.

## 파일

| 파일 | 역할 |
|------|------|
| `sync_health.py` | rclone으로 `Health Sync *` 폴더 전체 다운로드 → 파싱 → upsert. 진입점 |
| `health_db.py` | SQLite 스키마 + idempotent upsert. `steps_minutely` 원본 + `steps_daily` 일별 집계 뷰 |
| `parsers.py` | Health Sync CSV 파서 (한글 헤더: `날짜,시간,걸음` / `날짜,시간,심박수,데이터 소스`) |
| `health.db` | 데이터 저장소 (gitignore — 커밋 금지) |
| `raw/` | CSV 원본 보관 (gitignore) |
| `logs/` | 실행 로그 (gitignore) |
| `ai.datapopcorn.samsung-health.plist` | launchd 에이전트 (매일 06:00) |

## 설치 (1회)

### 1. 폰: Health Sync 설정

1. Play 스토어에서 Health Sync(appyhapps) 설치.
2. 동기화 방향: Samsung Health(또는 Health Connect) → **Google Drive**, 포맷 CSV.
3. 동기화 항목 선택 (걸음수, 심박수 등 — 켠 항목만 Drive에 폴더 생김).

### 2. 홈맥: rclone 인증

```bash
brew install rclone
rclone config create gdrive drive scope=drive.readonly   # 브라우저 OAuth — 폰 Google 계정으로
rclone lsd gdrive: | grep "Health Sync"                  # 종류별 폴더 보이는지 확인
```

### 3. 첫 수동 실행

```bash
python3 sync_health.py
sqlite3 health.db "SELECT * FROM steps_daily ORDER BY date DESC LIMIT 5;"
```

새 데이터 종류를 켰는데 0행 경고가 나오면: 실제 CSV 헤더를 보고 `parsers.py`와
`fixtures/`를 맞춘 뒤 재실행 (0행 파일은 processed로 마킹되지 않아 자동 재시도됨).

### 4. launchd 등록

```bash
# plist 안 경로가 이 레포의 실제 경로인지 먼저 확인/수정
cp ai.datapopcorn.samsung-health.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/ai.datapopcorn.samsung-health.plist
launchctl start ai.datapopcorn.samsung-health   # 즉시 1회 실행해 확인
tail -20 logs/sync.log
```

## 운영

- 재실행 안전: 자연 키 `INSERT OR REPLACE` + `sync_state`(파일명+크기)로 중복 없음.
- 실패 시: `logs/sync.log`, `logs/launchd.err.log` 확인. 다음 실행에서 밀린 파일까지 자동 처리.
- 테스트: `python3 -m unittest discover -v`

## 주의

- `health.db`/`raw/`/`logs/`는 개인 건강 데이터 포함 — git 커밋 금지 (`.gitignore` 처리됨).
- datahub-mcp-server 툴 노출은 http.js 인증 추가 전까지 금지 (CLAUDE.md).
