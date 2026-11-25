// 국방부 공공데이터 개방(data.mnd.go.kr) 부대별 병영 표준식단 OpenAPI.
// 서비스명: DS_TB_MNDT_DATEBYMLSVC_{부대코드}. 한 행 = 한 날짜의 조식/중식/석식/증특식 메뉴 한 줄(메뉴별 열량 포함).
// 2026-11-25 운영 확인: Cloudflare Worker에서는 국방부 서버(포털·OpenAPI 모두)가 연결 시간 초과(HTTP 522)로 막힌다(해외 IP 차단 추정).
// 그래서 국내 맥의 동기화 스크립트(scripts/mnd-sync.mjs)가 포털에서 받은 식단을 /admin/mnd-sync로 올려 KV(MND_KV)에 보관하고,
// 도구는 KV 사본을 먼저 읽는다. KV에 그 부대가 없을 때만 아래 실시간 경로를 짧은 제한시간으로 시도한다.
// 실시간 조회 경로: (1) 기본은 국방부 개방포털 시트 화면의 공개 'JSON 다운로드'(opendata.mnd.go.kr/openinf/opencom/down2json.jsp,
// 로그인 불필요)를 월 단위 날짜 필터로 호출. 응답 0바이트 = 그 달 식단 없음. (2) 포털이 실패하면 인증키(MND_OPENAPI_KEY)로 OpenAPI 전체 조회.
// 이용조건: 공공누리 제3유형(출처표시+변경금지). 메뉴 이름은 원문 그대로 돌려주고, 알레르기 번호만 분리해 해석한다.

const MND_BASE = "https://openapi.mnd.go.kr";
const PORTAL = "https://opendata.mnd.go.kr/openinf";
const STD_HEADER = "dates,brst,brst_cal,lunc,lunc_cal,dinr,dinr_cal,adspcfd,adspcfd_cal,sum_cal";
// 포털 시트 화면의 txtEngHeader가 표준과 다른 부대(2026-11-25 확인).
const HEADER_OVERRIDE = {
  MND: "seq,dates,brst,lunc,dinr,etc",
  "7021": "dates,brst,lunc,dinr,brst_cal,lunc_cal,dinr_cal,adspcfd,adspcfd_cal,sum_cal",
  "7017": "dates,brst,lunc,dinr,brst_cal,lunc_cal,dinr_cal,adspcfd,adspcfd_cal,sum_cal,blnc_day",
};
const PORTAL_CACHE_TTL = 3 * 3600;
const LIVE_TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; DataPopcornDataMCP/1.0; +https://api.datapopcorn.ai)";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const CHUNK = 1000;
const MAX_DAYS = 31;
const ATTR = "출처: 국방부 공공데이터 개방(data.mnd.go.kr) 부대별 병영 표준식단, 공공누리 제3유형(출처표시+변경금지)";

