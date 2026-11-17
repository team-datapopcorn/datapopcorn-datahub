// NEIS(교육정보 개방 포털) 확장 도구: 학사일정, 시간표, 학급, 학과, 학원, 급식 영양·알레르기.
// KEY가 없으면 NEIS는 페이지당 5행만 준다(키 없이 호출 시). 그래서 키 없을 때는 행 상한을 낮게 잡는다.

const NEIS_BASE = "https://open.neis.go.kr/hub";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const MAX_ROWS = 200;

const ALLERGENS = {
  1: "난류", 2: "우유", 3: "메밀", 4: "땅콩", 5: "대두", 6: "밀", 7: "고등어", 8: "게", 9: "새우", 10: "돼지고기",
  11: "복숭아", 12: "토마토", 13: "아황산류", 14: "호두", 15: "닭고기", 16: "쇠고기", 17: "오징어",
  18: "조개류(굴,전복,홍합 포함)", 19: "잣",
};
const ALLERGEN_ALIASES = {
  계란: 1, 달걀: 1, 알류: 1, 난류: 1, 우유: 2, 유제품: 2, 메밀: 3, 땅콩: 4, 대두: 5, 콩: 5, 밀: 6, 밀가루: 6,
  고등어: 7, 게: 8, 꽃게: 8, 새우: 9, 돼지고기: 10, 돼지: 10, 복숭아: 11, 토마토: 12, 아황산류: 13, 아황산: 13,
  호두: 14, 닭고기: 15, 닭: 15, 쇠고기: 16, 소고기: 16, 오징어: 17, 조개류: 18, 조개: 18, 굴: 18, 전복: 18,
  홍합: 18, 잣: 19,
};

const office = { type: "string", description: "시도교육청 코드, 예: B10(서울), C10(부산), J10(경기)" };
const school = { type: "string", description: "표준학교코드 SD_SCHUL_CODE (학교 검색 결과의 값)" };
const fromDate = { type: "string", description: "시작일 YYYY-MM-DD 또는 YYYYMMDD" };
const toDate = { type: "string", description: "종료일 YYYY-MM-DD 또는 YYYYMMDD" };

