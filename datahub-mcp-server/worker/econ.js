// 경제·금융 도구: 환율(Frankfurter/ECB), 가상자산 시세(업비트), 세계은행 지표(World Bank). 모두 API 키 불필요.

const UA = "DataPopcornDataMCP/0.5 (https://api.datapopcorn.ai; contact@datapopcorn.ai)";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const MAX_ROWS = 400;

const FX_HOSTS = ["https://api.frankfurter.dev/v1", "https://api.frankfurter.app"];
const FX_NOTE =
  "ECB(유럽중앙은행) 기준환율(매 영업일 1회, 중부유럽 16시 기준)이며 국내 은행 고시환율·매매기준율과 다를 수 있음. 주말·휴일은 값 없음.";
const FX_ATTR = "환율 출처: Frankfurter API (European Central Bank reference rates)";
const UPBIT_ATTR = "시세 출처: 업비트 Open API (api.upbit.com)";
const WB_ATTR = "출처: World Bank, World Development Indicators (CC BY 4.0)";

const WB_ALIASES = {
  gdp: "NY.GDP.MKTP.CD",
  gdp_per_capita: "NY.GDP.PCAP.CD",
  population: "SP.POP.TOTL",
  inflation: "FP.CPI.TOTL.ZG",
  unemployment: "SL.UEM.TOTL.ZS",
  fertility: "SP.DYN.TFRT.IN",
  life_expectancy: "SP.DYN.LE00.IN",
  internet_users: "IT.NET.USER.ZS",
  exports_gdp: "NE.EXP.GNFS.ZS",
  gdp_growth: "NY.GDP.MKTP.KD.ZG",
  aged_65: "SP.POP.65UP.TO.ZS",
  co2_per_capita: "EN.GHG.CO2.PC.CE.AR5", // EN.ATM.CO2E.PC는 2026-11 기준 보관(삭제)됨
};

const COUNTRY_MAP = {
  한국: "KOR", 대한민국: "KOR", 남한: "KOR", korea: "KOR", kr: "KOR", kor: "KOR",
  미국: "USA", us: "USA", usa: "USA",
  일본: "JPN", jp: "JPN", jpn: "JPN",
  중국: "CHN", cn: "CHN", chn: "CHN",
  독일: "DEU", de: "DEU", deu: "DEU",
  프랑스: "FRA", fr: "FRA", fra: "FRA",
  영국: "GBR", uk: "GBR", gb: "GBR", gbr: "GBR",
  이탈리아: "ITA", it: "ITA", ita: "ITA",
  캐나다: "CAN", ca: "CAN", can: "CAN",
  호주: "AUS", au: "AUS", aus: "AUS",
  인도: "IND", in: "IND", ind: "IND",
  대만: "TWN", 싱가포르: "SGP", sg: "SGP", sgp: "SGP",
  베트남: "VNM", vn: "VNM", vnm: "VNM",
  인도네시아: "IDN", 태국: "THA", 말레이시아: "MYS", 필리핀: "PHL",
  스페인: "ESP", 네덜란드: "NLD", 스웨덴: "SWE", 스위스: "CHE", 노르웨이: "NOR",
  멕시코: "MEX", 브라질: "BRA", 튀르키예: "TUR", 터키: "TUR", 이스라엘: "ISR", 폴란드: "POL",
  세계: "WLD", world: "WLD", 전세계: "WLD",
};

const COUNTRY_GROUPS = {
  G7: ["USA", "JPN", "DEU", "GBR", "FRA", "ITA", "CAN"],
  "OECD 일부": ["KOR", "USA", "JPN", "DEU", "GBR", "FRA", "ITA", "CAN", "AUS", "ESP", "NLD", "SWE", "CHE", "MEX", "TUR", "POL", "ISR", "NOR"],
  "아시아 주요": ["KOR", "JPN", "CHN", "IND", "SGP", "VNM", "IDN", "THA", "MYS", "PHL"],
};

