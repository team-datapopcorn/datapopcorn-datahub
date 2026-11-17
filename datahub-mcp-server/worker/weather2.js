// 날씨 확장 도구 (Open-Meteo, API 키 불필요): 예보, 대기질(모델 추정), 지명 검색, 도시 비교, 월별 기후, 일출·일몰, 해양.

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const MAX_ROWS = 200;

const CITY_COORDS = {
  서울: { lat: 37.5665, lon: 126.978 },
  부산: { lat: 35.1796, lon: 129.0756 },
  대구: { lat: 35.8714, lon: 128.6014 },
  인천: { lat: 37.4563, lon: 126.7052 },
  광주: { lat: 35.1595, lon: 126.8526 },
  대전: { lat: 36.3504, lon: 127.3845 },
  울산: { lat: 35.5384, lon: 129.3114 },
  세종: { lat: 36.4801, lon: 127.289 },
  수원: { lat: 37.2636, lon: 127.0286 },
  춘천: { lat: 37.8813, lon: 127.7298 },
  청주: { lat: 36.6424, lon: 127.489 },
  전주: { lat: 35.8242, lon: 127.148 },
  제주: { lat: 33.4996, lon: 126.5312 },
};

const COAST_PRESETS = {
  해운대: { lat: 35.155, lon: 129.17 },
  "강릉 경포": { lat: 37.81, lon: 128.92 },
  "제주 중문": { lat: 33.235, lon: 126.41 },
  속초: { lat: 38.2, lon: 128.62 },
  "태안 만리포": { lat: 36.79, lon: 126.13 },
};

const WMO = {
  0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "서리 안개",
  51: "약한 이슬비", 53: "이슬비", 55: "강한 이슬비", 56: "약한 어는 이슬비", 57: "어는 이슬비",
  61: "약한 비", 63: "비", 65: "강한 비", 66: "약한 어는 비", 67: "어는 비",
  71: "약한 눈", 73: "눈", 75: "강한 눈", 77: "싸락눈", 80: "약한 소나기", 81: "소나기", 82: "강한 소나기",
  85: "약한 눈 소나기", 86: "강한 눈 소나기", 95: "뇌우", 96: "약한 우박 동반 뇌우", 99: "강한 우박 동반 뇌우",
};

const loc = {
  region: { type: "string", description: `지역명(기본 서울). 주요 도시: ${Object.keys(CITY_COORDS).join(", ")}. 그 외 지명(예: 강릉, 여수)은 자동 검색` },
  latitude: { type: "number", description: "선택. 위도 (경도와 함께 쓰면 region 대신 사용)" },
  longitude: { type: "number", description: "선택. 경도" },
};
const fromDate = { type: "string", description: "시작일 YYYY-MM-DD 또는 YYYYMMDD" };
const toDate = { type: "string", description: "종료일 YYYY-MM-DD 또는 YYYYMMDD" };

