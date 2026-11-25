// 국가데이터처(구 통계청) KOSIS 공유서비스 OpenAPI. 인증키: Worker 시크릿 KOSIS_API_KEY.
// 이용조건(kosis.kr 통계정보 이용지침, 2026-11-25 확인): 무료, 사용·재사용·재배포·상업적 활용 가능. 출처 명시 필수.
// 예외: 국제통계·북한통계는 비상업적 목적만, 재배포 금지 → 검색 결과에서 제외한다. 가공 없이 유료 판매 금지.
// 호출 제한: 분당 200회, 요청 1회당 40,000셀. Cloudflare Worker에서 직접 접속 가능(2026-11-25 실측).

const BASE = "https://kosis.kr/openapi";
const UA = "Mozilla/5.0 (compatible; DataPopcornDataMCP/1.0; +https://api.datapopcorn.ai)";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const MAX_ROWS = 400;
// 국제통계(MT_RTITLE, MT_RTITLE01 등 아주지역·국제기구·국제통계연감)와 북한통계(MT_BUKHAN). 2026-11-25 검색 결과로 확인.
const isExcludedView = (vw) => /^MT_RTITLE|^MT_BUKHAN|^MT_BTITLE/.test(String(vw || ""));
const PRD_SE = { Y: "년", H: "반기", Q: "분기", M: "월", D: "일", IR: "부정기", F: "다년" };
const ERR = {
  10: "인증키 누락", 11: "인증키 기간 만료", 20: "필수 요청변수 누락", 21: "잘못된 요청변수", 30: "조회 결과 없음",
  31: "조회 결과가 너무 많음(40,000셀 초과). 항목·분류를 줄이거나 기간을 좁혀야 함", 40: "분당 호출 한도(200회) 초과", 41: "호출 가능 행 수 제한", 42: "사용자별 이용 제한", 50: "KOSIS 서버 오류",
};

const orgId = { type: "string", description: "기관 코드(통계표 검색 결과의 orgId, 예: 101 = 국가데이터처)" };
const tblId = { type: "string", description: "통계표 ID(통계표 검색 결과의 tblId, 예: DT_1B8000F)" };