export const ECON_TOOLS = [
  {
    name: "fx_get_latest",
    description:
      "[환율] 최신 ECB 기준환율을 조회합니다(Frankfurter, 키 불필요). 원화 쌍이면 '1 USD = 1,334 원' 형태로도 보여 줍니다. 국내 은행 고시환율과는 다를 수 있습니다. 예: '지금 달러·엔·유로 환율 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        base: { type: "string", description: "기준 통화 코드 (기본 USD). 예: USD, KRW, EUR, JPY" },
        symbols: {
          type: "array",
          items: { type: "string" },
          description: "대상 통화 코드 목록 (기본: KRW, USD, EUR, JPY, CNY 중 base 제외)",
        },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "fx_get_history",
    description:
      "[환율] 두 통화의 기간별 일별 환율 시계열과 최저·최고·평균, 기간 변화율(%)을 줍니다(ECB 기준환율). 예: '올해 10월 달러/원 환율 추이 보여줘'",
    inputSchema: {
      type: "object",
      properties: {
        base: { type: "string", description: "기준 통화 (기본 USD)" },
        symbol: { type: "string", description: "대상 통화 (기본 KRW)" },
        fromDate: { type: "string", description: "시작일 YYYY-MM-DD" },
        toDate: { type: "string", description: "종료일 YYYY-MM-DD (생략 시 최신)" },
      },
      required: ["fromDate"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "fx_convert",
    description:
      "[환율] 금액을 다른 통화로 환산합니다. date를 주면 그날(직전 영업일) ECB 기준환율로 계산합니다. 예: '1500달러 원화로 얼마야?', '2025-12-31 기준 100만원은 엔화로?'",
    inputSchema: {
      type: "object",
      properties: {
        amount: { type: "number", description: "환산할 금액" },
        from: { type: "string", description: "원래 통화 코드, 예: USD" },
        to: { type: "string", description: "바꿀 통화 코드, 예: KRW" },
        date: { type: "string", description: "선택. 기준일 YYYY-MM-DD" },
      },
      required: ["amount", "from", "to"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "crypto_get_ticker",
    description:
      "[가상자산] 업비트 원화마켓 현재가, 전일 대비 등락률, 24시간 거래대금(원)을 조회합니다. 코인 심볼(BTC)이나 마켓 코드(KRW-BTC) 모두 됩니다. 예: '비트코인·이더리움 지금 얼마야?'",
    inputSchema: {
      type: "object",
      properties: {
        markets: {
          type: "array",
          items: { type: "string" },
          description: "코인 심볼 또는 마켓 코드 목록 (기본: BTC, ETH, XRP). 최대 20개",
        },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "crypto_get_candles",
    description:
      "[가상자산] 업비트 캔들(일·주·월·분봉) OHLCV와 기간 수익률(%), 변동성(수익률 표준편차)을 줍니다. 예: '비트코인 최근 30일 일봉이랑 변동성 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string", description: "코인 심볼 또는 마켓 코드 (기본 KRW-BTC)" },
        interval: {
          type: "string",
          enum: ["days", "weeks", "months", "minutes"],
          description: "캔들 단위 (기본 days)",
        },
        unit: { type: "integer", enum: [1, 3, 5, 10, 15, 30, 60, 240], description: "분봉일 때 분 단위 (기본 60)" },
        count: { type: "integer", minimum: 1, maximum: 200, description: "캔들 개수 (기본 30, 최대 200)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "wb_get_indicator",
    description:
      "[세계지표] 세계은행(World Bank) 국가별 지표 연도별 시계열을 조회합니다. 별칭 사용 가능: gdp, gdp_per_capita, population, inflation, unemployment, fertility, life_expectancy, internet_users, exports_gdp, gdp_growth, aged_65, co2_per_capita (또는 지표 코드 직접). 예: '한국 합계출산율 2000년부터 추이'",
    inputSchema: {
      type: "object",
      properties: {
        indicator: { type: "string", description: "지표 별칭 또는 World Bank 지표 코드 (예: fertility, SP.DYN.TFRT.IN)" },
        countries: {
          type: "array",
          items: { type: "string" },
          description: "국가 (한국/KR/KOR, 미국/USA 등, 기본 한국). 최대 10개",
        },
        fromYear: { type: "integer", description: "시작 연도 (기본: 최근 20년)" },
        toYear: { type: "integer", description: "종료 연도 (기본: 올해)" },
      },
      required: ["indicator"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "wb_compare_countries",
    description:
      "[세계지표] 한 지표를 여러 나라에서 비교합니다. 나라별 가장 최근 값(연도 포함)을 순위로 정렬하고 한국의 순위를 알려 줍니다. 그룹 프리셋: 'G7', 'OECD 일부', '아시아 주요'. 예: 'OECD 국가들 출산율 비교해서 한국 몇 위야?'",
    inputSchema: {
      type: "object",
      properties: {
        indicator: { type: "string", description: "지표 별칭 또는 지표 코드" },
        countries: { type: "array", items: { type: "string" }, description: "비교할 국가 목록 (group 대신)" },
        group: { type: "string", enum: Object.keys(COUNTRY_GROUPS), description: "국가 그룹 프리셋" },
        includeKorea: { type: "boolean", default: true, description: "한국을 항상 포함 (기본 true)" },
        order: { type: "string", enum: ["desc", "asc"], description: "정렬 (기본 desc: 큰 값이 1위)" },
      },
      required: ["indicator"],
    },
    annotations: READ_ONLY,
  },
];

export const ECON_TOOL_NAMES = new Set(ECON_TOOLS.map((t) => t.name));

// ---------- 공통 ----------
async function getJson(url, label) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${label} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

const round = (v, d = 4) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10 ** d) / 10 ** d);
const cur = (c, fallback) => {
  const s = String(c || fallback || "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) throw new Error(`통화 코드는 영문 3자리여야 합니다: '${c}'`);
  return s;
};
function normDate(v) {
  if (!v) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  throw new Error(`날짜 형식은 YYYY-MM-DD 입니다: '${v}'`);
}
function stats(arr) {
  const v = arr.filter((x) => Number.isFinite(x));
  if (!v.length) return { min: null, max: null, mean: null };
  return { min: Math.min(...v), max: Math.max(...v), mean: v.reduce((a, b) => a + b, 0) / v.length };
}
function stdev(arr) {
  if (arr.length < 2) return null;
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1));
}

// ---------- Frankfurter ----------
let fxHostCache = null;
async function fxGet(path, params) {
  const hosts = fxHostCache ? [fxHostCache, ...FX_HOSTS.filter((h) => h !== fxHostCache)] : FX_HOSTS;
  let lastErr;
  for (const host of hosts) {
    const url = new URL(host + path);
    for (const [k, v] of Object.entries(params || {})) if (v != null && v !== "") url.searchParams.set(k, v);
    try {
      const res = await fetch(url.toString(), { headers: { "User-Agent": UA, Accept: "application/json" }, redirect: "follow" });
      const text = await res.text();
      if (res.status === 404 || res.status === 422) throw Object.assign(new Error(`환율 API HTTP ${res.status}: ${text.slice(0, 200)}`), { final: true });
      if (!res.ok) throw new Error(`환율 API HTTP ${res.status}: ${text.slice(0, 120)}`);
      const json = JSON.parse(text);
      fxHostCache = host;
      return { json, host };
    } catch (e) {
      if (e.final) throw e;
      lastErr = e;
    }
  }
  throw new Error(`환율 API에 연결하지 못했습니다 (${lastErr?.message || "unknown"})`);
}

function krwStyle(base, rates) {
  // 사람이 읽기 쉬운 "1 USD = x 원" 표기
  const lines = [];
  for (const [sym, rate] of Object.entries(rates)) {
    if (base === "KRW" && rate) {
      const per = sym === "JPY" || sym === "IDR" || sym === "VND" ? 100 : 1;
      lines.push(`${per} ${sym} = ${round(per / rate, 2).toLocaleString("en-US")} 원`);
    } else if (sym === "KRW") {
      lines.push(`1 ${base} = ${round(rate, 2).toLocaleString("en-US")} 원`);
    } else {
      lines.push(`1 ${base} = ${round(rate, 6)} ${sym}`);
    }
  }
  return lines;
}

async function fxLatest(args) {
  const base = cur(args.base, "USD");
  let symbols = Array.isArray(args.symbols) && args.symbols.length ? args.symbols.map((s) => cur(s)) : ["KRW", "USD", "EUR", "JPY", "CNY"];
  symbols = symbols.filter((s) => s !== base);
  const { json, host } = await fxGet("/latest", { base, symbols: symbols.join(",") });
  return {
    source: "frankfurter (ECB reference rates)",
    host,
    date: json.date,
    base: json.base,
    rates: json.rates,
    readable: krwStyle(json.base, json.rates),
    note: FX_NOTE,
    attribution: FX_ATTR,
  };
}

async function fxHistory(args) {
  const base = cur(args.base, "USD");
  const symbol = cur(args.symbol, "KRW");
  if (base === symbol) throw new Error("base와 symbol이 같습니다.");
  const from = normDate(args.fromDate);
  if (!from) throw new Error("fromDate(YYYY-MM-DD)가 필요합니다.");
  const to = args.toDate ? normDate(args.toDate) : "";
  if (to && from > to) throw new Error("fromDate가 toDate보다 늦습니다.");
  const { json, host } = await fxGet(`/${from}..${to}`, { base, symbols: symbol });
  let rows = Object.entries(json.rates || {})
    .map(([date, r]) => ({ date, rate: r[symbol] }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) throw new Error("해당 기간 환율 데이터가 없습니다(주말·휴일만 포함됐을 수 있음).");
  const st = stats(rows.map((r) => r.rate));
  const first = rows[0], last = rows[rows.length - 1];
  const truncated = rows.length > MAX_ROWS;
  if (truncated) rows = rows.slice(-MAX_ROWS);
  return {
    source: "frankfurter (ECB reference rates)",
    host,
    pair: `${base}/${symbol}`,
    fromDate: json.start_date,
    toDate: json.end_date,
    count: Object.keys(json.rates || {}).length,
    summary: {
      first: first,
      last: last,
      min: round(st.min, 4),
      max: round(st.max, 4),
      mean: round(st.mean, 4),
      changePct: round(((last.rate - first.rate) / first.rate) * 100, 2),
    },
    rows,
    truncated: truncated ? `행이 많아 최근 ${MAX_ROWS}개만 반환` : false,
    note: FX_NOTE,
    attribution: FX_ATTR,
  };
}

async function fxConvert(args) {
  const amount = Number(args.amount);
  if (!Number.isFinite(amount)) throw new Error("amount는 숫자여야 합니다.");
  const from = cur(args.from), to = cur(args.to);
  if (from === to) return { source: "frankfurter", amount, from, to, result: amount, rate: 1 };
  const path = args.date ? `/${normDate(args.date)}` : "/latest";
  const { json, host } = await fxGet(path, { base: from, symbols: to });
  const rate = json.rates?.[to];
  if (rate == null) throw new Error(`${from}→${to} 환율을 찾지 못했습니다(ECB 미제공 통화일 수 있음).`);
  return {
    source: "frankfurter (ECB reference rates)",
    host,
    rateDate: json.date,
    amount,
    from,
    to,
    rate,
    result: round(amount * rate, 2),
    readable: `${amount.toLocaleString("en-US")} ${from} ≈ ${round(amount * rate, 2).toLocaleString("en-US")} ${to} (${json.date} 기준)`,
    note: FX_NOTE,
    attribution: FX_ATTR,
  };
}

// ---------- Upbit ----------
function toMarket(s) {
  const v = String(s || "").trim().toUpperCase();
  if (!v) throw new Error("마켓/코인 심볼이 비었습니다.");
  if (/^(KRW|BTC|USDT)-[A-Z0-9]+$/.test(v)) return v;
  if (/^[A-Z0-9]{1,15}$/.test(v)) return `KRW-${v}`;
  throw new Error(`마켓 코드 형식이 올바르지 않습니다: '${s}' (예: BTC 또는 KRW-BTC)`);
}

async function cryptoTicker(args) {
  const list = (Array.isArray(args.markets) && args.markets.length ? args.markets : ["BTC", "ETH", "XRP"]).slice(0, 20).map(toMarket);
  const url = `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(list.join(","))}`;
  const data = await getJson(url, "업비트 ticker");
  return {
    source: "upbit",
    count: data.length,
    rows: data.map((t) => ({
      market: t.market,
      price: t.trade_price,
      change: t.change,
      changeRatePct: round(t.signed_change_rate * 100, 2),
      changePrice: t.signed_change_price,
      high: t.high_price,
      low: t.low_price,
      tradeValue24hKRW: Math.round(t.acc_trade_price_24h),
      volume24h: round(t.acc_trade_volume_24h, 4),
      high52w: t.highest_52_week_price,
      low52w: t.lowest_52_week_price,
      timeKST: `${t.trade_date_kst} ${t.trade_time_kst}`,
    })),
    note: "등락률은 업비트 기준 전일 종가(KST 0시) 대비. 투자 조언이 아님.",
    attribution: UPBIT_ATTR,
  };
}

async function cryptoCandles(args) {
  const market = toMarket(args.market || "KRW-BTC");
  const interval = args.interval || "days";
  if (!["days", "weeks", "months", "minutes"].includes(interval)) throw new Error("interval은 days|weeks|months|minutes 중 하나입니다.");
  const count = Math.max(1, Math.min(Number(args.count) || 30, 200));
  let path = interval;
  if (interval === "minutes") {
    const unit = Number(args.unit) || 60;
    if (![1, 3, 5, 10, 15, 30, 60, 240].includes(unit)) throw new Error("unit은 1,3,5,10,15,30,60,240 중 하나입니다.");
    path = `minutes/${unit}`;
  }
  const url = `https://api.upbit.com/v1/candles/${path}?market=${encodeURIComponent(market)}&count=${count}`;
  const data = await getJson(url, "업비트 candles");
  const rows = data
    .map((c) => ({
      timeKST: c.candle_date_time_kst,
      open: c.opening_price,
      high: c.high_price,
      low: c.low_price,
      close: c.trade_price,
      volume: round(c.candle_acc_trade_volume, 4),
      tradeValueKRW: Math.round(c.candle_acc_trade_price),
    }))
    .reverse(); // 오래된 → 최신
  if (!rows.length) throw new Error("캔들 데이터가 없습니다.");
  const rets = [];
  for (let i = 1; i < rows.length; i++) rets.push((rows[i].close - rows[i - 1].close) / rows[i - 1].close);
  const sd = stdev(rets);
  return {
    source: "upbit",
    market,
    interval: path,
    count: rows.length,
    summary: {
      from: rows[0].timeKST,
      to: rows[rows.length - 1].timeKST,
      periodReturnPct: round(((rows[rows.length - 1].close - rows[0].open) / rows[0].open) * 100, 2),
      volatilityPct: sd == null ? null : round(sd * 100, 3),
      volatilityNote: "캔들 간 종가 수익률의 표준편차(%). 마지막 캔들은 진행 중일 수 있음.",
      highest: Math.max(...rows.map((r) => r.high)),
      lowest: Math.min(...rows.map((r) => r.low)),
    },
    rows,
    attribution: UPBIT_ATTR,
  };
}

// ---------- World Bank ----------
function toIndicator(v) {
  const s = String(v || "").trim();
  if (!s) throw new Error("indicator가 필요합니다.");
  const alias = WB_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if (/^[A-Za-z0-9]+(\.[A-Za-z0-9]+)+$/.test(s)) return s.toUpperCase();
  throw new Error(`알 수 없는 지표: '${v}'. 별칭: ${Object.keys(WB_ALIASES).join(", ")} 또는 지표 코드`);
}
function toCountry(v) {
  const s = String(v || "").trim();
  const m = COUNTRY_MAP[s] || COUNTRY_MAP[s.toLowerCase()];
  if (m) return m;
  if (/^[A-Za-z]{2,3}$/.test(s)) return s.toUpperCase();
  throw new Error(`국가를 알 수 없습니다: '${v}'. ISO 코드(KOR, USA)를 쓰세요.`);
}

async function wbFetch(codes, indicator, fromYear, toYear) {
  const url = `https://api.worldbank.org/v2/country/${codes.join(";")}/indicator/${encodeURIComponent(indicator)}?format=json&date=${fromYear}:${toYear}&per_page=1000`;
  const data = await getJson(url, "World Bank");
  if (!Array.isArray(data) || data[0]?.message) {
    const msg = data?.[0]?.message?.[0]?.value || "응답 형식 오류";
    throw new Error(`World Bank 오류: ${msg} (지표 ${indicator})`);
  }
  return { meta: data[0], rows: data[1] || [] };
}

async function wbIndicator(args) {
  const indicator = toIndicator(args.indicator);
  const countries = (Array.isArray(args.countries) && args.countries.length ? args.countries : ["KOR"]).slice(0, 10).map(toCountry);
  const year = new Date().getUTCFullYear();
  const toYear = Number(args.toYear) || year;
  const fromYear = Number(args.fromYear) || toYear - 20;
  if (fromYear > toYear) throw new Error("fromYear가 toYear보다 큽니다.");
  const { meta, rows } = await wbFetch(countries, indicator, fromYear, toYear);
  const series = {};
  let name = null;
  for (const r of rows) {
    name = name || r.indicator?.value;
    const key = r.countryiso3code || r.country?.id;
    (series[key] = series[key] || { country: r.country?.value, iso3: key, values: [] }).values.push({ year: Number(r.date), value: r.value });
  }
  const out = Object.values(series).map((s) => {
    s.values.sort((a, b) => a.year - b.year);
    const nonNull = s.values.filter((v) => v.value != null);
    s.latest = nonNull[nonNull.length - 1] || null;
    s.values = s.values.slice(-MAX_ROWS);
    return s;
  });
  return {
    source: "world-bank-wdi",
    indicator,
    indicatorName: name,
    fromYear,
    toYear,
    lastUpdated: meta?.lastupdated,
    series: out,
    note: "값이 null인 연도는 아직 집계 전이거나 미보고. 최신 연도는 1~2년 늦게 채워짐.",
    attribution: WB_ATTR,
  };
}

async function wbCompare(args) {
  const indicator = toIndicator(args.indicator);
  let list;
  if (Array.isArray(args.countries) && args.countries.length) list = args.countries.map(toCountry);
  else if (args.group) {
    list = COUNTRY_GROUPS[args.group];
    if (!list) throw new Error(`group은 ${Object.keys(COUNTRY_GROUPS).join(", ")} 중 하나입니다.`);
    list = [...list];
  } else list = [...COUNTRY_GROUPS["OECD 일부"]];
  if (args.includeKorea !== false && !list.includes("KOR")) list.push("KOR");
  list = [...new Set(list)].slice(0, 40);
  const year = new Date().getUTCFullYear();
  const { meta, rows } = await wbFetch(list, indicator, year - 15, year);
  const latest = {};
  let name = null;
  for (const r of rows) {
    name = name || r.indicator?.value;
    if (r.value == null) continue;
    const k = r.countryiso3code;
    if (!latest[k] || Number(r.date) > latest[k].year) latest[k] = { iso3: k, country: r.country?.value, year: Number(r.date), value: r.value };
  }
  const desc = args.order !== "asc";
  const ranked = Object.values(latest).sort((a, b) => (desc ? b.value - a.value : a.value - b.value)).map((r, i) => ({ rank: i + 1, ...r }));
  const missing = list.filter((c) => !latest[c]);
  const kor = ranked.find((r) => r.iso3 === "KOR");
  const years = [...new Set(ranked.map((r) => r.year))];
  return {
    source: "world-bank-wdi",
    indicator,
    indicatorName: name,
    order: desc ? "desc (큰 값이 1위)" : "asc (작은 값이 1위)",
    count: ranked.length,
    ranked,
    korea: kor ? `한국 ${kor.rank}위 / ${ranked.length}개국 (${kor.year}년 값 ${kor.value})` : "한국 값 없음",
    missingCountries: missing,
    note: years.length > 1 ? `나라별 최신 연도가 다름(${years.sort().join(", ")}). 연도 차이를 감안해 비교할 것.` : null,
    lastUpdated: meta?.lastupdated,
    attribution: WB_ATTR,
  };
}

export async function callEconTool(name, args = {}, env = {}) {
  switch (name) {
    case "fx_get_latest": return fxLatest(args);
    case "fx_get_history": return fxHistory(args);
    case "fx_convert": return fxConvert(args);
    case "crypto_get_ticker": return cryptoTicker(args);
    case "crypto_get_candles": return cryptoCandles(args);
    case "wb_get_indicator": return wbIndicator(args);
    case "wb_compare_countries": return wbCompare(args);
    default: throw new Error(`알 수 없는 경제 도구: ${name}`);
  }
}
