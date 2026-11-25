#!/usr/bin/env node
// 국방부 병영식단 사본 동기화 (국내 맥에서 실행, LLM 없음).
// Cloudflare Worker는 국방부 서버에 접속하지 못해(HTTP 522, 2026-11-25 확인) 국내 IP에서 포털 공개 JSON 다운로드로
// 부대별 전체 식단을 받아 연도별로 나눈 뒤, 바뀐 연도만 https://api.datapopcorn.ai/admin/mnd-sync 로 올린다.
//
// 사용: node mnd-sync.mjs            (바뀐 연도만 업로드)
//       node mnd-sync.mjs --all      (전체 다시 업로드)
//       node mnd-sync.mjs --dry-run  (받기만, 업로드 안 함)
// 설정: ~/.config/datapopcorn/mnd-sync.env 에 MND_SYNC_TOKEN=... (권한 600). 상태: 같은 폴더 mnd-sync-state.json
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { MND_UNITS, parsePortalRows } from "./mnd.js";

const ENDPOINT = process.env.MND_SYNC_ENDPOINT || "https://api.datapopcorn.ai/admin/mnd-sync";
const CONF_DIR = path.join(os.homedir(), ".config", "datapopcorn");
const STATE = path.join(CONF_DIR, "mnd-sync-state.json");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const PORTAL = "https://opendata.mnd.go.kr/openinf";
const STD_HEADER = "dates,brst,brst_cal,lunc,lunc_cal,dinr,dinr_cal,adspcfd,adspcfd_cal,sum_cal";
const HEADER_OVERRIDE = {
  MND: "seq,dates,brst,lunc,dinr,etc",
  "7021": "dates,brst,lunc,dinr,brst_cal,lunc_cal,dinr_cal,adspcfd,adspcfd_cal,sum_cal",
  "7017": "dates,brst,lunc,dinr,brst_cal,lunc_cal,dinr_cal,adspcfd,adspcfd_cal,sum_cal,blnc_day",
};
const args = new Set(process.argv.slice(2));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readToken() {
  if (process.env.MND_SYNC_TOKEN) return process.env.MND_SYNC_TOKEN.trim();
  const f = path.join(CONF_DIR, "mnd-sync.env");
  const m = fs.readFileSync(f, "utf8").match(/^MND_SYNC_TOKEN=(.+)$/m);
  if (!m) throw new Error(`MND_SYNC_TOKEN 없음: ${f}`);
  return m[1].trim();
}

function rowDate(v) {
  const t = String(v ?? "");
  const m = t.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/) || t.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}` : null;
}

async function downloadAll(unit) {
  const dsId = unit.service.replace(/^DS_/, "");
  const header = HEADER_OVERRIDE[unit.code] || STD_HEADER;
  const body = new URLSearchParams({ dsId, vinfId: unit.dataset, infSeq: "1", txtEngHeader: header, txtKorHeader: header, filterCol: "", txtFilter: "" });
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(`${PORTAL}/opencom/down2json.jsp`, {
        method: "POST",
        headers: { "user-agent": UA, referer: `${PORTAL}/sheetview2.jsp?infId=${unit.dataset}`, "content-type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(120000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = (await res.text()).trim();
      if (!text) return [];
      if (text.startsWith("<")) throw new Error("포털이 HTML을 돌려줌(접근 거부)");
      return parsePortalRows(text);
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(3000 * attempt);
    }
  }
}

const hash = (rows) => crypto.createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16);

async function main() {
  const token = args.has("--dry-run") ? null : readToken();
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf8")) : {};
  const syncedAt = new Date().toISOString();
  const summary = { ok: 0, failed: [], uploadedYears: 0, rows: 0 };
  for (const unit of MND_UNITS) {
    try {
      const rows = await downloadAll(unit);
      const byYear = {};
      for (const r of rows) {
        const d = rowDate(r.dates);
        if (!d) continue;
        (byYear[d.slice(0, 4)] ||= []).push(r);
      }
      const allYears = Object.keys(byYear).sort();
      const prev = state[unit.code]?.hashes || {};
      const hashes = Object.fromEntries(allYears.map((y) => [y, hash(byYear[y])]));
      const changed = args.has("--all") ? allYears : allYears.filter((y) => prev[y] !== hashes[y]);
      summary.rows += rows.length;
      if (!args.has("--dry-run") && (changed.length || !state[unit.code])) {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({ code: unit.code, syncedAt, allYears, years: Object.fromEntries(changed.map((y) => [y, byYear[y]])) }),
          signal: AbortSignal.timeout(120000),
        });
        const out = await res.json().catch(() => ({}));
        if (!res.ok || !out.ok) throw new Error(`업로드 실패 HTTP ${res.status} ${out.error || ""}`);
        summary.uploadedYears += changed.length;
        state[unit.code] = { hashes, syncedAt, rows: rows.length };
      } else if (!args.has("--dry-run")) {
        state[unit.code] = { ...state[unit.code], checkedAt: syncedAt };
      }
      summary.ok++;
      console.log(`${unit.code}\t${rows.length}행\t연도 ${allYears.join(",") || "-"}\t업로드 ${args.has("--dry-run") ? "건너뜀" : changed.join(",") || "없음"}`);
    } catch (e) {
      summary.failed.push(`${unit.code}: ${e.message}`);
      console.log(`${unit.code}\t실패\t${e.message}`);
    }
    await sleep(500);
  }
  if (!args.has("--dry-run")) {
    fs.mkdirSync(CONF_DIR, { recursive: true });
    fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  }
  console.log(`${syncedAt} 완료: 성공 ${summary.ok}/${MND_UNITS.length}, 업로드 연도 ${summary.uploadedYears}, 총 ${summary.rows}행${summary.failed.length ? `, 실패 ${summary.failed.length}` : ""}`);
  if (summary.failed.length > MND_UNITS.length / 2) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