// [부대코드, 이름, 제공기관, 데이터셋ID]. 2026-11-21 국방부 개방포털 OA-9400~9899 전수 확인(34개).
export const MND_UNITS = [
  ["MND", "국방부 표준식단(정보화기획참모부)", "국방부", "OA-9511"],
  ["ATC", "육군훈련소", "육군", "OA-9547"],
  ["1691", "1691부대", "육군", "OA-9548"],
  ["2171", "2171부대", "육군", "OA-9549"],
  ["3296", "3296부대", "육군", "OA-9550"],
  ["3389", "3389부대", "육군", "OA-9551"],
  ["5021", "5021부대", "육군", "OA-9552"],
  ["5322", "5322부대", "육군", "OA-9553"],
  ["6176", "6176부대", "육군", "OA-9554"],
  ["6282", "6282부대 (제공부서 7461부대)", "육군", "OA-9555"],
  ["6335", "6335부대", "육군", "OA-9556"],
  ["7369", "7369부대", "육군", "OA-9557"],
  ["7652", "7652부대", "해군", "OA-9558"],
  ["8623", "8623부대", "육군", "OA-9559"],
  ["8902", "8902부대", "육군", "OA-9560"],
  ["9030", "9030부대", "육군", "OA-9561"],
  ["7162", "7162부대", "육군", "OA-9562"],
  ["5397", "5397부대", "육군", "OA-9563"],
  ["3007", "3007부대", "육군", "OA-9564"],
  ["2621", "2621부대", "육군", "OA-9565"],
  ["3182", "3182부대", "육군", "OA-9566"],
  ["2291", "2291부대", "육군", "OA-9567"],
  ["1575", "1575부대", "육군", "OA-9568"],
  ["6685", "육군 6685부대", "육군", "OA-9579"],
  ["5861", "5861부대", "육군", "OA-9580"],
  ["1570", "1570부대", "육군", "OA-9582"],
  ["7296", "7296부대", "육군", "OA-9584"],
  ["1862", "1862부대", "육군", "OA-9585"],
  ["1968", "1968부대", "육군", "OA-9596"],
  ["2136", "2136부대", "육군", "OA-9597"],
  ["7021", "7021부대", "육군", "OA-9642"],
  ["5067", "5067부대", "육군", "OA-9643"],
  ["7017", "국군지휘통신사령부 7017부대", "국군지휘통신사령부", "OA-9650"],
  ["1975", "육군 1975부대", "육군", "OA-9654"]
].map(([code, name, provider, dataset]) => ({ code, name, provider, dataset, service: code === "MND" ? "DS_TB_MNDT_DATEBYMLSVC" : `DS_TB_MNDT_DATEBYMLSVC_${code}` }));

// 국방부 식단 알레르기 번호(데이터셋 설명 기준 01~18).
const ALLERGENS = {
  1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두", 6: "밀", 7: "고등어", 8: "게", 9: "새우", 10: "돼지고기",
  11: "복숭아", 12: "토마토", 13: "아황산염", 14: "호두", 15: "닭고기", 16: "쇠고기", 17: "오징어", 18: "조개류",
};
const ALLERGEN_ALIASES = {
  계란: 1, 달걀: 1, 난류: 1, 우유: 2, 유제품: 2, 메밀: 3, 땅콩: 4, 대두: 5, 콩: 5, 밀: 6, 밀가루: 6, 고등어: 7, 게: 8, 꽃게: 8,
  새우: 9, 돼지고기: 10, 돼지: 10, 복숭아: 11, 토마토: 12, 아황산염: 13, 아황산: 13, 호두: 14, 닭고기: 15, 닭: 15,
  쇠고기: 16, 소고기: 16, 오징어: 17, 조개류: 18, 조개: 18, 굴: 18, 전복: 18, 홍합: 18,
};
const MEALS = [
  ["breakfast", "조식", "brst", "brst_cal"], ["lunch", "중식", "lunc", "lunc_cal"],
  ["dinner", "석식", "dinr", "dinr_cal"], ["extra", "증특식", "adspcfd", "adspcfd_cal"],
];

const unitArg = { type: "string", description: "부대 코드(예: ATC, 5322) 또는 이름(예: 육군훈련소). 목록은 부대 목록 도구로 확인" };
const fromDate = { type: "string", description: "시작일 YYYY-MM-DD 또는 YYYYMMDD" };
const toDate = { type: "string", description: "종료일 YYYY-MM-DD 또는 YYYYMMDD (시작일부터 최대 31일)" };
const mealArg = { type: "string", enum: ["조식", "중식", "석식", "증특식"], description: "선택. 특정 끼니만" };

