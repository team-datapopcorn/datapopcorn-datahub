// 비즈니스 지표 계산 도구 (네트워크 호출 없음, 순수 JS). 입력 숫자는 "1,234" 같은 문자열도 허용.

const RO = { readOnlyHint: true, openWorldHint: false };
const DAY = 86400000;

function num(v, label, { optional = false, min, max } = {}) {
  if (v === undefined || v === null || v === "") {
    if (optional) return undefined;
    throw new Error(`${label} 값이 필요합니다.`);
  }
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,\s원₩%]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${label} 값이 숫자가 아닙니다: ${v}`);
  if (min !== undefined && n < min) throw new Error(`${label} 값은 ${min} 이상이어야 합니다.`);
  if (max !== undefined && n > max) throw new Error(`${label} 값은 ${max} 이하여야 합니다.`);
  return n;
}
const r1 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);
const r4 = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x * 10000) / 10000);
const won = (x) => (x === null || x === undefined || !Number.isFinite(x) ? null : Math.round(x));
const pct = (a, b) => (b ? r1((a / b) * 100) : null);
function arr(v, label, minLen = 1) {
  if (!Array.isArray(v) || v.length < minLen) throw new Error(`${label}는 최소 ${minLen}개 항목이 있는 배열이어야 합니다.`);
  return v;
}
function parseDate(s, label) {
  const m = String(s ?? "").trim().match(/^(\d{4})[-./]?(\d{1,2})[-./]?(\d{1,2})/);
  if (!m) throw new Error(`${label} 날짜 형식이 올바르지 않습니다(YYYY-MM-DD): ${s}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}
const iso = (t) => new Date(t).toISOString().slice(0, 10);