export const KOSIS_TOOLS = [
  {
    name: "kosis_search_tables",
    description: "[국가데이터처 KOSIS] 국가승인통계 약 29만 개 통계표(국제·북한통계 제외)를 키워드로 검색해 기관·통계표 ID·조사명·수록기간·KOSIS 위치를 돌려줍니다. 수치를 가져오기 전 첫 단계. 예: '합계출산율 통계표 찾아줘', '시도별 실업률', '1인 가구'",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어(예: 출생아수, 소비자물가지수, 시도별 인구)" },
        orgId: { type: "string", description: "선택. 기관 코드로 제한(예: 101 = 국가데이터처)" },
        sort: { type: "string", enum: ["정확도", "최신"], description: "선택. 기본 정확도" },
        count: { type: "integer", minimum: 1, maximum: 30, description: "선택. 결과 개수(기본 10)" },
      },
      required: ["query"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "kosis_table_info",
    description: "[국가데이터처 KOSIS] 통계표 하나의 구조를 보여줍니다: 표 이름, 수록 주기와 기간, 항목(itmId) 목록, 분류(objL1~objL8)별 코드 목록, 단위. 수치를 조회할 때 넣을 코드를 여기서 고릅니다.",
    inputSchema: { type: "object", properties: { orgId, tblId }, required: ["orgId", "tblId"] },
    annotations: READ_ONLY,
  },
  {
    name: "kosis_get_data",
    description: "[국가데이터처 KOSIS] 통계표의 실제 수치를 조회합니다(항목·분류·기간 지정). 결과는 시점·분류·항목·값·단위 행 목록과 출처 정보. 예: '최근 10년 출생아수', '2025년 시도별 실업률'",
    inputSchema: {
      type: "object",
      properties: {
        orgId, tblId,
        itmId: { type: "string", description: "항목 코드. 여러 개는 공백으로 구분(예: 'T1 T2'). 기본 ALL" },
        objL1: { type: "string", description: "분류1 코드. 여러 개는 공백 구분. 기본 ALL" },
        objL2: { type: "string", description: "선택. 분류2 코드(표에 분류2가 있으면 기본 ALL)" },
        objL3: { type: "string", description: "선택. 분류3 코드" },
        objL4: { type: "string", description: "선택. 분류4 코드" },
        prdSe: { type: "string", enum: ["Y", "H", "Q", "M", "D", "IR", "F"], description: "수록 주기(Y 년, Q 분기, M 월 등). 생략하면 표의 첫 주기" },
        startPrdDe: { type: "string", description: "선택. 시작 시점(년 2015, 월 202401, 분기 202401)" },
        endPrdDe: { type: "string", description: "선택. 종료 시점" },
        recent: { type: "integer", minimum: 1, maximum: 60, description: "선택. 시작·종료 대신 최근 N개 시점(기본 5)" },
      },
      required: ["orgId", "tblId"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "kosis_survey_info",
    description: "[국가데이터처 KOSIS] 통계조사(조사 ID)의 공식 설명을 보여줍니다: 작성 목적, 법적 근거, 조사 주기·대상·방법, 공표 범위, 작성 기관과 연락처. 숫자를 해석하거나 출처를 쓸 때 사용.",
    inputSchema: { type: "object", properties: { statId: { type: "string", description: "조사 ID(통계표 검색 결과의 statId, 예: 1962004 = 인구동향조사)" } }, required: ["statId"] },
    annotations: READ_ONLY,
  },
];

export const KOSIS_TOOL_NAMES = new Set(KOSIS_TOOLS.map((t) => t.name));

async function kosis(env, path, params) {
  const key = env.KOSIS_API_KEY;
  if (!key) throw new Error("KOSIS 인증키(KOSIS_API_KEY)가 서버에 설정되지 않았습니다.");
  const qs = new URLSearchParams({ ...params, apiKey: key, format: "json", jsonVD: "Y" });
  const res = await fetch(`${BASE}/${path}&${qs}`, { headers: { "user-agent": UA, accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { throw new Error(`KOSIS 응답을 읽지 못함 (HTTP ${res.status})`); }
  if (data && !Array.isArray(data) && data.err) {
    const code = Number(data.err);
    if (code === 30) return [];
    throw new Error(`KOSIS 오류 ${data.err}: ${ERR[code] || data.errMsg || ""}`);
  }
  return Array.isArray(data) ? data : [];
}

const tableUrl = (o, t) => `https://kosis.kr/statHtml/statHtml.do?orgId=${encodeURIComponent(o)}&tblId=${encodeURIComponent(t)}`;
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, ".");
const num = (v) => { const s = String(v ?? "").replace(/,/g, "").trim(); return s !== "" && !isNaN(+s) ? +s : null; };
const clean = (v) => String(v ?? "").trim();
function need(v, label) { const s = clean(v); if (!s) throw new Error(`${label} 값이 필요함`); if (!/^[A-Za-z0-9_.\-]+$/.test(s)) throw new Error(`${label} 형식이 잘못됨: ${s}`); return s; }
const codeList = (v) => { const s = clean(v); if (!s) return null; const parts = s.split(/[\s,]+/).filter(Boolean); if (parts.some((p) => !/^[A-Za-z0-9_.\-*]+$/.test(p) && p !== "ALL")) throw new Error(`코드 형식이 잘못됨: ${s}`); return parts.join("+") + "+"; };

async function tableMeta(env, o, t) {
  const [tbl, prd, itm, unit] = await Promise.all([
    kosis(env, "statisticsData.do?method=getMeta", { type: "TBL", orgId: o, tblId: t }),
    kosis(env, "statisticsData.do?method=getMeta", { type: "PRD", orgId: o, tblId: t }),
    kosis(env, "statisticsData.do?method=getMeta", { type: "ITM", orgId: o, tblId: t }),
    kosis(env, "statisticsData.do?method=getMeta", { type: "UNIT", orgId: o, tblId: t }).catch(() => []),
  ]);
  if (!tbl.length && !itm.length) throw new Error(`통계표를 찾지 못함: orgId=${o}, tblId=${t}`);
  const items = [], dims = new Map();
  for (const r of itm) {
    if (r.OBJ_ID === "ITEM") { items.push({ itmId: r.ITM_ID, name: r.ITM_NM, unit: r.UNIT_NM || undefined }); continue; }
    const sn = Number(r.OBJ_ID_SN) || dims.size + 1;
    if (!dims.has(sn)) dims.set(sn, { param: `objL${sn}`, objId: r.OBJ_ID, name: r.OBJ_NM, codes: [] });
    dims.get(sn).codes.push({ code: r.ITM_ID, name: r.ITM_NM, parent: r.UP_ITM_ID || undefined });
  }
  return {
    name: tbl[0]?.TBL_NM, nameEng: tbl[0]?.TBL_NM_ENG,
    periods: prd.map((p) => ({ prdSe: Object.keys(PRD_SE).find((k) => PRD_SE[k] === p.PRD_SE) || p.PRD_SE, label: p.PRD_SE, from: p.STRT_PRD_DE, to: p.END_PRD_DE })),
    items, dims: [...dims.entries()].sort((a, b) => a[0] - b[0]).map(([, d]) => d),
    units: [...new Set(unit.map((u) => u.UNIT_NM).filter(Boolean))],
  };
}

export async function callKosisTool(name, args = {}, env = {}) {
  switch (name) {
    case "kosis_search_tables": {
      const q = clean(args.query);
      if (!q) throw new Error("query 값이 필요함");
      const count = Math.min(30, Math.max(1, Number(args.count) || 10));
      const params = { searchNm: q, sort: args.sort === "최신" ? "DATE" : "RANK", startCount: "1", resultCount: String(Math.min(100, count * 3 + 10)) };
      if (clean(args.orgId)) params.orgId = need(args.orgId, "orgId");
      const rows = await kosis(env, "statisticsSearch.do?method=getList", params);
      const allowed = rows.filter((r) => !isExcludedView(r.VW_CD) && !/^(국제|북한통계)/.test(clean(r.MT_ATITLE)));
      const seen = new Set();
      const tables = [];
      for (const r of allowed) {
        const k = `${r.ORG_ID}/${r.TBL_ID}`;
        if (seen.has(k)) continue;
        seen.add(k);
        tables.push({
          orgId: r.ORG_ID, orgName: r.ORG_NM, tblId: r.TBL_ID, tableName: r.TBL_NM, statId: r.STAT_ID, surveyName: r.STAT_NM,
          period: r.STRT_PRD_DE || r.END_PRD_DE ? `${r.STRT_PRD_DE || "?"}~${r.END_PRD_DE || "?"}` : undefined,
          location: clean(r.MT_ATITLE) || undefined, recommended: r.REC_TBL_SE === "Y" || undefined, url: tableUrl(r.ORG_ID, r.TBL_ID),
        });
        if (tables.length >= count) break;
      }
      return {
        source: "kosis", query: q, total: Number(rows[0]?.STAT_DB_CNT) || undefined, count: tables.length, tables,
        excluded: rows.length - allowed.length ? `국제·북한통계 ${rows.length - allowed.length}건 제외(KOSIS 이용지침상 재배포 금지)` : undefined,
        next: "수치를 보려면 orgId·tblId로 표 구조를 확인한 뒤 항목·분류 코드를 골라 조회",
        attribution: "출처: 국가데이터처 국가통계포털(KOSIS)",
      };
    }
    case "kosis_table_info": {
      const o = need(args.orgId, "orgId"), t = need(args.tblId, "tblId");
      const m = await tableMeta(env, o, t);
      const dims = m.dims.map((d) => ({ ...d, codeCount: d.codes.length, codes: d.codes.slice(0, 80), truncated: d.codes.length > 80 ? `${d.codes.length}개 중 80개만 표시` : undefined }));
      return {
        source: "kosis", orgId: o, tblId: t, tableName: m.name, tableNameEng: m.nameEng, periods: m.periods,
        items: m.items, dimensions: dims, units: m.units.length ? m.units : undefined, url: tableUrl(o, t),
        hint: "조회 시 itmId에는 항목 코드, objL1~에는 분류 코드를 공백으로 구분해 넣는다. 생략하면 ALL. 셀이 40,000개를 넘으면 KOSIS가 거절하므로 필요한 코드만 고른다.",
        attribution: `출처: ${m.name ? `「${m.name}」, ` : ""}국가데이터처 국가통계포털(KOSIS), ${tableUrl(o, t)}`,
      };
    }
    case "kosis_get_data": {
      const o = need(args.orgId, "orgId"), t = need(args.tblId, "tblId");
      let prdSe = clean(args.prdSe);
      let dimCount = null;
      if (!prdSe || !args.objL2) {
        const prd = await kosis(env, "statisticsData.do?method=getMeta", { type: "PRD", orgId: o, tblId: t });
        if (!prdSe) prdSe = Object.keys(PRD_SE).find((k) => PRD_SE[k] === prd[0]?.PRD_SE) || "Y";
        const itm = await kosis(env, "statisticsData.do?method=getMeta", { type: "ITM", orgId: o, tblId: t });
        dimCount = new Set(itm.filter((r) => r.OBJ_ID !== "ITEM").map((r) => r.OBJ_ID_SN || r.OBJ_ID)).size;
      }
      const params = { orgId: o, tblId: t, prdSe, itmId: codeList(args.itmId) || "ALL", objL1: codeList(args.objL1) || "ALL" };
      for (let i = 2; i <= 4; i++) {
        const v = codeList(args[`objL${i}`]);
        if (v) params[`objL${i}`] = v;
        else if (dimCount != null && i <= dimCount) params[`objL${i}`] = "ALL";
      }
      if (dimCount != null) for (let i = 5; i <= Math.min(8, dimCount); i++) params[`objL${i}`] = "ALL";
      if (clean(args.startPrdDe) || clean(args.endPrdDe)) {
        params.startPrdDe = need(args.startPrdDe || args.endPrdDe, "startPrdDe");
        params.endPrdDe = need(args.endPrdDe || args.startPrdDe, "endPrdDe");
      } else params.newEstPrdCnt = String(Math.min(60, Math.max(1, Number(args.recent) || 5)));
      const rows = await kosis(env, "Param/statisticsParameterData.do?method=getList", params);
      const out = rows.slice(0, MAX_ROWS).map((r) => {
        const row = { period: r.PRD_DE, item: r.ITM_NM };
        for (let i = 1; i <= 8; i++) if (r[`C${i}_NM`]) row[r[`C${i}_OBJ_NM`] || `분류${i}`] = r[`C${i}_NM`];
        row.value = num(r.DT);
        if (row.value === null && clean(r.DT)) row.raw = clean(r.DT);
        if (r.UNIT_NM) row.unit = r.UNIT_NM;
        return row;
      });
      const tableName = clean(rows[0]?.TBL_NM);
      const lastChanged = rows.map((r) => r.LST_CHN_DE).filter(Boolean).sort().at(-1);
      return {
        source: "kosis", orgId: o, tblId: t, tableName, prdSe: `${prdSe} (${PRD_SE[prdSe] || prdSe})`,
        rowCount: rows.length, rows: out,
        truncated: rows.length > MAX_ROWS ? `${rows.length}행 중 ${MAX_ROWS}행만 표시. 항목·분류·기간을 좁혀서 다시 조회` : undefined,
        note: rows.length ? undefined : "조건에 맞는 수치가 없음. 표 구조에서 코드·주기·기간을 확인",
        lastChanged,
        attribution: `출처: 「${tableName || t}」, 국가데이터처 국가통계포털(KOSIS), ${tableUrl(o, t)} (참조일 ${today()})`,
      };
    }
    case "kosis_survey_info": {
      const statId = need(args.statId, "statId");
      const rows = await kosis(env, "statisticsExplData.do?method=getList", { statId, metaItm: "All" });
      if (!rows.length) throw new Error(`조사 설명을 찾지 못함: statId=${statId}`);
      const LABEL = {
        statsNm: "조사명", statsKind: "통계 종류", statsEnd: "승인 구분", statsContinue: "계속 여부", basisLaw: "법적 근거", writingPurps: "작성 목적",
        examinPd: "조사 기간", examinCycle: "조사 주기", examinObjrange: "조사 대상 범위", examinObjArea: "조사 지역", josaUnit: "조사 단위",
        applyGroup: "적용 분류", josaItm: "조사 항목", pubCycle: "공표 주기", pubExtent: "공표 범위", pubDate: "공표 시기", publictMth: "공표 방법",
        examinTrgetPd: "조사 대상 기간", dataUserNote: "이용 시 유의사항", mainTermExpl: "주요 용어", dataCollectMth: "자료 수집 방법", examinHistory: "연혁",
        writingSystem: "작성 체계", writingTel: "작성 부서·연락처", statsField: "통계 분야", confmNo: "승인 번호", confmDt: "승인일",
      };
      const info = {};
      for (const r of rows) for (const [k, v] of Object.entries(r)) {
        const label = LABEL[k] || k;
        const val = clean(v).replace(/\s+\n/g, "\n");
        if (val && !info[label]) info[label] = val.length > 1200 ? val.slice(0, 1200) + "…" : val;
      }
      return { source: "kosis", statId, info, attribution: "출처: 국가데이터처 국가통계포털(KOSIS) 통계설명자료" };
    }
    default:
      throw new Error(`알 수 없는 도구: ${name}`);
  }
}