export const MND_TOOLS = [
  {
    name: "mil_list_units",
    description: "[국방부] 병영 표준식단을 공개하는 군부대 목록(부대 코드, 이름, 제공기관, 데이터셋 ID)을 보여줍니다. 육군훈련소(ATC) 포함 34곳. 예: '식단 공개하는 군부대 어디 있어?'",
    inputSchema: { type: "object", properties: { query: { type: "string", description: "선택. 코드·이름·제공기관 부분 일치(예: 해군, 훈련소)" } } },
    annotations: READ_ONLY,
  },
  {
    name: "mil_get_meals",
    description: "[국방부] 군부대 병영식당의 날짜별 조식·중식·석식·증특식 메뉴와 메뉴별 열량, 하루 총열량, 알레르기 정보를 조회합니다. 예: '육군훈련소 이번 주 점심 메뉴', '5322부대 11월 20일 식단'",
    inputSchema: {
      type: "object",
      properties: { unit: unitArg, date: { type: "string", description: "선택. 특정 날짜 하나" }, fromDate, toDate, meal: mealArg },
      required: ["unit"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "mil_compare_meals",
    description: "[국방부] 같은 날 여러 군부대(최대 6곳)의 식단과 하루 총열량을 나란히 비교합니다. 예: '오늘 육군훈련소랑 5322부대 점심 비교'",
    inputSchema: {
      type: "object",
      properties: {
        units: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6, description: "부대 코드 또는 이름 2~6개" },
        date: { type: "string", description: "날짜 YYYY-MM-DD 또는 YYYYMMDD" },
        meal: mealArg,
      },
      required: ["units", "date"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "mil_meal_allergen_check",
    description: "[국방부] 군부대 식단의 알레르기 번호(01~18)를 해석해, 지정한 알레르기 식품이 든 메뉴와 안전한 메뉴를 날짜별로 나눠 줍니다. 예: '육군훈련소 이번 주 식단에서 새우·땅콩 들어간 메뉴'",
    inputSchema: {
      type: "object",
      properties: {
        unit: unitArg,
        allergens: { type: "array", items: { type: ["string", "integer"] }, description: "알레르기 식품 이름 또는 번호, 예: [\"새우\", \"땅콩\"] 또는 [9, 4]" },
        date: { type: "string", description: "선택. 특정 날짜 하나" }, fromDate, toDate,
      },
      required: ["unit", "allergens"],
    },
    annotations: READ_ONLY,
  },
];

export const MND_TOOL_NAMES = new Set(MND_TOOLS.map((t) => t.name));

function ymd(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value).trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(s)) throw new Error(`${label} 날짜 형식이 잘못됨: ${value} (YYYY-MM-DD 또는 YYYYMMDD)`);
  return s;
}
const dash = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const todayKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, "");
function addDays(s, n) {
  const d = new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + n));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function findUnit(q) {
  const s = String(q ?? "").trim();
  if (!s) throw new Error("unit 값이 필요함");
  const n = s.replace(/^제/, "").replace(/\s/g, "").toUpperCase();
  const hit = MND_UNITS.find((u) => u.code === n || u.code === n.replace(/부대$/, ""))
    || MND_UNITS.find((u) => u.name.replace(/\s/g, "").toUpperCase().includes(n.replace(/부대$/, "")))
    || (/(육군)?훈련소|논산/.test(s) ? MND_UNITS.find((u) => u.code === "ATC") : undefined);
  if (!hit) throw new Error(`식단을 공개하는 부대 목록에 없음: ${s}. 부대 목록 도구로 코드 확인`);
  return hit;
}