function normInv(p) {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= 1 - pl) {
    const q = p - 0.5, r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

const obj = (properties, required = []) => ({ type: "object", properties, required });
const N = (description) => ({ type: ["number", "string"], description });

export const BIZ_TOOLS = [
  {
    name: "biz_funnel_conversion",
    description: "[비즈니스] 퍼널 단계별 인원으로 전단계 대비 전환율, 누적 전환율, 가장 크게 새는 구간을 계산합니다. 예: '방문 10000, 장바구니 1200, 결제 300 퍼널 분석해줘'",
    inputSchema: obj({ steps: { type: "array", description: "순서대로 [{name: 단계명, count: 인원}] (2개 이상)", items: obj({ name: { type: "string" }, count: N("인원") }, ["count"]) } }, ["steps"]),
    annotations: RO,
  },
  {
    name: "biz_cohort_retention",
    description: "[비즈니스] 사용자 활동 기록(userId, date)이나 미리 만든 코호트 표로 가입 코호트별 리텐션(%) 표와 평균 리텐션 곡선을 계산합니다. 첫 활동일을 가입일로 봅니다. 예: '이 로그인 기록으로 주간 리텐션 표 만들어줘'",
    inputSchema: obj({
      events: { type: "array", description: "[{userId, date: YYYY-MM-DD}] 활동 기록", items: obj({ userId: { type: ["string", "number"] }, date: { type: "string" } }, ["userId", "date"]) },
      matrix: { type: "array", description: "events 대신 사용. [{cohort: 이름, counts: [코호트 크기, 1기간 후 잔존 수, 2기간 후 ...]}]", items: obj({ cohort: { type: "string" }, counts: { type: "array", items: N("인원") } }, ["counts"]) },
      period: { type: "string", enum: ["day", "week", "month"], default: "week", description: "기간 단위 (주는 월요일 시작)" },
      maxPeriods: { type: "integer", default: 12, description: "표에 보여줄 최대 기간 수" },
    }),
    annotations: RO,
  },
  {
    name: "biz_rfm_segment",
    description: "[비즈니스] 거래 내역(customerId, date, amount)으로 고객별 R(최근성)·F(빈도)·M(금액) 5분위 점수와 세그먼트(챔피언/충성고객/신규·유망/관심필요/이탈위험/휴면)를 계산합니다. 예: '주문 내역으로 RFM 고객 세분화 해줘'",
    inputSchema: obj({
      transactions: { type: "array", description: "[{customerId, date: YYYY-MM-DD, amount}]", items: obj({ customerId: { type: ["string", "number"] }, date: { type: "string" }, amount: N("금액") }, ["customerId", "date", "amount"]) },
      asOfDate: { type: "string", description: "기준일 YYYY-MM-DD (기본: 마지막 거래일)" },
      limit: { type: "integer", default: 20, description: "상위 고객 표시 수 (최대 100)" },
    }, ["transactions"]),
    annotations: RO,
  },
  {
    name: "biz_pareto_abc",
    description: "[비즈니스] 상품·고객별 값(매출 등)을 큰 순서로 누적해 A(상위 80%)·B(다음 15%)·C(나머지 5%) 등급을 매기고 상위 20% 항목의 비중을 계산합니다(파레토 80/20 점검). 예: '상품별 매출로 ABC 분석해줘'",
    inputSchema: obj({ items: { type: "array", description: "[{name, value}]", items: obj({ name: { type: "string" }, value: N("값") }, ["name", "value"]) } }, ["items"]),
    annotations: RO,
  },
  {
    name: "biz_ltv_cac",
    description: "[비즈니스] 월 ARPU, 매출총이익률, 월 이탈률, 고객획득비용(CAC)으로 LTV, LTV/CAC 비율, CAC 회수 기간(개월)을 계산하고 판정합니다. 예: 'ARPU 3만원, 마진 70%, 월 이탈 5%, CAC 20만원이면 괜찮아?'",
    inputSchema: obj({ arpu: N("고객 1명당 월 매출(원)"), grossMarginPct: N("매출총이익률 % (기본 100)"), monthlyChurnPct: N("월 이탈률 %"), cac: N("고객 1명 획득 비용(원)") }, ["arpu", "monthlyChurnPct", "cac"]),
    annotations: RO,
  },
  {
    name: "biz_break_even",
    description: "[비즈니스] 고정비, 판매 단가, 단위당 변동비로 손익분기 판매량·매출을 계산하고, 예상 판매량이 있으면 안전한계율과 예상 이익을 계산합니다. 예: '월 고정비 500만원, 단가 2만원, 원가 8천원이면 몇 개 팔아야 해?'",
    inputSchema: obj({ fixedCosts: N("기간 고정비(원)"), unitPrice: N("판매 단가(원)"), unitVariableCost: N("단위당 변동비(원)"), expectedUnits: N("선택. 예상 판매량") }, ["fixedCosts", "unitPrice", "unitVariableCost"]),
    annotations: RO,
  },
  {
    name: "biz_unit_economics",
    description: "[비즈니스] 주문 1건 기준 판매가, 원가, 배송비, 결제·플랫폼 수수료율, 주문당 광고비로 공헌이익과 공헌이익률을 계산합니다. 판매가에 부가세 포함 여부를 반영합니다. 예: '2만9천원짜리 상품 원가 9천, 배송 3천, 스마트스토어 수수료 5.6%, 광고비 4천이면 남아?'",
    inputSchema: obj({
      price: N("주문당 판매가(원)"), cogs: N("주문당 상품 원가(원, 부가세 제외)"), shippingCost: N("주문당 배송비 부담(원)"),
      paymentFeePct: N("결제 수수료율 %"), platformFeePct: N("플랫폼(판매) 수수료율 %"), adCostPerOrder: N("주문당 광고비(원)"),
      otherCostPerOrder: N("주문당 기타 비용(포장 등, 원)"), vatIncluded: { type: "boolean", default: true, description: "판매가에 부가세 10% 포함 여부" },
    }, ["price", "cogs"]),
    annotations: RO,
  },
  {
    name: "biz_price_elasticity",
    description: "[비즈니스] 가격별 판매량 기록으로 가격탄력성을 계산합니다. 2개면 호(arc) 탄력성, 3개 이상이면 로그-로그 회귀로 추정하고, 매출을 키우려면 가격을 올릴지 내릴지 힌트를 줍니다. 예: '1만원일 때 500개, 1만2천원일 때 420개 팔렸어. 탄력성은?'",
    inputSchema: obj({ points: { type: "array", description: "[{price, quantity}] 2개 이상", items: obj({ price: N("가격"), quantity: N("판매량") }, ["price", "quantity"]) } }, ["points"]),
    annotations: RO,
  },
  {
    name: "biz_nps",
    description: "[비즈니스] 0~10점 추천 의향 점수(또는 추천·중립·비추천 인원)로 NPS, 각 그룹 비율, 95% 오차범위를 계산합니다. 예: '설문 점수 [10,9,7,3,8,10]로 NPS 계산해줘'",
    inputSchema: obj({
      scores: { type: "array", items: N("0~10 점수"), description: "응답 점수 배열" },
      counts: obj({ promoters: N("9~10점 인원"), passives: N("7~8점 인원"), detractors: N("0~6점 인원") }),
    }),
    annotations: RO,
  },
  {
    name: "biz_saas_metrics",
    description: "[비즈니스] 월별 MRR 구성(기초, 신규, 확장, 축소, 해지)으로 순·총 매출 유지율(NRR/GRR), MRR 이탈률, SaaS 퀵 레이쇼, 기말 MRR을 계산합니다. 예: '10월 MRR 1000만, 신규 200만, 확장 50만, 해지 80만이면 NRR은?'",
    inputSchema: obj({
      months: { type: "array", description: "[{month, startMrr, newMrr, expansionMrr, contractionMrr, churnedMrr}]", items: obj({ month: { type: "string" }, startMrr: N("기초 MRR"), newMrr: N("신규"), expansionMrr: N("확장"), contractionMrr: N("축소"), churnedMrr: N("해지") }, ["startMrr"]) },
    }, ["months"]),
    annotations: RO,
  },
  {
    name: "biz_ad_metrics",
    description: "[비즈니스] 노출, 클릭, 광고비, 전환, 전환매출로 CTR, CPC, CVR, CPA, ROAS, ROI, CPM을 계산합니다. 캠페인 배열을 넣으면 ROAS 순위와 합계를 줍니다. 예: '노출 5만, 클릭 1200, 광고비 60만원, 전환 40건, 매출 180만원 성과 분석해줘'",
    inputSchema: obj({
      impressions: N("노출수"), clicks: N("클릭수"), cost: N("광고비(원)"), conversions: N("전환수"), revenue: N("전환 매출(원)"),
      campaigns: { type: "array", description: "여러 캠페인: [{name, impressions, clicks, cost, conversions, revenue}]", items: { type: "object" } },
    }),
    annotations: RO,
  },
  {
    name: "biz_market_concentration",
    description: "[비즈니스] 기업별 점유율(%) 또는 매출로 HHI(0~10000), CR3, CR4를 계산하고 공정위 기업결합 심사기준·시장지배적 사업자 추정 기준으로 해석합니다. merge로 두 기업 결합 시 HHI 증가분도 계산합니다. 예: 'A 40%, B 30%, C 20%, D 10% 시장 집중도는?'",
    inputSchema: obj({
      firms: { type: "array", description: "[{name, share(%)}] 또는 [{name, sales}]", items: obj({ name: { type: "string" }, share: N("점유율 %"), sales: N("매출") }, ["name"]) },
      marketTotal: N("선택. sales 입력 시 시장 전체 규모(나머지는 기타로 간주)"),
      merge: { type: "array", items: { type: "string" }, description: "선택. 결합을 가정할 두 기업 이름" },
    }, ["firms"]),
    annotations: RO,
  },
  {
    name: "biz_markup_margin",
    description: "[비즈니스] 원가, 판매가, 마진율(판매가 대비), 마크업률(원가 대비) 중 두 가지로 나머지를 계산합니다. 부가세 포함 판매가도 처리합니다. 예: '원가 6천원에 마진 40% 남기려면 얼마에 팔아야 해?'",
    inputSchema: obj({ cost: N("원가(원)"), price: N("판매가(원)"), marginPct: N("마진율 % = (판매가-원가)/판매가"), markupPct: N("마크업률 % = (판매가-원가)/원가"), priceIncludesVat: { type: "boolean", default: false, description: "입력·출력 판매가를 부가세 포함 소비자가로 볼지" } }),
    annotations: RO,
  },
  {
    name: "biz_inventory_eoq",
    description: "[비즈니스] 연간 수요, 1회 주문비, 단위당 연간 보관비로 경제적 주문량(EOQ), 연간 주문 횟수, 재주문점, 안전재고를 계산합니다. 예: '연 수요 12000개, 주문비 5만원, 보관비 개당 2천원, 리드타임 7일이면 얼마씩 주문해?'",
    inputSchema: obj({
      annualDemand: N("연간 수요량"), orderCost: N("1회 주문 비용(원)"), holdingCostPerUnit: N("단위당 연간 보관비(원)"), leadTimeDays: N("리드타임(일)"),
      dailyDemandStd: N("선택. 일 수요 표준편차"), serviceLevelPct: N("선택. 서비스 수준 % (기본 95)"), workingDays: N("선택. 연간 영업일 (기본 365)"),
    }, ["annualDemand", "orderCost", "holdingCostPerUnit"]),
    annotations: RO,
  },
  {
    name: "biz_survey_likert",
    description: "[비즈니스] 리커트 척도(기본 1~5점) 문항별 응답으로 평균, 긍정(Top-2-Box)·부정(Bottom-2-Box) 비율, 분포를 계산하고 평균 순으로 정렬합니다. 예: '만족도 설문 문항별 결과 정리해줘'",
    inputSchema: obj({
      questions: { type: "array", description: "[{question, responses: [1~5 점수 배열]}] 또는 [{question, counts: [1점 인원, 2점 인원, ...]}]", items: obj({ question: { type: "string" }, responses: { type: "array", items: N("점수") }, counts: { type: "array", items: N("인원") } }, ["question"]) },
      scale: { type: "integer", default: 5, description: "척도 최대값 (5 또는 7 등)" },
    }, ["questions"]),
    annotations: RO,
  },
  {
    name: "biz_revenue_bridge",
    description: "[비즈니스] 두 기간의 세그먼트별 매출로 총 변화와 세그먼트별 기여도를 계산하고, 가격·수량이 있으면 가격 효과와 물량 효과로 나눕니다. 예: '작년 대비 매출 증가를 제품별로 쪼개줘'",
    inputSchema: obj({
      periodA: { type: "array", description: "기준 기간 [{segment, revenue}] 또는 [{segment, price, quantity}]", items: { type: "object" } },
      periodB: { type: "array", description: "비교 기간 (같은 형식)", items: { type: "object" } },
    }, ["periodA", "periodB"]),
    annotations: RO,
  },
];

export const BIZ_TOOL_NAMES = new Set(BIZ_TOOLS.map((t) => t.name));

// ---------- 구현 ----------

function funnel(a) {
  const steps = arr(a.steps, "steps", 2).map((s, i) => ({ name: String(s?.name ?? `단계${i + 1}`), count: num(s?.count, `steps[${i}].count`, { min: 0 }) }));
  const first = steps[0].count;
  if (!first) throw new Error("첫 단계 count가 0이면 전환율을 계산할 수 없습니다.");
  let worst = null;
  const rows = steps.map((s, i) => {
    const row = { step: s.name, count: s.count, stepConversionPct: 100, cumulativeConversionPct: pct(s.count, first) };
    if (i) {
      const prev = steps[i - 1].count;
      row.stepConversionPct = pct(s.count, prev);
      row.dropOff = prev - s.count;
      row.dropOffPct = prev ? r1((1 - s.count / prev) * 100) : null;
      if (row.dropOffPct !== null && (!worst || row.dropOffPct > worst.dropOffPct)) worst = { from: steps[i - 1].name, to: s.name, dropOffPct: row.dropOffPct, dropOff: row.dropOff };
    }
    return row;
  });
  const overall = pct(steps[steps.length - 1].count, first);
  return {
    steps: rows,
    overallConversionPct: overall,
    biggestDropOff: worst,
    해석: `전체 전환율 ${overall}%. 가장 많이 새는 구간은 '${worst.from} → ${worst.to}'(이탈 ${worst.dropOffPct}%)이라 이 단계부터 개선 효과가 큽니다.`,
  };
}

function periodKey(t, period) {
  const d = new Date(t);
  if (period === "day") return t;
  if (period === "week") return t - ((d.getUTCDay() + 6) % 7) * DAY;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}
function periodDiff(a, b, period) {
  if (period === "month") {
    const A = new Date(a), B = new Date(b);
    return (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + B.getUTCMonth() - A.getUTCMonth();
  }
  return Math.round((b - a) / (period === "week" ? 7 * DAY : DAY));
}

function cohort(a) {
  const period = a.period || "week";
  if (!["day", "week", "month"].includes(period)) throw new Error("period는 day, week, month 중 하나여야 합니다.");
  const maxP = Math.min(Math.max(1, Math.floor(num(a.maxPeriods ?? 12, "maxPeriods"))), 60);
  let cohorts = [];
  if (Array.isArray(a.matrix) && a.matrix.length) {
    cohorts = a.matrix.map((c, i) => {
      const counts = arr(c?.counts, `matrix[${i}].counts`).map((v, j) => (v === null || v === undefined || v === "" ? null : num(v, `matrix[${i}].counts[${j}]`, { min: 0 })));
      return { cohort: String(c.cohort ?? `코호트${i + 1}`), size: counts[0], counts };
    });
  } else {
    const events = arr(a.events, "events (또는 matrix)");
    const users = new Map();
    let lastT = -Infinity;
    events.forEach((e, i) => {
      if (e?.userId === undefined || e?.userId === null) throw new Error(`events[${i}].userId가 없습니다.`);
      const t = parseDate(e.date, `events[${i}].date`);
      lastT = Math.max(lastT, t);
      const k = String(e.userId);
      if (!users.has(k)) users.set(k, []);
      users.get(k).push(t);
    });
    const lastKey = periodKey(lastT, period);
    const map = new Map();
    for (const ts of users.values()) {
      const signupKey = periodKey(Math.min(...ts), period);
      if (!map.has(signupKey)) map.set(signupKey, { size: 0, counts: [] });
      const c = map.get(signupKey);
      c.size++;
      const idx = new Set(ts.map((t) => periodDiff(signupKey, periodKey(t, period), period)));
      for (const k of idx) c.counts[k] = (c.counts[k] || 0) + 1;
    }
    cohorts = [...map.entries()].sort((x, y) => x[0] - y[0]).map(([key, c]) => {
      const observable = periodDiff(key, lastKey, period);
      const counts = [];
      for (let k = 0; k <= observable; k++) counts.push(c.counts[k] || 0);
      counts[0] = c.size;
      return { cohort: iso(key).slice(0, period === "month" ? 7 : 10), size: c.size, counts };
    });
  }
  const width = Math.min(maxP + 1, Math.max(...cohorts.map((c) => c.counts.length)));
  const table = cohorts.map((c) => ({
    cohort: c.cohort,
    size: c.size,
    retentionPct: Array.from({ length: width }, (_, k) => (c.counts[k] === null || c.counts[k] === undefined || !c.size ? null : r1((c.counts[k] / c.size) * 100))),
  }));
  const avg = Array.from({ length: width }, (_, k) => {
    let s = 0, n = 0;
    for (const c of cohorts) if (c.counts[k] !== null && c.counts[k] !== undefined && c.size) { s += c.counts[k]; n += c.size; }
    return n ? r1((s / n) * 100) : null;
  });
  const p1 = avg[1];
  return {
    period,
    cohorts: table,
    averageRetentionPct: avg,
    해석: p1 === null || p1 === undefined ? "기간이 1개뿐이라 리텐션 곡선을 그릴 수 없습니다." : `가입 다음 ${period === "day" ? "날" : period === "week" ? "주" : "달"} 평균 잔존율 ${p1}%, 마지막 관측 기간 ${avg.filter((x) => x !== null).at(-1)}%. 평균은 각 코호트 크기로 가중했고 아직 관측되지 않은 칸은 제외했습니다.`,
  };
}

function scoreOf(values, v, higherBetter) {
  let better = 0;
  for (const x of values) if (higherBetter ? x < v : x > v) better++;
  return Math.min(5, 1 + Math.floor((5 * better) / values.length));
}
function rfmSegment(R, F, M) {
  if (R >= 4 && F >= 4 && M >= 4) return "챔피언";
  if (R >= 3 && F >= 3) return "충성고객";
  if (R >= 4) return "신규·유망고객";
  if (R <= 2 && (F >= 3 || M >= 4)) return "이탈위험";
  if (R <= 2) return "휴면";
  return "관심필요";
}
function rfm(a) {
  const tx = arr(a.transactions, "transactions");
  const map = new Map();
  let maxT = -Infinity;
  tx.forEach((t, i) => {
    if (t?.customerId === undefined || t?.customerId === null) throw new Error(`transactions[${i}].customerId가 없습니다.`);
    const d = parseDate(t.date, `transactions[${i}].date`);
    const amt = num(t.amount, `transactions[${i}].amount`);
    maxT = Math.max(maxT, d);
    const k = String(t.customerId);
    const c = map.get(k) || { customerId: k, last: -Infinity, frequency: 0, monetary: 0 };
    c.last = Math.max(c.last, d); c.frequency++; c.monetary += amt;
    map.set(k, c);
  });
  const asOf = a.asOfDate ? parseDate(a.asOfDate, "asOfDate") : maxT;
  const cs = [...map.values()].map((c) => ({ ...c, recencyDays: Math.round((asOf - c.last) / DAY) }));
  const rv = cs.map((c) => c.recencyDays), fv = cs.map((c) => c.frequency), mv = cs.map((c) => c.monetary);
  for (const c of cs) {
    c.R = scoreOf(rv, c.recencyDays, false); c.F = scoreOf(fv, c.frequency, true); c.M = scoreOf(mv, c.monetary, true);
    c.segment = rfmSegment(c.R, c.F, c.M);
  }
  const order = ["챔피언", "충성고객", "신규·유망고객", "관심필요", "이탈위험", "휴면"];
  const segments = order.map((s) => {
    const g = cs.filter((c) => c.segment === s);
    const rev = g.reduce((x, c) => x + c.monetary, 0);
    return { segment: s, customers: g.length, sharePct: pct(g.length, cs.length), revenue: won(rev), revenueSharePct: pct(rev, mv.reduce((x, y) => x + y, 0)) };
  }).filter((s) => s.customers);
  const limit = Math.min(Math.max(1, Math.floor(num(a.limit ?? 20, "limit"))), 100);
  const top = [...cs].sort((x, y) => y.R + y.F + y.M - (x.R + x.F + x.M) || y.monetary - x.monetary).slice(0, limit)
    .map((c) => ({ customerId: c.customerId, lastPurchase: iso(c.last), recencyDays: c.recencyDays, frequency: c.frequency, monetary: won(c.monetary), R: c.R, F: c.F, M: c.M, segment: c.segment }));
  const risk = segments.find((s) => s.segment === "이탈위험");
  return {
    asOfDate: iso(asOf),
    customers: cs.length,
    segments,
    topCustomers: top,
    점수기준: "각 지표를 고객 간 상대 순위로 5분위(1~5점) 매김. R은 최근 구매일수록, F·M은 클수록 높은 점수.",
    해석: `고객 ${cs.length}명 중 ${segments.map((s) => `${s.segment} ${s.customers}명`).join(", ")}.${risk ? ` 이탈위험 고객 매출 비중이 ${risk.revenueSharePct}%라 재구매 유도 우선 대상입니다.` : ""}`,
  };
}

function pareto(a) {
  const items = arr(a.items, "items").map((x, i) => ({ name: String(x?.name ?? `항목${i + 1}`), value: num(x?.value, `items[${i}].value`, { min: 0 }) }));
  const total = items.reduce((s, x) => s + x.value, 0);
  if (!total) throw new Error("value 합계가 0입니다.");
  items.sort((x, y) => y.value - x.value);
  let cum = 0;
  const rows = items.map((x, i) => {
    const before = cum / total;
    cum += x.value;
    const cls = before < 0.8 ? "A" : before < 0.95 ? "B" : "C";
    return { rank: i + 1, name: x.name, value: x.value, sharePct: r2((x.value / total) * 100), cumulativePct: r2((cum / total) * 100), class: cls };
  });
  const k = Math.max(1, Math.ceil(items.length * 0.2));
  const top20 = items.slice(0, k).reduce((s, x) => s + x.value, 0);
  const summary = ["A", "B", "C"].map((c) => {
    const g = rows.filter((r) => r.class === c);
    return { class: c, items: g.length, valueSharePct: r1((g.reduce((s, r) => s + r.value, 0) / total) * 100) };
  });
  return {
    total, items: rows.slice(0, 200), classes: summary, top20PctItems: k, top20PctSharePct: r1((top20 / total) * 100),
    해석: `상위 20%(${k}개) 항목이 전체의 ${r1((top20 / total) * 100)}%를 차지합니다. A등급 ${summary[0].items}개에 재고·마케팅을 집중하세요.`,
  };
}

function ltvCac(a) {
  const arpu = num(a.arpu, "arpu", { min: 0 });
  const gm = num(a.grossMarginPct ?? 100, "grossMarginPct", { min: 0, max: 100 }) / 100;
  const churn = num(a.monthlyChurnPct, "monthlyChurnPct", { min: 0 }) / 100;
  if (!churn) throw new Error("monthlyChurnPct는 0보다 커야 합니다(0이면 LTV가 무한대).");
  const cac = num(a.cac, "cac", { min: 0 });
  const monthlyGp = arpu * gm;
  const ltv = monthlyGp / churn;
  const ratio = cac ? ltv / cac : null;
  const payback = monthlyGp ? cac / monthlyGp : null;
  const verdict = ratio === null ? "CAC가 0이라 비율을 계산할 수 없습니다." : ratio >= 3 ? "건강함(LTV/CAC 3 이상)" : ratio >= 1 ? "약함(1~3: 회수는 되지만 성장 여력이 작음)" : "손실(1 미만: 고객을 얻을수록 손해)";
  return {
    avgLifetimeMonths: r1(1 / churn), monthlyGrossProfitPerCustomer: won(monthlyGp), ltv: won(ltv), ltvToCac: r2(ratio), cacPaybackMonths: r1(payback), verdict,
    해석: `고객 1명이 평균 ${r1(1 / churn)}개월 머물며 이익 ${won(ltv).toLocaleString("ko-KR")}원을 남깁니다. LTV/CAC ${r2(ratio)} → ${verdict}. CAC 회수 ${r1(payback)}개월${payback !== null && payback > 12 ? "(12개월 초과라 현금흐름 부담)" : ""}.`,
  };
}

function breakEven(a) {
  const F = num(a.fixedCosts, "fixedCosts", { min: 0 });
  const p = num(a.unitPrice, "unitPrice", { min: 0 });
  const v = num(a.unitVariableCost, "unitVariableCost", { min: 0 });
  const cm = p - v;
  if (cm <= 0) throw new Error("단가가 단위당 변동비보다 커야 손익분기점이 존재합니다.");
  const bep = F / cm;
  const out = {
    contributionMarginPerUnit: won(cm), contributionMarginRatioPct: r1((cm / p) * 100),
    breakEvenUnitsExact: r2(bep), breakEvenUnits: Math.ceil(bep - 1e-9), breakEvenRevenue: won(bep * p),
  };
  const exp = num(a.expectedUnits, "expectedUnits", { optional: true, min: 0 });
  if (exp !== undefined) {
    out.expectedProfit = won(exp * cm - F);
    out.marginOfSafetyPct = exp ? r1(((exp - bep) / exp) * 100) : null;
  }
  out.해석 = `개당 ${won(cm).toLocaleString("ko-KR")}원이 남아 ${out.breakEvenUnits.toLocaleString("ko-KR")}개(매출 ${out.breakEvenRevenue.toLocaleString("ko-KR")}원)부터 이익입니다.` +
    (exp !== undefined ? ` 예상 ${exp}개면 이익 ${out.expectedProfit.toLocaleString("ko-KR")}원, 안전한계율 ${out.marginOfSafetyPct}%.` : "");
  return out;
}

function unitEcon(a) {
  const price = num(a.price, "price", { min: 0 });
  if (!price) throw new Error("price는 0보다 커야 합니다.");
  const vatIncluded = a.vatIncluded !== false;
  const net = vatIncluded ? price / 1.1 : price;
  const cogs = num(a.cogs, "cogs", { min: 0 });
  const ship = num(a.shippingCost ?? 0, "shippingCost", { min: 0 });
  const payFee = (price * num(a.paymentFeePct ?? 0, "paymentFeePct", { min: 0 })) / 100;
  const platFee = (price * num(a.platformFeePct ?? 0, "platformFeePct", { min: 0 })) / 100;
  const ad = num(a.adCostPerOrder ?? 0, "adCostPerOrder", { min: 0 });
  const other = num(a.otherCostPerOrder ?? 0, "otherCostPerOrder", { min: 0 });
  const cmBeforeAd = net - cogs - ship - payFee - platFee - other;
  const cm = cmBeforeAd - ad;
  return {
    netRevenue: won(net), vat: won(price - net),
    costs: { cogs: won(cogs), shipping: won(ship), paymentFee: won(payFee), platformFee: won(platFee), ad: won(ad), other: won(other) },
    contributionMarginBeforeAd: won(cmBeforeAd), contributionMargin: won(cm), contributionMarginPct: r1((cm / net) * 100),
    maxAdCostPerOrderToBreakEven: won(cmBeforeAd),
    가정: `수수료는 결제 금액(판매가) 기준, 원가·배송비는 부가세 제외 금액으로 봤습니다.${vatIncluded ? " 판매가에서 부가세 1/11을 뺐습니다." : ""}`,
    해석: cm >= 0 ? `주문 1건에 ${won(cm).toLocaleString("ko-KR")}원(${r1((cm / net) * 100)}%)이 남습니다. 주문당 광고비가 ${won(cmBeforeAd).toLocaleString("ko-KR")}원을 넘으면 적자입니다.` : `주문 1건마다 ${won(-cm).toLocaleString("ko-KR")}원 적자입니다. 광고비 없이도 ${won(cmBeforeAd).toLocaleString("ko-KR")}원만 남습니다.`,
  };
}

function elasticity(a) {
  const pts = arr(a.points, "points", 2).map((p, i) => ({ price: num(p?.price, `points[${i}].price`, { min: 0 }), quantity: num(p?.quantity, `points[${i}].quantity`, { min: 0 }) }));
  if (new Set(pts.map((p) => p.price)).size < 2) throw new Error("서로 다른 가격이 2개 이상 필요합니다.");
  let e, method, r2v = null;
  if (pts.length === 2) {
    const [x, y] = pts;
    e = ((y.quantity - x.quantity) / ((x.quantity + y.quantity) / 2)) / ((y.price - x.price) / ((x.price + y.price) / 2));
    method = "arc(중점) 탄력성";
  } else {
    const ok = pts.filter((p) => p.price > 0 && p.quantity > 0);
    if (ok.length < 2) throw new Error("로그 회귀에는 가격·판매량이 0보다 큰 점이 2개 이상 필요합니다.");
    const xs = ok.map((p) => Math.log(p.price)), ys = ok.map((p) => Math.log(p.quantity));
    const mx = xs.reduce((s, x) => s + x, 0) / xs.length, my = ys.reduce((s, y) => s + y, 0) / ys.length;
    let sxy = 0, sxx = 0, syy = 0;
    xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; syy += (ys[i] - my) ** 2; });
    e = sxy / sxx; r2v = syy ? (sxy * sxy) / (sxx * syy) : 1;
    method = "로그-로그 회귀 (ln 판매량 = a + e·ln 가격)";
  }
  // 선형 수요 q = a + b p 로 매출 최대 가격
  const mp = pts.reduce((s, p) => s + p.price, 0) / pts.length, mq = pts.reduce((s, p) => s + p.quantity, 0) / pts.length;
  let sb = 0, sp = 0;
  pts.forEach((p) => { sb += (p.price - mp) * (p.quantity - mq); sp += (p.price - mp) ** 2; });
  const b = sb / sp, a0 = mq - b * mp;
  const revMaxPrice = b < 0 ? -a0 / (2 * b) : null;
  const observed = pts.map((p) => ({ ...p, revenue: won(p.price * p.quantity) })).sort((x, y) => y.revenue - x.revenue);
  const abs = Math.abs(e);
  const type = e > 0 ? "양(+)의 탄력성(가격이 오를 때 판매도 늘어남, 다른 요인 의심)" : abs > 1 ? "탄력적(|e|>1): 가격을 내리면 매출이 늘어나는 구간" : abs < 1 ? "비탄력적(|e|<1): 가격을 올리면 매출이 늘어나는 구간" : "단위 탄력적";
  const lo = Math.min(...pts.map((p) => p.price)), hi = Math.max(...pts.map((p) => p.price));
  return {
    method, elasticity: r2(e), rSquared: r2v === null ? null : r2(r2v), interpretation: type,
    linearDemand: { intercept: r2(a0), slope: r4(b) },
    revenueMaximizingPriceLinear: revMaxPrice === null ? null : won(revMaxPrice),
    revenueMaxPriceInObservedRange: revMaxPrice === null ? null : revMaxPrice >= lo && revMaxPrice <= hi,
    bestObservedPoint: observed[0],
    해석: `가격이 1% 오르면 판매량이 약 ${r2(Math.abs(e))}% ${e <= 0 ? "줄어듭니다" : "늘어납니다"}. ${type}.${revMaxPrice !== null ? ` 직선 수요로 보면 매출 최대 가격은 약 ${won(revMaxPrice).toLocaleString("ko-KR")}원${revMaxPrice < lo || revMaxPrice > hi ? "(관측 범위 밖이라 참고만)" : ""}.` : ""} 시기·프로모션 차이가 섞이면 탄력성이 왜곡됩니다.`,
  };
}

