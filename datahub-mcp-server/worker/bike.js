// Seoul Bike (따릉이) public data tools via Seoul Open Data Plaza (tbCycleUseStatus).

const SEOUL_API_BASE = "http://openapi.seoul.go.kr:8088";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };

export const BIKE_TOOLS = [
  {
    name: "bike_get_daily_usage",
    description:
      "[따릉이] 서울시 공공자전거(따릉이) 일별 대여·반납 이용 현황(tbCycleUseStatus)을 조회해 날짜별 합계와 상위 대여소를 반환합니다. SEOUL_OPEN_DATA_KEY 시크릿이 없으면 sample 키(일 최대 5건)로 동작합니다. 예: '2026-11-11 마포구 따릉이 이용량 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "단일 조회 일자 (YYYY-MM-DD 또는 YYYYMMDD)" },
        fromDate: { type: "string", description: "시작일 (YYYY-MM-DD 또는 YYYYMMDD)" },
        toDate: { type: "string", description: "종료일 (YYYY-MM-DD 또는 YYYYMMDD, 최대 31일)" },
        district: { type: "string", description: "선택. 자치구 필터 (예: 마포구, 강남구, 송파구)" },
      },
    },
    annotations: READ_ONLY,
  },
];

export const BIKE_TOOL_NAMES = new Set(BIKE_TOOLS.map((t) => t.name));

function toCompactDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{8}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.replace(/-/g, "");
  return null;
}

function expandDates(fromCompact, toCompact) {
  const start = new Date(`${fromCompact.slice(0, 4)}-${fromCompact.slice(4, 6)}-${fromCompact.slice(6, 8)}T00:00:00Z`);
  const end = new Date(`${toCompact.slice(0, 4)}-${toCompact.slice(4, 6)}-${toCompact.slice(6, 8)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("Invalid date format.");
  }
  if (start > end) {
    throw new Error("fromDate must be earlier than or equal to toDate.");
  }
  const out = [];
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10).replace(/-/g, ""));
    if (out.length > 31) {
      throw new Error("Date range cannot exceed 31 days per request.");
    }
  }
  return out;
}

async function fetchBikeDay(apiKey, compactDate, isSample) {
  const pageSize = isSample ? 5 : 1000;
  const maxPages = isSample ? 1 : 5;
  const allRows = [];
  let totalCount = 0;

  for (let page = 0; page < maxPages; page++) {
    const startIdx = page * pageSize + 1;
    const endIdx = startIdx + pageSize - 1;
    const url = `${SEOUL_API_BASE}/${encodeURIComponent(apiKey)}/json/tbCycleUseStatus/${startIdx}/${endIdx}/${compactDate}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Seoul Open Data HTTP ${res.status}`);
    }
    const json = await res.json();
    if (json.RESULT && json.RESULT.CODE !== "INFO-000") {
      if (json.RESULT.CODE === "INFO-200") break; // 해당 데이터 없음
      throw new Error(`Seoul API ${json.RESULT.CODE}: ${json.RESULT.MESSAGE}`);
    }
    const body = json.useStatus;
    if (!body) break;
    totalCount = Number(body.list_total_count || 0);
    const rows = body.row || [];
    allRows.push(...rows);
    if (rows.length < pageSize || allRows.length >= totalCount) break;
  }

  return { totalCount, rows: allRows };
}

export async function callBikeTool(name, args = {}, env = {}) {
  if (name !== "bike_get_daily_usage") {
    throw new Error(`Unknown bike tool: ${name}`);
  }

  const apiKey = env.SEOUL_OPEN_DATA_KEY || "sample";
  const isSample = apiKey === "sample";

  let dates;
  if (args.date) {
    const d = toCompactDate(args.date);
    if (!d) throw new Error("date must be YYYY-MM-DD or YYYYMMDD.");
    dates = [d];
  } else if (args.fromDate && args.toDate) {
    const f = toCompactDate(args.fromDate);
    const t = toCompactDate(args.toDate);
    if (!f || !t) throw new Error("fromDate and toDate must be YYYY-MM-DD or YYYYMMDD.");
    dates = expandDates(f, t);
  } else {
    throw new Error("Provide either 'date' or both 'fromDate' and 'toDate'.");
  }

  const district = args.district ? String(args.district).trim() : null;
  const results = [];

  for (const d of dates) {
    const { totalCount, rows } = await fetchBikeDay(apiKey, d, isSample);
    const filtered = district ? rows.filter((r) => String(r.STA_LOC || "").includes(district)) : rows;

    let totalRentCount = 0;
    let totalReturnCount = 0;
    for (const r of filtered) {
      totalRentCount += Number(r.RENT_CNT || 0);
      totalReturnCount += Number(r.RTN_CNT || 0);
    }

    const topStations = [...filtered]
      .sort((a, b) => Number(b.RENT_CNT || 0) - Number(a.RENT_CNT || 0))
      .slice(0, 5)
      .map((r) => ({
        district: r.STA_LOC,
        station: r.RENT_NM,
        rentCount: Number(r.RENT_CNT || 0),
        returnCount: Number(r.RTN_CNT || 0),
        statDate: r.STAT_DATA,
      }));

    results.push({
      date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
      apiTotalStations: totalCount,
      fetchedRows: rows.length,
      matchedStations: filtered.length,
      totalRentCount,
      totalReturnCount,
      topStations,
    });
  }

  return {
    source: "seoul-open-data-tbCycleUseStatus",
    isSample,
    note: isSample
      ? "SEOUL_OPEN_DATA_KEY가 설정되지 않아 sample 키(일 최대 5개 대여소)로 조회했습니다. 전체 대여소 합계는 wrangler secret put SEOUL_OPEN_DATA_KEY 설정 후 확인 가능합니다."
      : undefined,
    district: district || "전체",
    days: results,
  };
}
