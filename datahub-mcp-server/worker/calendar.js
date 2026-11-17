// 달력·영업일 도구. 공휴일은 Nager.Date 공개 API(키 불필요). 연도별로 모듈 메모리에 캐시.

const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const HOLIDAY_NOTE =
  "공휴일 출처: Nager.Date(date.nager.at). 대체공휴일은 원래 날짜 대신 실제 쉬는 날로 표기될 수 있고, 정부가 나중에 지정한 임시공휴일·선거일은 빠질 수 있음. 중요한 일정은 인사혁신처 공고로 다시 확인하세요.";
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const cache = new Map();

const dateProp = (d) => ({ type: "string", description: `${d} YYYY-MM-DD 또는 YYYYMMDD` });
const country = { type: "string", default: "KR", description: "국가 코드(ISO 2자리), 기본 KR" };

export const CAL_TOOLS = [
  {
    name: "cal_holidays",
    description: "[달력] 특정 연도의 공휴일 목록(한국 기본, 다른 나라도 가능)을 조회합니다. 예: '2026년 공휴일 알려줘'",
    inputSchema: {
      type: "object",
      properties: { year: { type: "integer", description: "연도, 예: 2026 (기본: 올해)" }, countryCode: country },
    },
    annotations: READ_ONLY,
  },
  {
    name: "cal_business_days",
    description: "[달력] 두 날짜 사이(양 끝 포함) 영업일 수를 셉니다. 주말·공휴일 제외, 제외된 공휴일 목록 포함. 예: '12월 영업일 며칠이야?'",
    inputSchema: {
      type: "object",
      properties: { from: dateProp("시작일"), to: dateProp("종료일"), countryCode: country },
      required: ["from", "to"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "cal_add_business_days",
    description: "[달력] 날짜에서 영업일 N일 후(음수면 전)의 날짜를 계산합니다. 예: '오늘부터 영업일 10일 뒤가 언제야?'",
    inputSchema: {
      type: "object",
      properties: {
        date: dateProp("기준일(기본: 오늘, 한국 시간)"),
        days: { type: "integer", description: "더할 영업일 수, 음수 가능" },
        countryCode: country,
      },
      required: ["days"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "cal_date_info",
    description: "[달력] 날짜의 요일, ISO 주차, 분기, 연중 몇 번째 날, 오늘(한국 시간)부터 며칠 남았는지, 공휴일 여부를 알려줍니다. 예: '2026-12-25는 무슨 요일이고 며칠 남았어?'",
    inputSchema: {
      type: "object",
      properties: { date: dateProp("날짜(기본: 오늘)"), countryCode: country },
    },
    annotations: READ_ONLY,
  },
  {
    name: "cal_date_diff",
    description: "[달력] 두 날짜 사이의 일수, 주, 개월+일, 년, 영업일 수를 계산합니다. 예: '2026-03-02부터 2026-12-31까지 며칠, 몇 영업일?'",
    inputSchema: {
      type: "object",
      properties: { from: dateProp("시작일"), to: dateProp("종료일"), countryCode: country },
      required: ["from", "to"],
    },
    annotations: READ_ONLY,
  },
];

export const CAL_TOOL_NAMES = new Set(CAL_TOOLS.map((t) => t.name));

const DAY = 86400e3;
function todayKst() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}
function parseDate(value, label) {
  const raw = value === undefined || value === null || value === "" ? todayKst() : String(value).trim();
  let s = raw;
  if (/^\d{8}$/.test(s)) s = `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${label} 날짜 형식이 잘못됨: ${value} (YYYY-MM-DD 또는 YYYYMMDD)`);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error(`${label} 존재하지 않는 날짜: ${value}`);
  return d;
}
const iso = (d) => d.toISOString().slice(0, 10);
const cc = (c) => String(c || "KR").trim().toUpperCase();

async function holidays(year, countryCode) {
  const key = `${year}-${countryCode}`;
  if (cache.has(key)) return cache.get(key);
  const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
  if (res.status === 404) throw new Error(`지원하지 않는 국가 코드: ${countryCode}`);
  if (!res.ok) throw new Error(`공휴일 API HTTP ${res.status}`);
  const text = await res.text();
  const list = text ? JSON.parse(text) : [];
  const out = list.map((h) => ({ date: h.date, name: h.localName, englishName: h.name, global: h.global }));
  cache.set(key, out);
  return out;
}
async function holidayMap(fromD, toD, countryCode) {
  const map = new Map();
  for (let y = fromD.getUTCFullYear(); y <= toD.getUTCFullYear(); y++) {
    for (const h of await holidays(y, countryCode)) {
      if (!map.has(h.date)) map.set(h.date, h.name);
      else if (!map.get(h.date).includes(h.name)) map.set(h.date, `${map.get(h.date)}, ${h.name}`);
    }
  }
  return map;
}
const isWeekend = (d) => d.getUTCDay() === 0 || d.getUTCDay() === 6;

async function countBusiness(fromD, toD, countryCode) {
  const [a, b] = fromD <= toD ? [fromD, toD] : [toD, fromD];
  if ((b - a) / DAY > 3660) throw new Error("기간은 최대 10년");
  const hm = await holidayMap(a, b, countryCode);
  let business = 0, weekend = 0;
  const excluded = [];
  for (let t = a.getTime(); t <= b.getTime(); t += DAY) {
    const d = new Date(t);
    const k = iso(d);
    if (isWeekend(d)) weekend++;
    else if (hm.has(k)) excluded.push({ date: k, weekday: DOW[d.getUTCDay()], name: hm.get(k) });
    else business++;
  }
  return { business, weekend, excluded, calendarDays: Math.round((b - a) / DAY) + 1 };
}

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { isoYear: t.getUTCFullYear(), isoWeek: Math.ceil(((t - y0) / DAY + 1) / 7) };
}

function monthsDays(a, b) {
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
  let anchor = addMonths(a, months);
  if (anchor > b) { months--; anchor = addMonths(a, months); }
  return { months, days: Math.round((b - anchor) / DAY) };
}
function addMonths(d, n) {
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

export async function callCalTool(name, args = {}) {
  const country = cc(args.countryCode);
  switch (name) {
    case "cal_holidays": {
      const year = parseInt(args.year ?? new Date().getFullYear(), 10);
      if (!(year >= 1900 && year <= 2100)) throw new Error("year는 1900~2100");
      const list = await holidays(year, country);
      return {
        year, countryCode: country, count: list.length,
        holidays: list.map((h) => ({ ...h, weekday: DOW[new Date(`${h.date}T00:00:00Z`).getUTCDay()] })),
        note: country === "KR" ? HOLIDAY_NOTE : "출처: Nager.Date(date.nager.at)",
      };
    }
    case "cal_business_days": {
      const a = parseDate(args.from, "from"), b = parseDate(args.to, "to");
      if (a > b) throw new Error("from이 to보다 늦음");
      const r = await countBusiness(a, b, country);
      return {
        from: iso(a), to: iso(b), countryCode: country, calendarDays: r.calendarDays, businessDays: r.business,
        weekendDays: r.weekend, holidaysOnWeekdays: r.excluded, note: country === "KR" ? HOLIDAY_NOTE : undefined,
      };
    }
    case "cal_add_business_days": {
      const n = parseInt(args.days, 10);
      if (Number.isNaN(n)) throw new Error("days(정수)가 필요함");
      if (Math.abs(n) > 2500) throw new Error("days는 ±2500 이내");
      const start = parseDate(args.date, "date");
      const step = n >= 0 ? 1 : -1;
      const span = Math.ceil(Math.abs(n) * 1.6) + 30;
      const lo = new Date(start.getTime() - (step < 0 ? span : 0) * DAY);
      const hi = new Date(start.getTime() + (step > 0 ? span : 0) * DAY);
      const hm = await holidayMap(lo, hi, country);
      let d = start, left = Math.abs(n);
      const skipped = [];
      while (left > 0) {
        d = new Date(d.getTime() + step * DAY);
        const k = iso(d);
        if (isWeekend(d)) continue;
        if (hm.has(k)) { skipped.push({ date: k, name: hm.get(k) }); continue; }
        left--;
      }
      return {
        start: iso(start), startWeekday: DOW[start.getUTCDay()], businessDays: n, result: iso(d),
        resultWeekday: DOW[d.getUTCDay()], calendarDays: Math.round((d - start) / DAY), skippedHolidays: skipped,
        note: "기준일 자체는 세지 않음(다음 영업일부터 1일). " + (country === "KR" ? HOLIDAY_NOTE : ""),
      };
    }
    case "cal_date_info": {
      const d = parseDate(args.date, "date");
      const k = iso(d);
      const hm = await holidayMap(d, d, country);
      const y0 = Date.UTC(d.getUTCFullYear(), 0, 1);
      const today = parseDate(todayKst(), "today");
      const leap = new Date(Date.UTC(d.getUTCFullYear(), 1, 29)).getUTCMonth() === 1;
      return {
        date: k, weekday: `${DOW[d.getUTCDay()]}요일`, ...isoWeek(d), quarter: Math.floor(d.getUTCMonth() / 3) + 1,
        dayOfYear: Math.round((d - y0) / DAY) + 1, daysInYear: leap ? 366 : 365,
        today: iso(today), daysFromToday: Math.round((d - today) / DAY),
        isWeekend: isWeekend(d), isHoliday: hm.has(k), holidayName: hm.get(k) ?? null,
        isBusinessDay: !isWeekend(d) && !hm.has(k),
      };
    }
    case "cal_date_diff": {
      const a = parseDate(args.from, "from"), b = parseDate(args.to, "to");
      const sign = a <= b ? 1 : -1;
      const [x, y] = sign > 0 ? [a, b] : [b, a];
      const days = Math.round((y - x) / DAY);
      const md = monthsDays(x, y);
      const r = await countBusiness(x, y, country);
      return {
        from: iso(a), to: iso(b), direction: sign > 0 ? "미래 방향" : "과거 방향",
        days: sign * days, daysInclusive: sign * (days + 1), weeks: { weeks: Math.floor(days / 7), days: days % 7 },
        monthsAndDays: md, years: Math.round((days / 365.2425) * 100) / 100,
        businessDaysInclusive: r.business, holidaysOnWeekdays: r.excluded.length,
        note: "days는 끝 날짜만 포함(차이), daysInclusive·영업일은 양 끝 포함",
      };
    }
    default:
      throw new Error(`알 수 없는 달력 도구: ${name}`);
  }
}