function nps(a) {
  let P, Pa, D;
  if (Array.isArray(a.scores) && a.scores.length) {
    const s = a.scores.map((x, i) => num(x, `scores[${i}]`, { min: 0, max: 10 }));
    P = s.filter((x) => x >= 9).length; Pa = s.filter((x) => x >= 7 && x < 9).length; D = s.filter((x) => x < 7).length;
  } else if (a.counts) {
    P = num(a.counts.promoters ?? 0, "promoters", { min: 0 }); Pa = num(a.counts.passives ?? 0, "passives", { min: 0 }); D = num(a.counts.detractors ?? 0, "detractors", { min: 0 });
  } else throw new Error("scores 배열이나 counts를 넣어 주세요.");
  const n = P + Pa + D;
  if (!n) throw new Error("응답이 0건입니다.");
  const pp = P / n, pd = D / n;
  const score = (pp - pd) * 100;
  const moe = 1.96 * Math.sqrt((pp + pd - (pp - pd) ** 2) / n) * 100;
  return {
    responses: n, promoters: P, passives: Pa, detractors: D,
    promoterPct: r1(pp * 100), passivePct: r1((Pa / n) * 100), detractorPct: r1(pd * 100),
    nps: r1(score), marginOfError95: r1(moe),
    해석: `NPS ${r1(score)} (95% 신뢰구간 ±${r1(moe)}). ${score >= 50 ? "매우 높음" : score >= 30 ? "좋음" : score >= 0 ? "보통" : "비추천이 더 많음"}. 응답 ${n}건${n < 100 ? "이라 오차가 큽니다" : ""}.`,
  };
}