export const NEIS2_TOOLS = [
  {
    name: "neis_get_school_schedule",
    description:
      "[NEIS] 학교 학사일정(방학, 시험, 행사, 공휴일 등)을 조회합니다. 기간(fromDate/toDate) 또는 월(month)로 지정. 예: '가락고 2026년 12월 학사일정 알려줘'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: office, schoolCode: school, fromDate, toDate,
        month: { type: "string", description: "선택. YYYY-MM 형식(예: 2026-12). 지정하면 그 달 전체" },
      },
      required: ["officeCode", "schoolCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_get_timetable",
    description:
      "[NEIS] 초·중·고 시간표를 날짜별·교시별로 조회합니다. 예: '가락고 1학년 1반 이번 주 시간표'",
    inputSchema: {
      type: "object",
      properties: {
        schoolLevel: { type: "string", enum: ["초", "중", "고"], description: "학교급: 초 / 중 / 고" },
        officeCode: office, schoolCode: school,
        grade: { type: "string", description: "학년, 예: 1" },
        className: { type: "string", description: "반, 예: 1" },
        fromDate, toDate,
      },
      required: ["schoolLevel", "officeCode", "schoolCode", "fromDate", "toDate"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_get_class_info",
    description: "[NEIS] 학교의 학년별 학급(반) 목록과 계열·학과를 조회합니다. 예: '가락고 2026년 1학년 몇 반까지 있어?'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: office, schoolCode: school,
        year: { type: "string", description: "학년도, 예: 2026 (기본: 올해)" },
        grade: { type: "string", description: "선택. 학년" },
      },
      required: ["officeCode", "schoolCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_get_school_majors",
    description: "[NEIS] 학교의 계열·학과 정보를 조회합니다(특성화고·마이스터고 학과 확인에 유용). 예: '이 고등학교 학과 뭐 있어?'",
    inputSchema: {
      type: "object",
      properties: { officeCode: office, schoolCode: school },
      required: ["officeCode", "schoolCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_search_academies",
    description:
      "[NEIS] 학원·교습소를 지역(구)·분야·이름으로 검색합니다. 정원, 교습과정, 수강료 정보 포함. 예: '서울 강남구 영어 학원 찾아줘'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: office,
        zone: { type: "string", description: "선택. 행정구역명(시군구), 예: 강남구" },
        realm: { type: "string", description: "선택. 분야명, 예: 입시.검정 및 보습, 예능(대), 외국어" },
        name: { type: "string", description: "선택. 학원명 부분 일치" },
        limit: { type: "integer", minimum: 1, maximum: 200, default: 50, description: "최대 반환 건수" },
      },
      required: ["officeCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_get_meal_nutrition",
    description:
      "[NEIS] 학교 급식의 메뉴(알레르기 번호 제거), 칼로리, 영양성분, 원산지를 정리해서 조회합니다. 예: '가락고 이번 주 급식 칼로리랑 영양성분'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: office, schoolCode: school,
        date: { type: "string", description: "선택. 특정 날짜" }, fromDate, toDate,
        mealCode: { type: "string", description: "선택. 1:조식, 2:중식, 3:석식" },
      },
      required: ["officeCode", "schoolCode"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "neis_meal_allergen_check",
    description:
      "[NEIS] 급식 메뉴의 알레르기 번호(1~19)를 해석해서, 지정한 알레르기 유발 식품이 든 메뉴와 안전한 메뉴를 날짜별로 알려줍니다. 예: '우리 아이 우유랑 땅콩 알레르기인데 이번 주 급식 피해야 할 메뉴'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: office, schoolCode: school,
        allergens: {
          type: "array", items: { type: ["string", "integer"] },
          description: "알레르기 식품 이름 또는 번호, 예: [\"우유\", \"땅콩\"] 또는 [2, 4]",
        },
        date: { type: "string", description: "선택. 특정 날짜" }, fromDate, toDate,
        mealCode: { type: "string", description: "선택. 1:조식, 2:중식, 3:석식" },
      },
      required: ["officeCode", "schoolCode", "allergens"],
    },
    annotations: READ_ONLY,
  },
];

export const NEIS2_TOOL_NAMES = new Set(NEIS2_TOOLS.map((t) => t.name));

function ymd(value, label) {
  if (value === undefined || value === null || value === "") return undefined;
  const s = String(value).trim().replace(/-/g, "");
  if (!/^\d{8}$/.test(s)) throw new Error(`${label} 날짜 형식이 잘못됨: ${value} (YYYY-MM-DD 또는 YYYYMMDD)`);
  return s;
}
const dash = (s) => (s && s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s);

function need(args, keys) {
  for (const k of keys) if (args[k] === undefined || args[k] === null || args[k] === "") throw new Error(`${k} 값이 필요함`);
}

// 페이지를 이어붙여 행을 모은다. 키 없으면 페이지당 5행이라 maxRows를 낮춘다.
async function neisRows(env, service, params, maxRows = MAX_ROWS) {
  const hasKey = !!env.NEIS_API_KEY;
  const pSize = hasKey ? 1000 : 5;
  const cap = hasKey ? maxRows : Math.min(maxRows, 100);
  const rows = [];
  let total = 0;
  for (let pIndex = 1; pIndex <= Math.ceil(cap / pSize) + 1; pIndex++) {
    const url = new URL(`${NEIS_BASE}/${service}`);
    url.searchParams.set("Type", "json");
    if (hasKey) url.searchParams.set("KEY", env.NEIS_API_KEY);
    url.searchParams.set("pIndex", String(pIndex));
    url.searchParams.set("pSize", String(pSize));
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`NEIS HTTP ${res.status}`);
    const data = await res.json();
    if (!data[service]) {
      const r = data.RESULT || {};
      if (r.CODE === "INFO-200") break; // 데이터 없음
      throw new Error(`NEIS 오류 ${r.CODE || "?"}: ${r.MESSAGE || JSON.stringify(data).slice(0, 200)}`);
    }
    total = data[service][0].head[0].list_total_count;
    const page = data[service][1]?.row ?? [];
    rows.push(...page);
    if (page.length === 0 || rows.length >= total || rows.length >= cap) break;
  }
  const truncated = rows.length < total;
  return {
    rows: rows.slice(0, cap),
    total,
    truncated,
    note: truncated
      ? `전체 ${total}건 중 ${Math.min(rows.length, cap)}건만 반환${hasKey ? "" : " (NEIS 인증키 없이 호출해 페이지당 5행 제한)"}. 기간을 좁혀서 다시 조회하세요.`
      : undefined,
  };
}

function cleanDish(s) {
  return s.replace(/\s*\(([\d.\s]+)\)\s*$/, "").replace(/[*#]/g, "").trim();
}
function dishList(ddish) {
  return String(ddish || "")
    .split(/<br\s*\/?>/i)
    .map((d) => d.trim())
    .filter(Boolean)
    .map((raw) => {
      const m = raw.match(/\(([\d.\s]+)\)\s*$/);
      const nums = m ? [...new Set(m[1].split(".").map((x) => parseInt(x, 10)).filter((n) => n >= 1 && n <= 19))] : [];
      return { name: cleanDish(raw), allergenNumbers: nums, allergens: nums.map((n) => ALLERGENS[n]) };
    });
}
function parsePairs(s) {
  const out = {};
  for (const line of String(s || "").split(/<br\s*\/?>/i)) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!k) continue;
    const num = Number(v);
    out[k] = v !== "" && !Number.isNaN(num) ? num : v;
  }
  return out;
}
function mealParams(args) {
  need(args, ["officeCode", "schoolCode"]);
  const date = ymd(args.date, "date");
  const from = ymd(args.fromDate, "fromDate");
  const to = ymd(args.toDate, "toDate");
  if (!date && !(from && to)) throw new Error("date 또는 fromDate/toDate가 필요함");
  return {
    ATPT_OFCDC_SC_CODE: args.officeCode, SD_SCHUL_CODE: args.schoolCode,
    MLSV_YMD: date, MLSV_FROM_YMD: date ? undefined : from, MLSV_TO_YMD: date ? undefined : to,
    MMEAL_SC_CODE: args.mealCode,
  };
}
function resolveAllergen(a) {
  if (typeof a === "number" || /^\d+$/.test(String(a).trim())) {
    const n = Number(a);
    if (ALLERGENS[n]) return n;
  } else {
    const s = String(a).trim();
    if (ALLERGEN_ALIASES[s]) return ALLERGEN_ALIASES[s];
    for (const [n, name] of Object.entries(ALLERGENS)) if (name.startsWith(s)) return Number(n);
  }
  throw new Error(`알 수 없는 알레르기 식품: ${a}. 1~19 번호나 이름(${Object.values(ALLERGENS).join(", ")})을 쓰세요`);
}

export async function callNeis2Tool(name, args = {}, env = {}) {
  switch (name) {
    case "neis_get_school_schedule": {
      need(args, ["officeCode", "schoolCode"]);
      let from = ymd(args.fromDate, "fromDate");
      let to = ymd(args.toDate, "toDate");
      if (args.month) {
        const m = String(args.month).trim().match(/^(\d{4})-?(\d{2})$/);
        if (!m) throw new Error("month는 YYYY-MM 형식");
        const last = new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate();
        from = `${m[1]}${m[2]}01`;
        to = `${m[1]}${m[2]}${String(last).padStart(2, "0")}`;
      }
      if (!from || !to) throw new Error("fromDate/toDate 또는 month가 필요함");
      const r = await neisRows(env, "SchoolSchedule", {
        ATPT_OFCDC_SC_CODE: args.officeCode, SD_SCHUL_CODE: args.schoolCode, AA_FROM_YMD: from, AA_TO_YMD: to,
      });
      const gradeKeys = ["ONE", "TW", "THREE", "FR", "FIV", "SIX"];
      return {
        school: r.rows[0]?.SCHUL_NM ?? null,
        fromDate: dash(from), toDate: dash(to), count: r.rows.length, total: r.total, note: r.note,
        events: r.rows.map((x) => ({
          date: dash(x.AA_YMD), name: x.EVENT_NM, detail: x.EVENT_CNTNT || undefined, dayType: x.SBTR_DD_SC_NM,
          grades: gradeKeys.map((g, i) => (x[`${g}_GRADE_EVENT_YN`] === "Y" ? i + 1 : null)).filter(Boolean),
        })),
      };
    }
    case "neis_get_timetable": {
      need(args, ["schoolLevel", "officeCode", "schoolCode", "fromDate", "toDate"]);
      const svc = { 초: "elsTimetable", 중: "misTimetable", 고: "hisTimetable" }[String(args.schoolLevel).trim()[0]];
      if (!svc) throw new Error("schoolLevel은 초 / 중 / 고 중 하나");
      const from = ymd(args.fromDate, "fromDate");
      const to = ymd(args.toDate, "toDate");
      const r = await neisRows(env, svc, {
        ATPT_OFCDC_SC_CODE: args.officeCode, SD_SCHUL_CODE: args.schoolCode, GRADE: args.grade,
        CLASS_NM: args.className, TI_FROM_YMD: from, TI_TO_YMD: to,
      });
      const byDate = {};
      for (const x of r.rows) {
        const key = `${dash(x.ALL_TI_YMD)}|${x.GRADE}-${x.CLASS_NM}`;
        (byDate[key] = byDate[key] || { date: dash(x.ALL_TI_YMD), grade: x.GRADE, className: x.CLASS_NM, periods: [] })
          .periods.push({ period: Number(x.PERIO), subject: x.ITRT_CNTNT });
      }
      const days = Object.values(byDate).sort((a, b) => (a.date + a.className).localeCompare(b.date + b.className));
      days.forEach((d) => d.periods.sort((a, b) => a.period - b.period));
      return { school: r.rows[0]?.SCHUL_NM ?? null, total: r.total, note: r.note, days };
    }
    case "neis_get_class_info": {
      need(args, ["officeCode", "schoolCode"]);
      const year = args.year || String(new Date().getFullYear());
      const r = await neisRows(env, "classInfo", {
        ATPT_OFCDC_SC_CODE: args.officeCode, SD_SCHUL_CODE: args.schoolCode, AY: year, GRADE: args.grade,
      });
      const byGrade = {};
      for (const x of r.rows) {
        (byGrade[x.GRADE] = byGrade[x.GRADE] || { grade: x.GRADE, classes: [] }).classes.push({
          className: x.CLASS_NM, track: x.ORD_SC_NM || undefined, major: x.DDDEP_NM || undefined, course: x.DGHT_CRSE_SC_NM,
        });
      }
      return {
        school: r.rows[0]?.SCHUL_NM ?? null, year, total: r.total, note: r.note,
        grades: Object.values(byGrade).map((g) => ({ ...g, classCount: g.classes.length })),
      };
    }
    case "neis_get_school_majors": {
      need(args, ["officeCode", "schoolCode"]);
      const r = await neisRows(env, "schoolMajorinfo", { ATPT_OFCDC_SC_CODE: args.officeCode, SD_SCHUL_CODE: args.schoolCode });
      return {
        school: r.rows[0]?.SCHUL_NM ?? null, total: r.total, note: r.note,
        majors: r.rows.map((x) => ({ course: x.DGHT_CRSE_SC_NM, track: x.ORD_SC_NM, major: x.DDDEP_NM })),
      };
    }
    case "neis_search_academies": {
      need(args, ["officeCode"]);
      const limit = Math.min(Math.max(parseInt(args.limit ?? 50, 10) || 50, 1), 200);
      const r = await neisRows(env, "acaInsTiInfo", {
        ATPT_OFCDC_SC_CODE: args.officeCode, ADMST_ZONE_NM: args.zone, REALM_SC_NM: args.realm, ACA_NM: args.name,
      }, limit);
      return {
        total: r.total, count: r.rows.length,
        note: r.rows.length < r.total ? `전체 ${r.total}건 중 ${r.rows.length}건. 조건(zone/realm/name)을 좁히거나 limit을 늘리세요.${env.NEIS_API_KEY ? "" : " (인증키 없이 호출 중이라 최대 100건)"}` : undefined,
        academies: r.rows.map((x) => ({
          name: x.ACA_NM, type: x.ACA_INSTI_SC_NM, zone: x.ADMST_ZONE_NM, status: x.REG_STTUS_NM,
          address: [x.FA_RDNMA, x.FA_RDNDA].filter((v) => v && v.trim()).join(" ") || undefined,
          phone: x.FA_TELNO || undefined, realm: x.REALM_SC_NM, subjectGroup: x.LE_ORD_NM, courseList: x.LE_CRSE_LIST_NM,
          course: x.LE_CRSE_NM, capacity: x.TOFOR_SMTOT ?? undefined, dailyCapacity: x.DTM_RCPTN_ABLTY_NMPR_SMTOT ?? undefined,
          fee: x.PSNBY_THCC_CNTNT || undefined, feeDisclosed: x.THCC_OTHBC_YN || undefined, boarding: x.BRHS_ACA_YN || undefined,
          established: dash(x.ESTBL_YMD), registered: dash(x.REG_YMD),
        })),
      };
    }
    case "neis_get_meal_nutrition": {
      const r = await neisRows(env, "mealServiceDietInfo", mealParams(args));
      return {
        school: r.rows[0]?.SCHUL_NM ?? null, count: r.rows.length, note: r.note,
        meals: r.rows.map((x) => ({
          date: dash(x.MLSV_YMD), meal: x.MMEAL_SC_NM, servings: x.MLSV_FGR,
          dishes: dishList(x.DDISH_NM).map((d) => d.name),
          calories: x.CAL_INFO, caloriesKcal: parseFloat(x.CAL_INFO) || null,
          nutrition: parsePairs(x.NTR_INFO), origin: parsePairs(x.ORPLC_INFO),
        })),
      };
    }
    case "neis_meal_allergen_check": {
      if (!Array.isArray(args.allergens) || !args.allergens.length) throw new Error("allergens 배열이 필요함, 예: [\"우유\", 4]");
      const want = [...new Set(args.allergens.map(resolveAllergen))];
      const r = await neisRows(env, "mealServiceDietInfo", mealParams(args));
      return {
        school: r.rows[0]?.SCHUL_NM ?? null,
        checking: want.map((n) => `${n}.${ALLERGENS[n]}`), note: r.note,
        caution: "알레르기 번호는 학교가 입력한 표시 기준. 실제 원재료·교차오염은 학교 영양사에게 확인하세요.",
        meals: r.rows.map((x) => {
          const dishes = dishList(x.DDISH_NM);
          const avoid = dishes.filter((d) => d.allergenNumbers.some((n) => want.includes(n)))
            .map((d) => ({ name: d.name, contains: d.allergenNumbers.filter((n) => want.includes(n)).map((n) => ALLERGENS[n]) }));
          return {
            date: dash(x.MLSV_YMD), meal: x.MMEAL_SC_NM, avoid,
            safe: dishes.filter((d) => !d.allergenNumbers.some((n) => want.includes(n))).map((d) => d.name),
          };
        }),
      };
    }
    default:
      throw new Error(`알 수 없는 NEIS 도구: ${name}`);
  }
}
