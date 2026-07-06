# samsung-health

갤럭시 밴드 → 삼성헬스 데이터(걸음/수면/심박/운동)를 매일 1회 SQLite로 수집하는 파이프라인.

## 데이터 흐름

```
갤럭시 밴드 → 삼성헬스 앱 → Health Connect
  → Health Sync 앱 (폰, 자동) → Google Drive CSV
  → 홈맥 launchd (매일 06:00) → sync_health.py → health.db (SQLite)
```

## 파일

| 파일 | 역할 |
|------|------|
| `sync_health.py` | rclone으로 CSV 다운로드 → 파싱 → upsert. 진입점 |
| `health_db.py` | SQLite 스키마 + idempotent upsert |
| `parsers.py` | Health Sync CSV 파서 4종 |
| `health.db` | 데이터 저장소 (gitignore — 커밋 금지) |
| `raw/` | CSV 원본 보관 (gitignore) |
| `logs/` | 실행 로그 (gitignore) |
| `ai.datapopcorn.samsung-health.plist` | launchd 에이전트 (매일 06:00) |

## 설치 (1회)

### 1. 폰: Health Sync 설정

1. Play 스토어에서 Health Sync(appyhapps) 설치.
2. 동기화 방향: Samsung Health(또는 Health Connect) → **Google Drive**, 포맷 CSV.
3. 동기화 항목: 걸음수, 수면, 심박수, 운동.
4. Drive 폴더 이름 확인 (기본값을 `--remote`에 반영).

### 2. 홈맥: rclone 인증

```bash
brew install rclone
rclone config   # n → 이름 gdrive → drive 선택 → 브라우저 OAuth 인증
rclone ls gdrive:HealthSync   # CSV 보이는지 확인 (폴더명은 Health Sync 설정값)
```

### 3. 첫 수동 실행 + 파서 검증

```bash
python3 sync_health.py --remote gdrive:HealthSync
sqlite3 health.db "SELECT * FROM steps_daily ORDER BY date DESC LIMIT 5;"
```

실제 CSV 컬럼이 파서 가정과 다르면 `parsers.py`의 컬럼명과 `fixtures/`를 실제 포맷에 맞춰 수정.

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

- `health.db`/`raw/`는 개인 건강 데이터 — git 커밋 금지 (`.gitignore` 처리됨).
- datahub-mcp-server 툴 노출은 http.js 인증 추가 전까지 금지 (CLAUDE.md).