function saas(a) {
  const months = arr(a.months, "months").map((m, i) => {
    const g = (k) => num(m?.[k] ?? 0, `months[${i}].${k}`, { min: 0 });
    const start = num(m?.startMrr, `months[${i}].startMrr`, { min: 0 });
    const nw = g("newMrr"), ex = g("expansionMrr"), co = g("contractionMrr"), ch = g("churnedMrr");
    const end = start + nw + ex - co - ch;
    return {
      month: String(m?.month ?? `M${i + 1}`), startMrr: won(start), endMrr: won(end), netNewMrr: won(end - start),
      growthPct: pct(end - start, start), nrrPct: pct(start + ex - co - ch, start), grrPct: pct(start - co - ch, start),
      mrrChurnPct: pct(co + ch, start), quickRatio: co + ch ? r2((nw + ex) / (co + ch)) : null,
      _nw: nw, _ex: ex, _co: co, _ch: ch, _s: start,
    };
  });
  const S = months.reduce((s, m) => s + m._s, 0);
  const sum = (k) => months.reduce((s, m) => s + m[k], 0);
  const agg = {
    avgNrrPct: S ? r1(((S + sum("_ex") - sum("_co") - sum("_ch")) / S) * 100) : null,
    avgGrrPct: S ? r1(((S - sum("_co") - sum("_ch")) / S) * 100) : null,
    avgMrrChurnPct: S ? r1(((sum("_co") + sum("_ch")) / S) * 100) : null,
    quickRatio: sum("_co") + sum("_ch") ? r2((sum("_nw") + sum("_ex")) / (sum("_co") + sum("_ch"))) : null,
    endingMrr: months.at(-1).endMrr,
  };
  months.forEach((m) => { delete m._nw; delete m._ex; delete m._co; delete m._ch; delete m._s; });
  return {
    months, summary: agg,
    해석: `기간 평균 NRR ${agg.avgNrrPct}%, GRR ${agg.avgGrrPct}%, 퀵 레이쇼 ${agg.quickRatio ?? "계산 불가(손실 0)"}. 퀵 레이쇼 4 이상이면 건강한 성장, 1 미만이면 MRR이 줄고 있습니다. 평균은 기초 MRR로 가중했습니다.`,
  };
}

