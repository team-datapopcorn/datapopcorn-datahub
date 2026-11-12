ALTER TABLE events ADD COLUMN country TEXT;
ALTER TABLE events ADD COLUMN region TEXT;
ALTER TABLE events ADD COLUMN city TEXT;
ALTER TABLE events ADD COLUMN asn_org TEXT;
ALTER TABLE events ADD COLUMN origin TEXT;      -- local | cloud (요청 출발지가 사용자 기기인지 클라우드인지 ASN으로 추정)
ALTER TABLE events ADD COLUMN device TEXT;      -- mobile | tablet | desktop | app
ALTER TABLE events ADD COLUMN os TEXT;
ALTER TABLE events ADD COLUMN browser TEXT;
ALTER TABLE events ADD COLUMN app TEXT;         -- Claude Code, Codex, ChatGPT, Aside ...
ALTER TABLE events ADD COLUMN app_ver TEXT;
ALTER TABLE events ADD COLUMN ua TEXT;
ALTER TABLE events ADD COLUMN ref_source TEXT;
ALTER TABLE events ADD COLUMN ref_medium TEXT;
ALTER TABLE events ADD COLUMN ref_campaign TEXT;
ALTER TABLE events ADD COLUMN ref_host TEXT;
ALTER TABLE events ADD COLUMN ref_landing TEXT;
ALTER TABLE events ADD COLUMN auth_referer TEXT;
ALTER TABLE users ADD COLUMN signup_ref_source TEXT;
ALTER TABLE users ADD COLUMN signup_ref_host TEXT;
ALTER TABLE users ADD COLUMN signup_ref_medium TEXT;
ALTER TABLE users ADD COLUMN signup_ref_campaign TEXT;
ALTER TABLE users ADD COLUMN signup_ref_landing TEXT;
ALTER TABLE users ADD COLUMN signup_auth_referer TEXT;
ALTER TABLE users ADD COLUMN signup_country TEXT;
ALTER TABLE users ADD COLUMN signup_city TEXT;
ALTER TABLE users ADD COLUMN signup_device TEXT;
ALTER TABLE clients ADD COLUMN app TEXT;
ALTER TABLE clients ADD COLUMN app_ver TEXT;
CREATE INDEX IF NOT EXISTS idx_events_kind_day ON events(kind, day);