export const WEATHER2_TOOLS = [
  {
    name: "weather_get_forecast",
    description: "[날씨] 최대 16일 일별 예보(최고·최저기온, 강수량, 강수확률, 최대풍속, 날씨 설명)를 조회합니다. 원하면 48시간 시간별 예보도. 예: '이번 주말 부산 날씨 예보'",
    inputSchema: {
      type: "object",
      properties: {
        ...loc,
        days: { type: "integer", minimum: 1, maximum: 16, default: 7, description: "예보 일수(1~16)" },
        hourly: { type: "boolean", default: false, description: "앞으로 48시간 시간별 예보 포함" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_get_air_quality",
    description: "[날씨] 미세먼지(PM10)·초미세먼지(PM2.5)·오존의 일별 평균·최고와 환경부 기준 등급을 줍니다. Open-Meteo 모델 추정값(에어코리아 측정값 아님). 예: '내일 서울 미세먼지 어때?'",
    inputSchema: {
      type: "object",
      properties: {
        ...loc,
        pastDays: { type: "integer", minimum: 0, maximum: 92, default: 1, description: "과거 일수(0~92)" },
        forecastDays: { type: "integer", minimum: 1, maximum: 7, default: 3, description: "예보 일수(1~7)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_geocode",
    description: "[날씨] 지명(한국어 가능)을 위도·경도 후보로 바꿉니다. 행정구역, 인구 포함. 예: '양평 좌표 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "지명, 예: 강릉, 여의도, 양평" },
        count: { type: "integer", minimum: 1, maximum: 20, default: 5, description: "후보 수" },
        koreaOnly: { type: "boolean", default: true, description: "한국 결과만" },
      },
      required: ["name"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_compare_cities",
    description: "[날씨] 여러 도시의 같은 기간 날씨(평균기온, 총 강수량, 비 온 날 수, 가장 더운 날)를 비교하고 순위를 매깁니다(과거 관측 재분석). 예: '올해 8월 서울·부산·대구 중 어디가 제일 더웠어?'",
    inputSchema: {
      type: "object",
      properties: {
        cities: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 10, description: "도시 이름 배열, 예: [\"서울\",\"부산\",\"대구\"]" },
        fromDate, toDate,
      },
      required: ["cities", "fromDate", "toDate"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_monthly_climate",
    description: "[날씨] 최근 N년(기본 10년) 과거 데이터로 월별 평균기온·평균 월강수량(기후 평년 비슷한 값)과 특정 달의 연도별 추세를 계산합니다. 예: '서울 지난 10년 8월 평균기온 추세'",
    inputSchema: {
      type: "object",
      properties: {
        ...loc,
        years: { type: "integer", minimum: 1, maximum: 30, default: 10, description: "최근 몇 년(완료된 연도 기준, 최대 30)" },
        month: { type: "integer", minimum: 1, maximum: 12, description: "선택. 연도별 추세를 볼 달(1~12)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_get_sun_times",
    description: "[날씨] 기간별 일출·일몰 시각과 낮 길이(시간)를 줍니다. 예: '제주 12월 일몰 시간'",
    inputSchema: {
      type: "object",
      properties: { ...loc, fromDate, toDate },
      required: ["fromDate", "toDate"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "weather_marine",
    description: `[날씨] 해안 지점의 일별 최대 파고, 파주기, 풍랑 높이 예보를 줍니다. 프리셋: ${Object.keys(COAST_PRESETS).join(", ")} 또는 위도·경도. 예: '이번 주 해운대 파도 높이'`,
    inputSchema: {
      type: "object",
      properties: {
        spot: { type: "string", description: `해안 지점: ${Object.keys(COAST_PRESETS).join(", ")}` },
        latitude: { type: "number", description: "선택. 위도" },
        longitude: { type: "number", description: "선택. 경도" },
        days: { type: "integer", minimum: 1, maximum: 8, default: 5, description: "예보 일수(1~8)" },
      },
    },
    annotations: READ_ONLY,
  },
];

export const WEATHER2_TOOL_NAMES = new Set(WEATHER2_TOOLS.map((t) => t.name));

function isoDate(value, label) {
  if (!value) throw new Error(`${label}가 필요함 (YYYY-MM-DD)`);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  throw new Error(`${label} 날짜 형식이 잘못됨: ${value}`);
}
function range(args) {
  const f = isoDate(args.fromDate, "fromDate");
  const t = isoDate(args.toDate, "toDate");
  if (f > t) throw new Error("fromDate가 toDate보다 늦음");
  return [f, t];
}
const round = (v, d = 1) => (v === null || v === undefined || Number.isNaN(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const mean = (a) => { const v = a.filter((x) => typeof x === "number"); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const max = (a) => { const v = a.filter((x) => typeof x === "number"); return v.length ? Math.max(...v) : null; };
const sum = (a) => a.filter((x) => typeof x === "number").reduce((s, x) => s + x, 0);

async function getJson(url, label) {
  let res;
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
  } catch (e) {
    throw new Error(`${label} 연결 실패: ${e?.cause?.code || e?.name || e?.message}`);
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${label} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function geocode(name, count = 5, koreaOnly = true) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", String(Math.min(Math.max(count, 1), 20)));
  url.searchParams.set("language", "ko");
  url.searchParams.set("format", "json");
  if (koreaOnly) url.searchParams.set("countryCode", "KR");
  let json = await getJson(url, "Open-Meteo 지명 검색");
  let results = json.results || [];
  if (!results.length && koreaOnly) {
    url.searchParams.delete("countryCode");
    json = await getJson(url, "Open-Meteo 지명 검색");
    results = json.results || [];
  }
  return results.map((r) => ({
    name: r.name, country: r.country, admin1: r.admin1, admin2: r.admin2, admin3: r.admin3,
    latitude: r.latitude, longitude: r.longitude, population: r.population ?? null, elevation: r.elevation,
  }));
}

async function resolveLocation(args) {
  if (typeof args.latitude === "number" && typeof args.longitude === "number") {
    return { label: `${args.latitude},${args.longitude}`, lat: args.latitude, lon: args.longitude };
  }
  return resolveName(args.region || "서울");
}
async function resolveName(name) {
  const key = String(name).trim().replace(/(특별시|광역시|특별자치시|특별자치도|시)$/, "");
  if (CITY_COORDS[key]) return { label: key, ...CITY_COORDS[key] };
  const hits = await geocode(String(name).trim(), 1, true);
  if (!hits.length) throw new Error(`지명을 찾지 못함: ${name}`);
  const h = hits[0];
  return { label: [h.admin1, h.name].filter(Boolean).join(" "), lat: h.latitude, lon: h.longitude };
}

function pmGrade(v, kind) {
  if (v === null) return null;
  const cuts = kind === "pm10" ? [30, 80, 150] : [15, 35, 75];
  const x = Math.round(v);
  return x <= cuts[0] ? "좋음" : x <= cuts[1] ? "보통" : x <= cuts[2] ? "나쁨" : "매우나쁨";
}

async function archiveDaily(lat, lon, from, to, fields) {
  const url = new URL("https://archive-api.open-meteo.com/v1/archive");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("start_date", from);
  url.searchParams.set("end_date", to);
  url.searchParams.set("daily", fields.join(","));
  url.searchParams.set("timezone", "Asia/Seoul");
  const json = await getJson(url, "Open-Meteo 과거 데이터");
  return json.daily || {};
}

export async function callWeather2Tool(name, args = {}) {
  switch (name) {
    case "weather_get_forecast": {
      const l = await resolveLocation(args);
      const days = Math.min(Math.max(parseInt(args.days ?? 7, 10) || 7, 1), 16);
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(l.lat));
      url.searchParams.set("longitude", String(l.lon));
      url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max");
      if (args.hourly) {
        url.searchParams.set("hourly", "temperature_2m,precipitation_probability,precipitation,weather_code");
        url.searchParams.set("forecast_hours", "48");
      }
      url.searchParams.set("forecast_days", String(days));
      url.searchParams.set("timezone", "Asia/Seoul");
      const j = await getJson(url, "Open-Meteo 예보");
      const d = j.daily || {};
      const out = {
        source: "open-meteo-forecast", location: l.label, latitude: l.lat, longitude: l.lon,
        daily: (d.time || []).map((date, i) => ({
          date, weather: WMO[d.weather_code?.[i]] ?? `코드 ${d.weather_code?.[i]}`,
          tempMax: d.temperature_2m_max?.[i], tempMin: d.temperature_2m_min?.[i],
          precipitationMm: d.precipitation_sum?.[i], precipitationProbabilityMax: d.precipitation_probability_max?.[i],
          windSpeedMaxKmh: d.wind_speed_10m_max?.[i],
        })),
      };
      if (args.hourly && j.hourly) {
        const h = j.hourly;
        out.hourly = (h.time || []).slice(0, 48).map((time, i) => ({
          time, temp: h.temperature_2m?.[i], precipitationProbability: h.precipitation_probability?.[i],
          precipitationMm: h.precipitation?.[i], weather: WMO[h.weather_code?.[i]] ?? null,
        }));
      }
      return out;
    }
    case "weather_get_air_quality": {
      const l = await resolveLocation(args);
      const past = Math.min(Math.max(parseInt(args.pastDays ?? 1, 10) || 0, 0), 92);
      const fc = Math.min(Math.max(parseInt(args.forecastDays ?? 3, 10) || 3, 1), 7);
      const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
      url.searchParams.set("latitude", String(l.lat));
      url.searchParams.set("longitude", String(l.lon));
      url.searchParams.set("hourly", "pm10,pm2_5,ozone");
      url.searchParams.set("past_days", String(past));
      url.searchParams.set("forecast_days", String(fc));
      url.searchParams.set("timezone", "Asia/Seoul");
      const j = await getJson(url, "Open-Meteo 대기질");
      const h = j.hourly || {};
      const byDay = {};
      (h.time || []).forEach((t, i) => {
        const day = t.slice(0, 10);
        const b = (byDay[day] = byDay[day] || { pm10: [], pm25: [], o3: [] });
        b.pm10.push(h.pm10?.[i]); b.pm25.push(h.pm2_5?.[i]); b.o3.push(h.ozone?.[i]);
      });
      return {
        source: "open-meteo-air-quality (CAMS 모델 추정)", location: l.label,
        note: "모델 추정값이며 에어코리아 실측값이 아님. 등급은 환경부 기준(일평균): PM10 좋음 0-30/보통 31-80/나쁨 81-150/매우나쁨 151+, PM2.5 0-15/16-35/36-75/76+.",
        unit: "μg/m³",
        daily: Object.entries(byDay).map(([date, b]) => {
          const p10 = round(mean(b.pm10)); const p25 = round(mean(b.pm25));
          return {
            date, pm10Mean: p10, pm10Max: round(max(b.pm10)), pm10Grade: pmGrade(p10, "pm10"),
            pm25Mean: p25, pm25Max: round(max(b.pm25)), pm25Grade: pmGrade(p25, "pm25"),
            ozoneMean: round(mean(b.o3)), ozoneMax: round(max(b.o3)),
          };
        }),
      };
    }
    case "weather_geocode": {
      if (!args.name) throw new Error("name이 필요함");
      const results = await geocode(String(args.name), parseInt(args.count ?? 5, 10) || 5, args.koreaOnly !== false);
      return { query: args.name, count: results.length, results };
    }
    case "weather_compare_cities": {
      if (!Array.isArray(args.cities) || args.cities.length < 2) throw new Error("cities에 도시 2개 이상 필요");
      if (args.cities.length > 10) throw new Error("cities는 최대 10개");
      const [from, to] = range(args);
      const results = [];
      for (const c of args.cities) {
        const l = await resolveName(c);
        const d = await archiveDaily(l.lat, l.lon, from, to, ["temperature_2m_mean", "temperature_2m_max", "precipitation_sum"]);
        const times = d.time || [];
        let hot = null;
        times.forEach((t, i) => {
          const v = d.temperature_2m_max?.[i];
          if (typeof v === "number" && (!hot || v > hot.tempMax)) hot = { date: t, tempMax: v };
        });
        results.push({
          city: c, location: l.label, days: times.length,
          meanTemp: round(mean(d.temperature_2m_mean || [])),
          totalPrecipitationMm: round(sum(d.precipitation_sum || [])),
          rainyDays: (d.precipitation_sum || []).filter((v) => v >= 1).length,
          hottestDay: hot,
        });
      }
      const rank = (key) => [...results].filter((r) => r[key] !== null).sort((a, b) => b[key] - a[key]).map((r) => r.city);
      return {
        source: "open-meteo-archive (ERA5 재분석)", fromDate: from, toDate: to, note: "비 온 날 = 일 강수량 1mm 이상",
        cities: results,
        ranking: { warmest: rank("meanTemp"), wettest: rank("totalPrecipitationMm"), mostRainyDays: rank("rainyDays") },
      };
    }
    case "weather_monthly_climate": {
      const l = await resolveLocation(args);
      const years = Math.min(Math.max(parseInt(args.years ?? 10, 10) || 10, 1), 30);
      const lastYear = new Date().getFullYear() - 1;
      const firstYear = lastYear - years + 1;
      const d = await archiveDaily(l.lat, l.lon, `${firstYear}-01-01`, `${lastYear}-12-31`, ["temperature_2m_mean", "precipitation_sum"]);
      const ym = {};
      (d.time || []).forEach((t, i) => {
        const k = t.slice(0, 7);
        const b = (ym[k] = ym[k] || { temps: [], precip: 0 });
        b.temps.push(d.temperature_2m_mean?.[i]);
        if (typeof d.precipitation_sum?.[i] === "number") b.precip += d.precipitation_sum[i];
      });
      const months = [];
      for (let m = 1; m <= 12; m++) {
        const keys = Object.keys(ym).filter((k) => Number(k.slice(5)) === m);
        months.push({
          month: m,
          avgTemp: round(mean(keys.map((k) => mean(ym[k].temps)))),
          avgMonthlyPrecipitationMm: round(mean(keys.map((k) => ym[k].precip))),
        });
      }
      const out = { source: "open-meteo-archive (ERA5 재분석)", location: l.label, period: `${firstYear}-${lastYear}`, years, months };
      if (args.month) {
        const m = parseInt(args.month, 10);
        if (!(m >= 1 && m <= 12)) throw new Error("month는 1~12");
        const trend = Object.keys(ym).filter((k) => Number(k.slice(5)) === m).sort().map((k) => ({
          year: Number(k.slice(0, 4)), avgTemp: round(mean(ym[k].temps)), precipitationMm: round(ym[k].precip),
        }));
        // 단순 선형 추세(°C/10년)
        const xs = trend.map((r) => r.year), ys = trend.map((r) => r.avgTemp);
        let slope = null;
        if (xs.length >= 3) {
          const mx = mean(xs), my = mean(ys);
          const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
          const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
          slope = den ? round((num / den) * 10, 2) : null;
        }
        out.monthTrend = { month: m, byYear: trend, tempTrendPerDecadeC: slope };
      }
      return out;
    }
    case "weather_get_sun_times": {
      const l = await resolveLocation(args);
      const [from, to] = range(args);
      const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
      const url = new URL(from < today && to < today ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(l.lat));
      url.searchParams.set("longitude", String(l.lon));
      url.searchParams.set("daily", "sunrise,sunset,daylight_duration");
      url.searchParams.set("start_date", from);
      url.searchParams.set("end_date", to);
      url.searchParams.set("timezone", "Asia/Seoul");
      const j = await getJson(url, "Open-Meteo 일출·일몰");
      const d = j.daily || {};
      const rows = (d.time || []).map((date, i) => ({
        date, sunrise: d.sunrise?.[i]?.slice(11), sunset: d.sunset?.[i]?.slice(11),
        daylightHours: round((d.daylight_duration?.[i] ?? NaN) / 3600, 2),
      }));
      return {
        location: l.label, count: Math.min(rows.length, MAX_ROWS), rows: rows.slice(0, MAX_ROWS),
        truncated: rows.length > MAX_ROWS ? `전체 ${rows.length}일 중 ${MAX_ROWS}일만` : undefined,
        note: "예보 API는 오늘 기준 약 3개월 전~16일 후까지 지원. 그보다 이전 날짜만 있으면 과거 API 사용",
      };
    }
    case "weather_marine": {
      let l;
      if (typeof args.latitude === "number" && typeof args.longitude === "number") {
        l = { label: `${args.latitude},${args.longitude}`, lat: args.latitude, lon: args.longitude };
      } else {
        const spot = String(args.spot || "해운대").trim();
        const key = Object.keys(COAST_PRESETS).find((k) => k === spot || k.includes(spot) || spot.includes(k));
        if (!key) throw new Error(`알 수 없는 해안 지점: ${spot}. 프리셋: ${Object.keys(COAST_PRESETS).join(", ")} 또는 위도·경도`);
        l = { label: key, ...COAST_PRESETS[key] };
      }
      const days = Math.min(Math.max(parseInt(args.days ?? 5, 10) || 5, 1), 8);
      const url = new URL("https://marine-api.open-meteo.com/v1/marine");
      url.searchParams.set("latitude", String(l.lat));
      url.searchParams.set("longitude", String(l.lon));
      url.searchParams.set("daily", "wave_height_max,wave_period_max,wind_wave_height_max");
      url.searchParams.set("forecast_days", String(days));
      url.searchParams.set("timezone", "Asia/Seoul");
      const j = await getJson(url, "Open-Meteo 해양");
      const d = j.daily || {};
      const rows = (d.time || []).map((date, i) => ({
        date, waveHeightMaxM: d.wave_height_max?.[i] ?? null, wavePeriodMaxS: d.wave_period_max?.[i] ?? null,
        windWaveHeightMaxM: d.wind_wave_height_max?.[i] ?? null,
      }));
      if (!rows.length || rows.every((r) => r.waveHeightMaxM === null)) {
        throw new Error(`이 좌표(${l.lat},${l.lon})는 해양 데이터가 없음(내륙일 가능성). 해안 가까운 바다 좌표를 쓰세요`);
      }
      return { source: "open-meteo-marine", spot: l.label, latitude: l.lat, longitude: l.lon, daily: rows };
    }
    default:
      throw new Error(`알 수 없는 날씨 도구: ${name}`);
  }
}