function adRow(c, label) {
  const g = (k) => num(c?.[k], `${label}.${k}`, { optional: true, min: 0 });
  const imp = g("impressions"), clk = g("clicks"), cost = g("cost"), conv = g("conversions"), rev = g("revenue");
  const div = (x, y, m = 1) => (x !== undefined && y ? (x / y) * m : null);
  return {
    name: String(c?.name ?? label), impressions: imp ?? null, clicks: clk ?? null, cost: cost ?? null, conversions: conv ?? null, revenue: rev ?? null,
    ctrPct: r2(div(clk, imp, 100)), cpc: won(div(cost, clk)), cvrPct: r2(div(conv, clk, 100)), cpa: won(div(cost, conv)),
    roasPct: r1(div(rev, cost, 100)), roiPct: rev !== undefined && cost ? r1(((rev - cost) / cost) * 100) : null, cpm: won(div(cost, imp, 1000)),
  };
}
function adMetrics(a) {
  if (Array.isArray(a.campaigns) && a.campaigns.length) {
    const rows = a.campaigns.map((c, i) => adRow(c, `campaigns[${i}]`));
    const tot = {};
    for (const k of ["impressions", "clicks", "cost", "conversions", "revenue"]) {
      const vals = rows.map((r) => r[k]).filter((v) => v !== null);
      if (vals.length) tot[k] = vals.reduce((s, v) => s + v, 0);
    }
    const total = adRow({ ...tot, name: "합계" }, "합계");
    const ranked = [...rows].sort((x, y) => (y.roasPct ?? -1) - (x.roasPct ?? -1)).map((r, i) => ({ rank: i + 1, ...r }));
    const best = ranked[0], worst = ranked.at(-1);
    return { campaigns: ranked, total, 해석: `전체 ROAS ${total.roasPct ?? "-"}%. ROAS 1위 '${best.name}'(${best.roasPct ?? "-"}%), 최하위 '${worst.name}'(${worst.roasPct ?? "-"}%). ROAS 100% 미만이면 광고비보다 매출이 적습니다(원가 제외 전).` };
  }
  const row = adRow(a, "입력");
  if (row.cost === null && row.clicks === null) throw new Error("광고비(cost)와 클릭(clicks) 등 지표를 넣거나 campaigns 배열을 넣어 주세요.");
  return { ...row, 해석: `CTR ${row.ctrPct ?? "-"}%, CVR ${row.cvrPct ?? "-"}%, CPA ${row.cpa?.toLocaleString("ko-KR") ?? "-"}원, ROAS ${row.roasPct ?? "-"}%. ROAS는 매출/광고비라 원가를 빼기 전 수치입니다.` };
}