// 날짜 문자열 정규화: "2021-05-03", "2025-05-30(금)", "20210503" → "20210503"
export function rowDate(v) {
  const t = String(v ?? "");
  const m = t.match(/(\d{4})[-.](\d{1,2})[-.](\d{1,2})/) || t.match(/(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}${m[2].padStart(2, "0")}${m[3].padStart(2, "0")}` : null;
}
const kcal = (v) => { const m = String(v ?? "").match(/[\d.]+/); return m ? Math.round(parseFloat(m[0]) * 10) / 10 : null; };

// "비엔나소시지야채볶음(05)(06)(10)" → { name, allergens:[{no,name}] }. 숫자 아닌 괄호(예: (임가공))는 이름에 남긴다.
export function parseDish(raw) {
  const text = String(raw ?? "").trim();
  if (!text) return null;
  const nums = [];
  const name = text.replace(/\((\d{1,2})\)/g, (_, d) => { nums.push(+d); return ""; }).trim();
  return { name, allergens: [...new Set(nums)].map((no) => ({ no, name: ALLERGENS[no] || `번호 ${no}` })) };
}

async function mndJson(env, service, start, end) {
  const key = env.MND_OPENAPI_KEY;
  if (!key) throw new Error("국방부 OpenAPI 인증키(MND_OPENAPI_KEY)가 서버에 아직 설정되지 않았습니다. data.mnd.go.kr 인증키 발급 후 사용 가능");
  const url = `${MND_BASE}/${encodeURIComponent(key)}/json/${service}/${start}/${end}/`;
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json" }, cf: { cacheTtl: 3600, cacheEverything: true }, signal: AbortSignal.timeout(LIVE_TIMEOUT_MS) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`국방부 API 응답을 읽지 못함 (HTTP ${res.status})`); }
  if (data.RESULT && !data[service]) {
    const code = data.RESULT.CODE;
    if (code === "INFO-200") return { total: 0, rows: [] };
    if (code === "INFO-100") throw new Error("국방부 OpenAPI 인증키가 유효하지 않음(INFO-100)");
    throw new Error(`국방부 API 오류 ${code}: ${String(data.RESULT.MESSAGE || "").split("\n")[0]}`);
  }
  const body = data[service] || {};
  return { total: Number(body.list_total_count) || 0, rows: body.row || [] };
}

// 포털 JSON은 한 줄에 한 행이며, 원본 엑셀 수식(예: IF(A8="",H7,A8))의 따옴표가 이스케이프되지 않아 전체 JSON.parse가 깨질 때가 있다
// (2026-11-25 2171·5397·7296부대). 실패하면 줄 단위로 읽고, 그래도 깨진 줄은 "키":"값" 경계로 필드를 뽑는다. 수식 값은 빈칸 처리.
export function parsePortalRows(text) {
  const clean = (r) => { for (const k of Object.keys(r)) if (/^IF\(|^=/.test(String(r[k]))) r[k] = ""; return r; };
  try { return (JSON.parse(text).DATA || []).map(clean); } catch { /* 아래에서 줄 단위 복구 */ }
  const rows = [];
  for (let line of text.split("\n")) {
    line = line.trim().replace(/^,/, "").replace(/,$/, "");
    if (!line.startsWith('{"')) continue;
    try { rows.push(clean(JSON.parse(line))); continue; } catch { /* 필드 단위 */ }
    const r = {};
    for (const m of line.matchAll(/"([a-z_]+)":"(.*?)"(?=,"[a-z_]+":"|\s*\}\s*\]?\s*$)/g)) r[m[1]] = m[2];
    if (r.dates) rows.push(clean(r));
  }
  return rows;
}

// 포털 공개 다운로드로 한 달치 행을 받는다. 같은 달은 Worker 캐시에 3시간 보관.
async function portalMonth(unit, yyyymm) {
  const dsId = unit.service.replace(/^DS_/, "");
  const header = HEADER_OVERRIDE[unit.code] || STD_HEADER;
  const filter = unit.code === "MND" ? yyyymm : `${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}`;
  const cacheKey = new Request(`https://mnd-portal-cache.datapopcorn.ai/${dsId}/${filter}`);
  const cache = typeof caches !== "undefined" ? caches.default : null;
  if (cache) {
    const hit = await cache.match(cacheKey).catch(() => null);
    if (hit) return hit.json();
  }
  const referer = `${PORTAL}/sheetview2.jsp?infId=${unit.dataset}`;
  const body = new URLSearchParams({ dsId, vinfId: unit.dataset, infSeq: "1", txtEngHeader: header, txtKorHeader: header, filterCol: "dates", txtFilter: filter });
  const res = await fetch(`${PORTAL}/opencom/down2json.jsp`, {
    method: "POST",
    headers: { "user-agent": UA, referer, "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`국방부 개방포털 응답 오류 (HTTP ${res.status})`);
  const text = (await res.text()).trim();
  let rows = [];
  if (text) {
    if (text.startsWith("<")) throw new Error("국방부 개방포털이 데이터를 돌려주지 않음(접근 거부). 잠시 뒤 다시 시도");
    rows = parsePortalRows(text);
  }
  // 필터는 부분 일치라 '2026-1'처럼 다른 달이 섞일 수 있어 정확히 그 달만 남긴다.
  rows = rows.filter((r) => (rowDate(r.dates) || "").startsWith(yyyymm));
  if (cache) {
    await cache.put(cacheKey, new Response(JSON.stringify(rows), { headers: { "content-type": "application/json", "cache-control": `max-age=${PORTAL_CACHE_TTL}` } })).catch(() => {});
  }
  return rows;
}

async function portalRowsInRange(unit, from, to) {
  const months = [];
  for (let m = from.slice(0, 6); m <= to.slice(0, 6);) {
    months.push(m);
    const y = +m.slice(0, 4), mo = +m.slice(4, 6);
    m = mo === 12 ? `${y + 1}01` : `${y}${String(mo + 1).padStart(2, "0")}`;
  }
  const out = [];
  for (const m of months) {
    for (const r of await portalMonth(unit, m)) {
      const d = rowDate(r.dates);
      if (d && d >= from && d <= to) out.push(r);
    }
  }
  return { total: null, rows: out, scanned: null, via: "portal" };
}

// 공식 OpenAPI 경로. 행이 날짜순으로 정렬돼 있지 않아(2026-11-25 육군훈련소 확인) 앞뒤만 보고 멈출 수 없으므로
// 1000행씩 전체를 읽는다(최대 12번 호출 = 12,000행; 가장 큰 부대가 약 1만 행).
async function apiRowsInRange(env, unit, from, to) {
  const head = await mndJson(env, unit.service, 1, 1);
  const total = head.total;
  if (!total) return { total: 0, rows: [], scanned: 0, via: "openapi" };
  const out = [];
  let scanned = 0;
  for (let i = 0; i < 12 && scanned < total; i++) {
    const start = scanned + 1, end = Math.min(total, scanned + CHUNK);
    const chunk = await mndJson(env, unit.service, start, end);
    scanned = end;
    for (const r of chunk.rows) {
      const d = rowDate(r.dates);
      if (d && d >= from && d <= to) out.push(r);
    }
  }
  return { total, rows: out, scanned, via: "openapi" };
}

// KV 사본: u:{코드} = {syncedAt, years:[...]}, y:{코드}:{연도} = {syncedAt, rows:[...]}. 부대 메타가 없으면 null(사본 없음).
async function mirrorRowsInRange(env, unit, from, to) {
  if (!env.MND_KV) return null;
  const meta = await env.MND_KV.get(`u:${unit.code}`, "json");
  if (!meta) return null;
  const out = [];
  for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y++) {
    if (!meta.years?.includes(String(y))) continue;
    const blob = await env.MND_KV.get(`y:${unit.code}:${y}`, "json");
    for (const r of blob?.rows || []) {
      const d = rowDate(r.dates);
      if (d && d >= from && d <= to) out.push(r);
    }
  }
  return { total: null, rows: out, scanned: null, via: "mirror", syncedAt: meta.syncedAt };
}

// 순서: KV 사본 → 포털 월 필터 다운로드 → (인증키 있으면) 공식 OpenAPI 전체 조회. 실시간 경로는 8초 제한.
async function rowsInRange(env, unit, from, to) {
  const m = await mirrorRowsInRange(env, unit, from, to);
  if (m) return m;
  try {
    return await portalRowsInRange(unit, from, to);
  } catch (e) {
    if (!env.MND_OPENAPI_KEY) throw liveError(e);
    try { return await apiRowsInRange(env, unit, from, to); } catch (e2) { throw liveError(e2); }
  }
}

function liveError(e) {
  const msg = String(e?.message || e);
  if (/timeout|abort|522|521|524/i.test(msg)) return new Error("국방부 서버에 연결하지 못함(시간 초과). 이 부대의 식단 사본이 아직 동기화되지 않았을 수 있음. 잠시 뒤 다시 시도");
  return e instanceof Error ? e : new Error(msg);
}

// 국내 동기화 스크립트가 올리는 식단 사본 수신. Authorization: Bearer MND_SYNC_TOKEN.
// body: { code, syncedAt, allYears:["2025","2026"], years: { "2026": [행...] } } (바뀐 연도만 rows 포함)
export async function handleMndSync(request, env) {
  const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  if (!env.MND_SYNC_TOKEN || !env.MND_KV) return json({ error: "not configured" }, 503);
  const auth = request.headers.get("authorization") || "";
  const expected = `Bearer ${env.MND_SYNC_TOKEN}`;
  if (auth.length !== expected.length) return json({ error: "unauthorized" }, 401);
  let diff = 0;
  for (let i = 0; i < auth.length; i++) diff |= auth.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff) return json({ error: "unauthorized" }, 401);
  let body;
  try { body = await request.json(); } catch { return json({ error: "bad json" }, 400); }
  const unit = MND_UNITS.find((u) => u.code === body?.code);
  if (!unit) return json({ error: "unknown unit" }, 400);
  const syncedAt = String(body.syncedAt || new Date().toISOString());
  const allYears = (Array.isArray(body.allYears) ? body.allYears : []).map(String).filter((y) => /^\d{4}$/.test(y));
  const years = body.years && typeof body.years === "object" ? body.years : {};
  let written = 0;
  for (const [y, rows] of Object.entries(years)) {
    if (!/^\d{4}$/.test(y) || !Array.isArray(rows)) continue;
    const clean = rows.map((r) => {
      const o = {};
      for (const k of ["dates", "brst", "brst_cal", "lunc", "lunc_cal", "dinr", "dinr_cal", "adspcfd", "adspcfd_cal", "sum_cal"]) if (r?.[k] != null) o[k] = String(r[k]);
      return o;
    });
    await env.MND_KV.put(`y:${unit.code}:${y}`, JSON.stringify({ syncedAt, rows: clean }));
    written++;
    if (!allYears.includes(y)) allYears.push(y);
  }
  await env.MND_KV.put(`u:${unit.code}`, JSON.stringify({ syncedAt, years: allYears.sort() }));
  return json({ ok: true, code: unit.code, written, years: allYears.length });
}

function groupDays(rows, mealFilter) {
  const days = new Map();
  for (const r of rows) {
    const d = rowDate(r.dates);
    if (!days.has(d)) days.set(d, { date: dash(d), totalKcal: kcal(r.sum_cal), meals: {} });
    const day = days.get(d);
    if (day.totalKcal == null) day.totalKcal = kcal(r.sum_cal);
    for (const [, label, f, fc] of MEALS) {
      if (mealFilter && mealFilter !== label) continue;
      const dish = parseDish(r[f]);
      if (!dish) continue;
      const k = kcal(r[fc]);
      (day.meals[label] ||= { dishes: [], kcal: 0 }).dishes.push({ ...dish, kcal: k });
      if (k != null) day.meals[label].kcal = Math.round((day.meals[label].kcal + k) * 10) / 10;
    }
  }
  return [...days.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function range(args) {
  let from = ymd(args.date, "date") || ymd(args.fromDate, "fromDate");
  let to = ymd(args.date, "date") || ymd(args.toDate, "toDate");
  if (!from && !to) { from = todayKst(); to = addDays(from, 6); }
  if (!from) from = to;
  if (!to) to = from;
  if (from > to) [from, to] = [to, from];
  if (to > addDays(from, MAX_DAYS - 1)) throw new Error(`기간은 최대 ${MAX_DAYS}일`);
  return { from, to };
}

function allergenNos(list) {
  if (!Array.isArray(list) || !list.length) throw new Error("allergens 배열이 필요함");
  return [...new Set(list.map((a) => {
    if (typeof a === "number" || /^\d+$/.test(String(a).trim())) {
      const n = +a; if (!ALLERGENS[n]) throw new Error(`알레르기 번호는 1~18: ${a}`); return n;
    }
    const n = ALLERGEN_ALIASES[String(a).trim()];
    if (!n) throw new Error(`알 수 없는 알레르기 식품: ${a} (가능: ${Object.values(ALLERGENS).join(", ")})`);
    return n;
  }))];
}

export async function callMndTool(name, args = {}, env = {}) {
  switch (name) {
    case "mil_list_units": {
      const q = String(args.query ?? "").trim();
      const units = q ? MND_UNITS.filter((u) => `${u.code} ${u.name} ${u.provider}`.includes(q) || (/훈련소|논산/.test(q) && u.code === "ATC")) : MND_UNITS;
      return {
        source: "mnd-opendata", count: units.length,
        units: units.map(({ code, name, provider, dataset }) => ({ code, name, provider, dataset, page: `${PORTAL}/sheetview2.jsp?infId=${dataset}` })),
        note: "부대 이름은 국방부가 공개한 부대 번호(대외 명칭) 기준. 갱신 주기는 부대마다 다르며 일부는 몇 달 전 식단까지만 올라와 있을 수 있음.",
        attribution: ATTR,
      };
    }
    case "mil_get_meals": {
      const unit = findUnit(args.unit);
      const { from, to } = range(args);
      const r = await rowsInRange(env, unit, from, to);
      const days = groupDays(r.rows, args.meal);
      return {
        source: "mnd-opendata", unit: { code: unit.code, name: unit.name, provider: unit.provider, dataset: unit.dataset },
        fromDate: dash(from), toDate: dash(to), dayCount: days.length, days,
        dataAsOf: r.syncedAt ? `국방부 개방포털 기준 ${r.syncedAt.slice(0, 16).replace("T", " ")} (UTC) 동기화` : undefined,
        note: days.length ? undefined : (r.via !== "openapi" ? "이 기간 식단이 없음. 부대마다 업로드 시점이 달라 최근 날짜가 비어 있거나 몇 달 전까지만 올라와 있을 수 있음" : `이 기간 식단이 없음(전체 ${r.total}행 중 최근 ${r.scanned}행 확인). 부대마다 업로드 시점이 달라 최근 날짜가 비어 있을 수 있음`),
        attribution: ATTR,
      };
    }
    case "mil_compare_meals": {
      const list = Array.isArray(args.units) ? args.units : [];
      if (list.length < 2 || list.length > 6) throw new Error("units는 2~6개");
      const d = ymd(args.date, "date");
      if (!d) throw new Error("date 값이 필요함");
      const units = list.map(findUnit);
      const results = await Promise.all(units.map(async (u) => {
        try {
          const r = await rowsInRange(env, u, d, d);
          const day = groupDays(r.rows, args.meal)[0];
          return { code: u.code, name: u.name, totalKcal: day?.totalKcal ?? null, meals: day?.meals ?? null, note: day ? undefined : "이 날짜 식단 없음" };
        } catch (e) { return { code: u.code, name: u.name, error: e.message }; }
      }));
      if (results.every((x) => x.error)) throw new Error(results[0].error);
      return { source: "mnd-opendata", date: dash(d), meal: args.meal || "전체", units: results, attribution: ATTR };
    }
    case "mil_meal_allergen_check": {
      const unit = findUnit(args.unit);
      const nos = allergenNos(args.allergens);
      const { from, to } = range(args);
      const r = await rowsInRange(env, unit, from, to);
      const days = groupDays(r.rows).map((day) => ({
        date: day.date,
        meals: Object.fromEntries(Object.entries(day.meals).map(([label, m]) => {
          const avoid = m.dishes.filter((x) => x.allergens.some((a) => nos.includes(a.no)));
          const safe = m.dishes.filter((x) => !avoid.includes(x));
          return [label, { avoid: avoid.map((x) => ({ name: x.name, matched: x.allergens.filter((a) => nos.includes(a.no)).map((a) => a.name) })), safe: safe.map((x) => x.name) }];
        })),
      }));
      return {
        source: "mnd-opendata", unit: { code: unit.code, name: unit.name }, allergens: nos.map((n) => ({ no: n, name: ALLERGENS[n] })),
        fromDate: dash(from), toDate: dash(to), days,
        note: "국방부는 번호와 식품의 연결이 바뀔 수 있으니 알레르기가 있으면 부대에 다시 확인하라고 안내함. 번호 표시가 없는 메뉴는 '안전'으로 분류되지만 성분이 없다는 보장은 아님.",
        attribution: ATTR,
      };
    }
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}
