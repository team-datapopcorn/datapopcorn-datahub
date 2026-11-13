// Weather data tools powered by Open-Meteo (no API key required).

const CITY_COORDS = {
  서울: { lat: 37.5665, lon: 126.9780 },
  부산: { lat: 35.1796, lon: 129.0756 },
  대구: { lat: 35.8714, lon: 128.6014 },
  인천: { lat: 37.4563, lon: 126.7052 },
  광주: { lat: 35.1595, lon: 126.8526 },
  대전: { lat: 36.3504, lon: 127.3845 },
  울산: { lat: 35.5384, lon: 129.3114 },
  세종: { lat: 36.4801, lon: 127.2890 },
  수원: { lat: 37.2636, lon: 127.0286 },
  춘천: { lat: 37.8813, lon: 127.7298 },
  청주: { lat: 36.6424, lon: 127.4890 },
  전주: { lat: 35.8242, lon: 127.1480 },
  제주: { lat: 33.4996, lon: 126.5312 },
};

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };

export const WEATHER_TOOLS = [
  {
    name: "weather_get_daily",
    description:
      "[날씨] Open-Meteo API로 한국 주요 도시(또는 위도/경도)의 일별 기상 데이터(평균/최고/최저기온, 강수량, 최대풍속)를 조회합니다. API 키가 필요 없습니다. 예: '서울 2026-10-01~2026-10-31 날씨 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        region: {
          type: "string",
          description: `지역명 (기본값: 서울). 지원: ${Object.keys(CITY_COORDS).join(", ")}`,
          default: "서울",
        },
        fromDate: { type: "string", description: "시작일 YYYY-MM-DD" },
        toDate: { type: "string", description: "종료일 YYYY-MM-DD" },
        latitude: { type: "number", description: "선택. 직접 위도 지정 시 region 대신 사용" },
        longitude: { type: "number", description: "선택. 직접 경도 지정 시 region 대신 사용" },
      },
      required: ["fromDate", "toDate"],
    },
    annotations: READ_ONLY,
  },
];

export const WEATHER_TOOL_NAMES = new Set(WEATHER_TOOLS.map((t) => t.name));

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  return null;
}

export async function callWeatherTool(name, args = {}) {
  if (name !== "weather_get_daily") {
    throw new Error(`Unknown weather tool: ${name}`);
  }

  const fromDate = normalizeDate(args.fromDate);
  const toDate = normalizeDate(args.toDate);
  if (!fromDate || !toDate) {
    throw new Error("fromDate and toDate must be YYYY-MM-DD (or YYYYMMDD).");
  }
  if (fromDate > toDate) {
    throw new Error("fromDate must be earlier than or equal to toDate.");
  }

  const region = args.region || "서울";
  const coords =
    typeof args.latitude === "number" && typeof args.longitude === "number"
      ? { lat: args.latitude, lon: args.longitude }
      : CITY_COORDS[region];

  if (!coords) {
    throw new Error(`Unsupported region '${region}'. Supported: ${Object.keys(CITY_COORDS).join(", ")}`);
  }

  const dailyFields = [
    "temperature_2m_mean",
    "temperature_2m_max",
    "temperature_2m_min",
    "precipitation_sum",
    "wind_speed_10m_max",
  ].join(",");

  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(coords.lat));
  url.searchParams.set("longitude", String(coords.lon));
  url.searchParams.set("start_date", fromDate);
  url.searchParams.set("end_date", toDate);
  url.searchParams.set("daily", dailyFields);
  url.searchParams.set("timezone", "Asia/Seoul");

  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Open-Meteo HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const d = json.daily || {};
  const times = d.time || [];

  const rows = times.map((date, i) => ({
    date,
    tempMean: d.temperature_2m_mean?.[i] ?? null,
    tempMax: d.temperature_2m_max?.[i] ?? null,
    tempMin: d.temperature_2m_min?.[i] ?? null,
    precipitationMm: d.precipitation_sum?.[i] ?? null,
    windSpeedMaxKmh: d.wind_speed_10m_max?.[i] ?? null,
  }));

  return {
    source: "open-meteo-archive",
    region: typeof args.latitude === "number" ? `${coords.lat},${coords.lon}` : region,
    fromDate,
    toDate,
    count: rows.length,
    rows,
  };
}