function concentration(a) {
  const firms = arr(a.firms, "firms");
  let rows;
  if (firms.some((f) => f?.sales !== undefined && f?.sales !== null && f?.sales !== "")) {
    const sales = firms.map((f, i) => ({ name: String(f?.name ?? `기업${i + 1}`), v: num(f?.sales, `firms[${i}].sales`, { min: 0 }) }));
    const sum = sales.reduce((s, x) => s + x.v, 0);
    const total = a.marketTotal !== undefined ? num(a.marketTotal, "marketTotal", { min: 0 }) : sum;
    if (!total || total < sum) throw new Error("marketTotal은 기업 매출 합계 이상이어야 합니다.");
    rows = sales.map((x) => ({ name: x.name, share: (x.v / total) * 100 }));
  } else {
    rows = firms.map((f, i) => ({ name: String(f?.name ?? `기업${i + 1}`), share: num(f?.share, `firms[${i}].share`, { min: 0 }) }));
    const sum = rows.reduce((s, x) => s + x.share, 0);
    if (sum <= 1.0001 && rows.every((x) => x.share <= 1)) rows.forEach((x) => (x.share *= 100));
  }
  const sumShare = rows.reduce((s, x) => s + x.share, 0);
  if (sumShare > 100.5) throw new Error(`점유율 합계가 100%를 넘습니다(${r1(sumShare)}%).`);
  rows.sort((x, y) => y.share - x.share);
  const hhi = rows.reduce((s, x) => s + x.share ** 2, 0);
  const cr = (k) => r1(rows.slice(0, k).reduce((s, x) => s + x.share, 0));
  const level = hhi < 1200 ? "저집중(HHI 1200 미만)" : hhi < 2500 ? "중집중(1200~2500)" : "고집중(2500 이상)";
  const top3big = rows.slice(0, 3).filter((x) => x.share >= 10);
  const dominant = rows[0]?.share >= 50 || top3big.reduce((s, x) => s + x.share, 0) >= 75;
  const out = {
    firms: rows.map((x) => ({ name: x.name, sharePct: r2(x.share) })), coveredSharePct: r1(sumShare),
    hhi: Math.round(hhi), cr3Pct: cr(3), cr4Pct: cr(4), concentration: level,
    marketDominancePresumed: dominant,
    기준: "공정위 기업결합 심사기준: 결합 후 HHI 1200 미만, 1200~2500이면서 증가분 250 미만, 2500 이상이면서 증가분 150 미만이면 경쟁제한성이 없는 것으로 추정(안전지대). 공정거래법 시장지배적 사업자 추정: 1개사 50% 이상 또는 상위 3개사 합계 75% 이상(10% 미만 사업자 제외, 연 매출 40억원 미만 제외).",
  };
  if (sumShare < 99.5) out.주의 = `입력 점유율 합계가 ${r1(sumShare)}%라 나머지를 모르는 상태입니다. HHI는 하한값입니다.`;
  if (Array.isArray(a.merge) && a.merge.length === 2) {
    const [x, y] = a.merge.map((n) => rows.find((r) => r.name === String(n)));
    if (!x || !y) throw new Error("merge의 기업 이름이 firms에 없습니다.");
    const delta = 2 * x.share * y.share, post = hhi + delta;
    const safe = post < 1200 || (post < 2500 && delta < 250) || (post >= 2500 && delta < 150);
    out.merger = { firms: [x.name, y.name], deltaHhi: Math.round(delta), postHhi: Math.round(post), safeHarbor: safe };
  }
  out.해석 = `HHI ${Math.round(hhi)} → ${level}. 상위 3사 합계 ${cr(3)}%.${dominant ? " 시장지배적 사업자 추정 요건(점유율 기준)에 해당합니다." : ""}${out.merger ? ` ${out.merger.firms.join("+")} 결합 시 HHI ${out.merger.deltaHhi} 증가 → ${out.merger.safeHarbor ? "안전지대" : "안전지대 밖(정밀 심사 대상)"}.` : ""}`;
  return out;
}

function markup(a) {
  const vatIn = a.priceIncludesVat === true;
  let cost = num(a.cost, "cost", { optional: true, min: 0 });
  let price = num(a.price, "price", { optional: true, min: 0 });
  const m = num(a.marginPct, "marginPct", { optional: true, max: 99.9999 });
  const k = num(a.markupPct, "markupPct", { optional: true, min: -99.9999 });
  if (price !== undefined && vatIn) price = price / 1.1;
  const given = [cost, price, m, k].filter((x) => x !== undefined).length;
  if (given < 2) throw new Error("cost, price, marginPct, markupPct 중 두 가지를 넣어 주세요.");
  if (cost === undefined && price === undefined) throw new Error("마진율과 마크업률만으로는 금액을 알 수 없습니다. 원가나 판매가를 함께 넣어 주세요.");
  if (cost !== undefined && price === undefined) price = m !== undefined ? cost / (1 - m / 100) : cost * (1 + k / 100);
  else if (price !== undefined && cost === undefined) cost = m !== undefined ? price * (1 - m / 100) : price / (1 + k / 100);
  if (!price) throw new Error("판매가가 0이면 마진율을 계산할 수 없습니다.");
  const profit = price - cost;
  const marginPct = (profit / price) * 100;
  const markupPct = cost ? (profit / cost) * 100 : null;
  return {
    cost: won(cost), supplyPrice: won(price), consumerPriceWithVat: won(price * 1.1), profitPerUnit: won(profit),
    marginPct: r2(marginPct), markupPct: r2(markupPct),
    해석: `원가 ${won(cost).toLocaleString("ko-KR")}원, 판매가(부가세 제외) ${won(price).toLocaleString("ko-KR")}원(소비자가 ${won(price * 1.1).toLocaleString("ko-KR")}원). 마진율 ${r1(marginPct)}%, 마크업 ${r1(markupPct)}%. 마진율과 마크업률은 분모가 달라 같은 이익도 숫자가 다릅니다.`,
  };
}

function eoq(a) {
  const D = num(a.annualDemand, "annualDemand", { min: 0 });
  const S = num(a.orderCost, "orderCost", { min: 0 });
  const H = num(a.holdingCostPerUnit, "holdingCostPerUnit", { min: 0 });
  if (!D || !H) throw new Error("annualDemand와 holdingCostPerUnit은 0보다 커야 합니다.");
  const days = num(a.workingDays ?? 365, "workingDays", { min: 1 });
  const Q = Math.sqrt((2 * D * S) / H);
  const orders = D / Q;
  const daily = D / days;
  const L = num(a.leadTimeDays ?? 0, "leadTimeDays", { min: 0 });
  const sd = num(a.dailyDemandStd, "dailyDemandStd", { optional: true, min: 0 });
  let sl = num(a.serviceLevelPct ?? 95, "serviceLevelPct", { min: 0 });
  if (sl > 1) sl /= 100;
  if (sl <= 0 || sl >= 1) throw new Error("serviceLevelPct는 0~100 사이(끝값 제외)여야 합니다.");
  const z = normInv(sl);
  const ss = sd !== undefined ? z * sd * Math.sqrt(L) : 0;
  const rop = daily * L + ss;
  const cost = (D / Q) * S + (Q / 2) * H;
  return {
    eoq: r1(Q), eoqRounded: Math.ceil(Q), ordersPerYear: r1(orders), daysBetweenOrders: r1(days / orders),
    dailyDemand: r2(daily), zScore: sd !== undefined ? r2(z) : null, safetyStock: Math.ceil(ss), reorderPoint: Math.ceil(rop),
    annualOrderingAndHoldingCost: won(cost),
    해석: `한 번에 약 ${Math.ceil(Q)}개씩, 연 ${r1(orders)}회(${r1(days / orders)}일마다) 주문하면 주문비+보관비가 최소(연 ${won(cost).toLocaleString("ko-KR")}원)입니다. 재고가 ${Math.ceil(rop)}개로 떨어지면 재주문하세요${sd !== undefined ? `(안전재고 ${Math.ceil(ss)}개, 서비스 수준 ${r1(sl * 100)}%)` : ""}.`,
  };
}

function likert(a) {
  const scale = Math.floor(num(a.scale ?? 5, "scale", { min: 3, max: 11 }));
  const qs = arr(a.questions, "questions").map((q, i) => {
    let dist = Array(scale).fill(0), invalid = 0;
    if (Array.isArray(q?.counts) && q.counts.length) {
      if (q.counts.length !== scale) throw new Error(`questions[${i}].counts 길이는 척도(${scale})와 같아야 합니다.`);
      dist = q.counts.map((c, j) => num(c, `questions[${i}].counts[${j}]`, { min: 0 }));
    } else {
      arr(q?.responses, `questions[${i}].responses`).forEach((v) => {
        const n = Number(String(v).replace(/,/g, ""));
        if (Number.isInteger(n) && n >= 1 && n <= scale) dist[n - 1]++; else invalid++;
      });
    }
    const n = dist.reduce((s, x) => s + x, 0);
    if (!n) throw new Error(`questions[${i}]에 유효한 응답이 없습니다.`);
    const mean = dist.reduce((s, x, j) => s + x * (j + 1), 0) / n;
    return {
      question: String(q?.question ?? `문항${i + 1}`), n, mean: r2(mean),
      top2BoxPct: r1(((dist[scale - 1] + dist[scale - 2]) / n) * 100), bottom2BoxPct: r1(((dist[0] + dist[1]) / n) * 100),
      distribution: Object.fromEntries(dist.map((x, j) => [String(j + 1), x])), invalidResponses: invalid,
    };
  });
  const ranked = [...qs].sort((x, y) => y.mean - x.mean).map((q, i) => ({ rank: i + 1, ...q }));
  return {
    scale, questions: ranked,
    해석: `가장 높은 문항 '${ranked[0].question}'(평균 ${ranked[0].mean}, 긍정 ${ranked[0].top2BoxPct}%), 가장 낮은 문항 '${ranked.at(-1).question}'(평균 ${ranked.at(-1).mean}, 부정 ${ranked.at(-1).bottom2BoxPct}%). 평균보다 긍정·부정 비율이 해석에 더 안전합니다.`,
  };
}

function bridge(a) {
  const read = (list, label) => {
    const m = new Map();
    arr(list, label).forEach((x, i) => {
      const seg = String(x?.segment ?? x?.name ?? `세그먼트${i + 1}`);
      const p = num(x?.price, `${label}[${i}].price`, { optional: true });
      const q = num(x?.quantity, `${label}[${i}].quantity`, { optional: true });
      let rev = num(x?.revenue, `${label}[${i}].revenue`, { optional: true });
      if (rev === undefined) {
        if (p === undefined || q === undefined) throw new Error(`${label}[${i}]에 revenue 또는 price·quantity가 필요합니다.`);
        rev = p * q;
      }
      m.set(seg, { rev, p, q });
    });
    return m;
  };
  const A = read(a.periodA, "periodA"), B = read(a.periodB, "periodB");
  const segs = [...new Set([...A.keys(), ...B.keys()])];
  const totA = [...A.values()].reduce((s, x) => s + x.rev, 0), totB = [...B.values()].reduce((s, x) => s + x.rev, 0);
  const change = totB - totA;
  let priceTot = 0, volTot = 0, mixOther = 0;
  const rows = segs.map((s) => {
    const x = A.get(s), y = B.get(s);
    const ra = x?.rev ?? 0, rb = y?.rev ?? 0, d = rb - ra;
    const row = { segment: s, revenueA: won(ra), revenueB: won(rb), change: won(d), changePct: ra ? r1((d / ra) * 100) : null, contributionToChangePct: change ? r1((d / change) * 100) : null, status: !x ? "신규" : !y ? "중단" : "유지" };
    if (x && y && x.p !== undefined && x.q !== undefined && y.p !== undefined && y.q !== undefined) {
      row.volumeEffect = won((y.q - x.q) * x.p);
      row.priceEffect = won((y.p - x.p) * y.q);
      volTot += (y.q - x.q) * x.p; priceTot += (y.p - x.p) * y.q;
    } else mixOther += d;
    return row;
  }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change));
  const out = { totalA: won(totA), totalB: won(totB), totalChange: won(change), totalChangePct: totA ? r1((change / totA) * 100) : null, segments: rows };
  if (priceTot || volTot) { out.priceEffectTotal = won(priceTot); out.volumeEffectTotal = won(volTot); out.unexplainedOrNewLost = won(mixOther); }
  const top = rows[0];
  out.해석 = `매출이 ${won(change).toLocaleString("ko-KR")}원(${out.totalChangePct ?? "-"}%) ${change >= 0 ? "늘었고" : "줄었고"}, 가장 큰 변화는 '${top.segment}'(${top.change.toLocaleString("ko-KR")}원, 변화의 ${top.contributionToChangePct ?? "-"}%)입니다.` +
    (priceTot || volTot ? ` 가격 효과 ${won(priceTot).toLocaleString("ko-KR")}원, 물량 효과 ${won(volTot).toLocaleString("ko-KR")}원(물량은 기준 가격, 가격은 비교 기간 수량으로 계산).` : "");
  return out;
}

const IMPL = {
  biz_funnel_conversion: funnel, biz_cohort_retention: cohort, biz_rfm_segment: rfm, biz_pareto_abc: pareto,
  biz_ltv_cac: ltvCac, biz_break_even: breakEven, biz_unit_economics: unitEcon, biz_price_elasticity: elasticity,
  biz_nps: nps, biz_saas_metrics: saas, biz_ad_metrics: adMetrics, biz_market_concentration: concentration,
  biz_markup_margin: markup, biz_inventory_eoq: eoq, biz_survey_likert: likert, biz_revenue_bridge: bridge,
};

export async function callBizTool(name, args = {}, env = {}) {
  const fn = IMPL[name];
  if (!fn) throw new Error(`알 수 없는 비즈니스 도구: ${name}`);
  return fn(args || {});
}
