// 통계 계산 도구 (stats_*). 외부 API 없이 순수 JS로 계산한다. Cloudflare Workers에서 동작.

const RO = { readOnlyHint: true, openWorldHint: false };
const NUM_ARR = (d) => ({ type: "array", items: { type: ["number", "string"] }, description: d });

// ---------- 공통 수학 ----------
export function r4(x) {
  return typeof x === "number" && Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x ?? null;
}
function rp(p) {
  if (typeof p !== "number" || !Number.isFinite(p)) return null;
  return Number(p.toPrecision(4));
}

export function lgamma(z) {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  z -= 1;
  let x = c[0];
  for (let i = 1; i < 9; i++) x += c[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function betacf(a, b, x) {
  const FPMIN = 1e-300;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 500; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-15) break;
  }
  return h;
}
// 정규화 불완전 베타 I_x(a, b)
export function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(a, b, x)) / a;
  return 1 - (bt * betacf(b, a, 1 - x)) / b;
}
// 정규화 하측 감마 P(a, x)
export function gammaP(a, x) {
  if (x <= 0) return 0;
  const lg = -x + a * Math.log(x) - lgamma(a);
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 1000; n++) {
      ap++; del *= x / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(lg);
  }
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  return 1 - Math.exp(lg) * h;
}
export function normCdf(z) {
  const p = 0.5 * gammaP(0.5, (z * z) / 2);
  return z >= 0 ? 0.5 + p : 0.5 - p;
}
export function normInv(p) {
  if (!(p > 0 && p < 1)) throw new Error("확률은 0과 1 사이여야 합니다.");
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x, q, r;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    q = p - 0.5; r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = normCdf(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}
export function tTwoSided(t, df) {
  return ibeta(df / (df + t * t), df / 2, 0.5);
}
function tCdf(t, df) {
  const half = 0.5 * ibeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - half : half;
}
function tInv(p, df) {
  let lo = -1e4, hi = 1e4;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const fUpper = (f, d1, d2) => (f <= 0 ? 1 : ibeta(d2 / (d2 + d1 * f), d2 / 2, d1 / 2));
const chi2Upper = (x, k) => (x <= 0 ? 1 : 1 - gammaP(k / 2, x / 2));

// ---------- 입력 처리 ----------
export function toNum(v) {
  if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
  if (typeof v !== "string") return NaN;
  const s = v.trim().replace(/[,\s₩$]/g, "").replace(/(원|%)$/, "");
  if (s === "" || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}
function splitNumString(s) {
  s = s.trim();
  if (/\s/.test(s)) return s.split(/[\s;]+/).map((t) => t.replace(/,$/, "")).filter(Boolean);
  return s.split(/[,;]/);
}
// 숫자 배열 파싱. 빈칸·null은 건너뛰고(skipMissing) 숫자가 아닌 글자는 오류.
export function nums(arr, name = "values", { min = 1, skipMissing = true } = {}) {
  if (typeof arr === "string") arr = splitNumString(arr);
  if (!Array.isArray(arr)) throw new Error(`${name}에 숫자 배열을 넣어 주세요.`);
  const out = [];
  arr.forEach((v, i) => {
    if (v === null || v === undefined || (typeof v === "string" && v.trim() === "")) {
      if (skipMissing) return;
      throw new Error(`${name}[${i}]이 비어 있습니다.`);
    }
    const n = toNum(v);
    if (Number.isNaN(n)) throw new Error(`${name}[${i}] 값 '${v}'은 숫자가 아닙니다.`);
    out.push(n);
  });
  if (out.length < min) throw new Error(`${name}에 숫자가 최소 ${min}개 필요합니다 (현재 ${out.length}개).`);
  return out;
}
function confLevel(c, def = 0.95) {
  let v = c === undefined || c === null ? def : toNum(c);
  if (v > 1) v = v / 100;
  if (!(v > 0 && v < 1)) throw new Error("신뢰수준(confidence)은 0~1 사이(예: 0.95) 또는 퍼센트(95)로 넣어 주세요.");
  return v;
}
function rate01(v, name) {
  let x = toNum(v);
  if (Number.isNaN(x)) throw new Error(`${name}에 비율을 넣어 주세요.`);
  if (x > 1) x = x / 100;
  if (!(x > 0 && x < 1)) throw new Error(`${name}는 0~1 사이 비율(또는 0~100 퍼센트)이어야 합니다.`);
  return x;
}

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function variance(a) {
  if (a.length < 2) return NaN;
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1);
}
export function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
export const median = (a) => quantile([...a].sort((x, y) => x - y), 0.5);
function pearson(x, y) {
  const mx = mean(x), my = mean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) {
    sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
function invert(M) {
  const n = M.length;
  const A = M.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
    if (Math.abs(A[piv][col]) < 1e-12) throw new Error("설명변수끼리 완전히 겹쳐(다중공선성) 회귀계수를 계산할 수 없습니다.");
    [A[col], A[piv]] = [A[piv], A[col]];
    const p = A[col][col];
    for (let j = 0; j < 2 * n; j++) A[col][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[col][j];
    }
  }
  return A.map((row) => row.slice(n));
}
function parseDate(s) {
  const str = String(s).trim();
  let m = str.match(/^(\d{4})[-./년\s]+(\d{1,2})[-./월\s]+(\d{1,2})/);
  if (!m) m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null;
}

// ---------- 도구 정의 ----------
export const STATS_TOOLS = [
  {
    name: "stats_describe",
    description: "[통계] 숫자 목록의 기술통계(개수, 평균, 중앙값, 표준편차, 최소·최대, 사분위수, IQR, 왜도, 변동계수)를 계산합니다. 예: '월 매출 [120,135,98,...] 요약해줘'",
    inputSchema: { type: "object", properties: { values: NUM_ARR("숫자 목록 (쉼표 포함 문자열 '1,234'도 가능)") }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "stats_percentile",
    description: "[통계] 숫자 목록에서 원하는 백분위수(예: 10, 50, 90, 99)를 계산합니다. 예: '응답시간 상위 1%(P99) 알려줘'",
    inputSchema: { type: "object", properties: { values: NUM_ARR("숫자 목록"), percentiles: { type: "array", items: { type: "number" }, description: "0~100 사이 백분위 목록 (기본 [25,50,75,90,95,99])" } }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "stats_histogram",
    description: "[통계] 숫자 목록을 구간별 도수분포(히스토그램)로 나눕니다. 구간 수(bins) 또는 구간 폭(width)을 지정할 수 있습니다. 예: '고객 나이 분포를 10살 단위로 나눠줘'",
    inputSchema: { type: "object", properties: { values: NUM_ARR("숫자 목록"), bins: { type: "integer", minimum: 1, maximum: 100, description: "구간 수 (기본: 스터지스 공식)" }, width: { type: "number", description: "구간 폭 (지정하면 bins 무시)" } }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "stats_zscore_outliers",
    description: "[통계] Z점수(평균에서 표준편차 몇 배)와 IQR(사분위 범위) 두 방법으로 이상치를 찾아 위치와 값을 알려줍니다. 예: '일별 주문 수에서 튀는 날 찾아줘'",
    inputSchema: { type: "object", properties: { values: NUM_ARR("숫자 목록"), zThreshold: { type: "number", description: "Z점수 기준 (기본 3)" }, iqrK: { type: "number", description: "IQR 배수 (기본 1.5)" } }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "stats_ttest",
    description: "[통계] 두 집단 평균 차이를 웰치 t-검정(분산이 달라도 되는 방식)으로 검정합니다. t값, 자유도, 양측 p값, 차이의 신뢰구간, 효과크기(Cohen's d)를 줍니다. 예: 'A매장과 B매장 객단가 차이가 유의해?'",
    inputSchema: { type: "object", properties: { a: NUM_ARR("A 집단 값"), b: NUM_ARR("B 집단 값"), confidence: { type: "number", description: "신뢰수준 (기본 0.95)" } }, required: ["a", "b"] },
    annotations: RO,
  },
  {
    name: "stats_paired_ttest",
    description: "[통계] 같은 대상의 전·후 값을 짝지어 비교하는 대응표본 t-검정입니다. 예: '교육 전후 시험 점수가 올랐는지 검정해줘'",
    inputSchema: { type: "object", properties: { before: NUM_ARR("전 값"), after: NUM_ARR("후 값 (before와 같은 순서·길이)"), confidence: { type: "number", description: "신뢰수준 (기본 0.95)" } }, required: ["before", "after"] },
    annotations: RO,
  },
  {
    name: "stats_ab_test_proportions",
    description: "[통계] A/B 테스트 전환율 차이를 두 비율 z-검정으로 판정합니다. 전환율, 절대·상대 개선폭, 차이의 신뢰구간, p값, 유의 여부를 줍니다. 예: 'A안 2000명 중 200명, B안 2000명 중 250명 구매했는데 B가 이긴 거야?'",
    inputSchema: {
      type: "object",
      properties: {
        conversionsA: { type: ["number", "string"], description: "A 전환 수" }, visitorsA: { type: ["number", "string"], description: "A 노출(방문) 수" },
        conversionsB: { type: ["number", "string"], description: "B 전환 수" }, visitorsB: { type: ["number", "string"], description: "B 노출(방문) 수" },
        alpha: { type: "number", description: "유의수준 (기본 0.05)" },
      },
      required: ["conversionsA", "visitorsA", "conversionsB", "visitorsB"],
    },
    annotations: RO,
  },
  {
    name: "stats_sample_size",
    description: "[통계] A/B 테스트에 그룹당 몇 명이 필요한지 계산합니다(두 비율 비교). 기준 전환율, 최소 감지 효과(절대 또는 상대), 유의수준, 검정력을 넣습니다. 예: '전환율 10%에서 2%p 올랐는지 보려면 몇 명 필요해?'",
    inputSchema: {
      type: "object",
      properties: {
        baselineRate: { type: "number", description: "기준 전환율 (0.1 또는 10)" },
        mde: { type: "number", description: "최소 감지 효과. absolute면 비율 차이(0.02 또는 2), relative면 상대 % (20 = 20%)" },
        mdeType: { type: "string", enum: ["absolute", "relative"], description: "mde 해석 방식 (기본 absolute)" },
        alpha: { type: "number", description: "유의수준 (기본 0.05, 양측)" },
        power: { type: "number", description: "검정력 (기본 0.8)" },
      },
      required: ["baselineRate", "mde"],
    },
    annotations: RO,
  },
  {
    name: "stats_confidence_interval",
    description: "[통계] 평균(t분포) 또는 비율(윌슨 방식)의 신뢰구간을 계산합니다. 예: '263명 중 81명이 만족했는데 만족률 95% 신뢰구간은?'",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["mean", "proportion"], description: "mean(평균) 또는 proportion(비율). 생략하면 values가 있으면 mean" },
        values: NUM_ARR("평균 신뢰구간용 숫자 목록"),
        successes: { type: ["number", "string"], description: "비율용 성공 수" },
        n: { type: ["number", "string"], description: "비율용 전체 수" },
        confidence: { type: "number", description: "신뢰수준 (기본 0.95)" },
      },
    },
    annotations: RO,
  },
  {
    name: "stats_chi_square",
    description: "[통계] 교차표(분할표)로 두 범주형 변수가 독립인지 카이제곱 검정을 합니다. 기대빈도, p값, 크래머 V(연관 강도)를 줍니다. 예: '연령대별로 선호 상품이 다른지 검정해줘'",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "array", items: { type: "array", items: { type: ["number", "string"] } }, description: "관측 빈도 표 (행 배열의 배열)" },
        rowLabels: { type: "array", items: { type: "string" }, description: "선택. 행 이름" },
        colLabels: { type: "array", items: { type: "string" }, description: "선택. 열 이름" },
        yates: { type: "boolean", description: "2x2 표에 연속성 보정 적용 (기본 false)" },
      },
      required: ["table"],
    },
    annotations: RO,
  },
  {
    name: "stats_anova_oneway",
    description: "[통계] 세 집단 이상의 평균이 같은지 일원분산분석(ANOVA)으로 검정합니다. F값, p값, 에타제곱을 줍니다. 예: '서울·부산·대구 매장 일매출 평균이 다른지 봐줘'",
    inputSchema: {
      type: "object",
      properties: { groups: { type: ["object", "array"], description: "집단별 값. {\"서울\":[..],\"부산\":[..]} 또는 [[..],[..]]" } },
      required: ["groups"],
    },
    annotations: RO,
  },
  {
    name: "stats_linear_regression",
    description: "[통계] 최소제곱 선형회귀(단순·다중)를 적합합니다. 계수, 표준오차, p값, R², 수정 R², 새 x에 대한 예측값을 줍니다. 예: '광고비로 매출 예측하는 식 만들어줘'",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "array", description: "설명변수. 단순회귀는 숫자 배열, 다중회귀는 관측치별 배열의 배열 [[x1,x2],...] (변수별 배열 [[x1...],[x2...]]도 자동 인식)" },
        y: NUM_ARR("결과변수"),
        xNames: { type: "array", items: { type: "string" }, description: "선택. 설명변수 이름" },
        newX: { type: "array", description: "선택. 예측할 x 값 목록 (다중회귀는 배열의 배열)" },
      },
      required: ["x", "y"],
    },
    annotations: RO,
  },
  {
    name: "stats_correlation_matrix",
    description: "[통계] 여러 지표를 한 번에 넣으면 모든 쌍의 피어슨 상관계수 행렬과 가장 강한 관계를 보여줍니다. 예: '방문자·광고비·매출·기온 상관관계 표 만들어줘'",
    inputSchema: { type: "object", properties: { series: { type: "object", description: "{\"지표명\": [숫자...], ...} 모두 같은 길이" } }, required: ["series"] },
    annotations: RO,
  },
  {
    name: "stats_moving_average",
    description: "[통계] 시계열의 단순이동평균(SMA)과 지수이동평균(EMA)을 계산합니다. 예: '일매출 7일 이동평균 구해줘'",
    inputSchema: { type: "object", properties: { values: NUM_ARR("시간순 숫자 목록"), window: { type: "integer", minimum: 1, description: "기간 (기본 7)" }, alpha: { type: "number", description: "EMA 평활계수 (기본 2/(window+1))" } }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "stats_growth_rates",
    description: "[통계] 전기 대비 증감률, lag 기간 전 대비 증감률(예: 월별이면 lag=12로 전년 동월 대비), 전체 기간 연평균 성장률(CAGR)을 계산합니다. 예: '월별 매출 전월비·전년동월비 계산해줘'",
    inputSchema: {
      type: "object",
      properties: {
        values: NUM_ARR("시간순 숫자 목록"), labels: { type: "array", items: { type: "string" }, description: "선택. 기간 이름" },
        lag: { type: "integer", minimum: 1, description: "선택. 비교할 이전 기간 수 (월별 YoY=12, 분기 YoY=4)" },
        periodsPerYear: { type: "integer", minimum: 1, description: "선택. 연간 기간 수 (월별 12). 넣으면 CAGR을 연 단위로 환산" },
      },
      required: ["values"],
    },
    annotations: RO,
  },
  {
    name: "stats_forecast",
    description: "[통계] 시계열을 홀트 선형추세(또는 seasonLength를 주면 가법 홀트-윈터스 계절) 지수평활로 예측합니다. 최적 모수, 예측값, 적합 MAPE를 줍니다. 예: '최근 24개월 매출로 다음 6개월 예측해줘'",
    inputSchema: {
      type: "object",
      properties: {
        values: NUM_ARR("시간순 숫자 목록 (최소 4개, 계절 모델은 2주기 이상)"),
        horizon: { type: "integer", minimum: 1, maximum: 60, description: "예측 기간 수 (기본 6)" },
        seasonLength: { type: "integer", minimum: 2, description: "선택. 계절 주기 (월별 12, 요일 7)" },
      },
      required: ["values"],
    },
    annotations: RO,
  },
  {
    name: "stats_seasonality",
    description: "[통계] 날짜와 값을 받아 요일별·월별 평균 지수(전체 평균=1)를 계산하고 어느 패턴이 더 강한지 알려줍니다. 예: '일별 방문자 데이터에 요일 효과 있어?'",
    inputSchema: {
      type: "object",
      properties: { dates: { type: "array", items: { type: "string" }, description: "날짜 YYYY-MM-DD (values와 같은 길이)" }, values: NUM_ARR("값") },
      required: ["dates", "values"],
    },
    annotations: RO,
  },
  {
    name: "stats_margin_of_error",
    description: "[통계] 설문 표본오차(±%p)를 계산합니다. 모집단 크기를 주면 유한모집단 보정, targetMoe를 주면 필요한 표본 수를 역산합니다. 예: '1000명 설문이면 오차범위 몇 %야?', '오차 ±3%p 맞추려면 몇 명?'",
    inputSchema: {
      type: "object",
      properties: {
        n: { type: ["number", "string"], description: "표본 수 (오차 계산 시)" },
        targetMoe: { type: "number", description: "목표 오차 (0.03 또는 3). 넣으면 필요 표본 수 계산" },
        p: { type: "number", description: "예상 비율 (기본 0.5, 가장 보수적)" },
        confidence: { type: "number", description: "신뢰수준 (기본 0.95)" },
        population: { type: ["number", "string"], description: "선택. 모집단 크기" },
      },
    },
    annotations: RO,
  },
];

export const STATS_TOOL_NAMES = new Set(STATS_TOOLS.map((t) => t.name));

// ---------- 구현 ----------
function describe(v) {
  const s = [...v].sort((a, b) => a - b);
  const n = v.length, m = mean(v), sd = Math.sqrt(variance(v));
  const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75);
  let skew = null;
  if (n >= 3 && sd > 0) {
    const m3 = v.reduce((a, x) => a + (x - m) ** 3, 0) / n;
    const m2 = v.reduce((a, x) => a + (x - m) ** 2, 0) / n;
    skew = ((Math.sqrt(n * (n - 1)) / (n - 2)) * m3) / m2 ** 1.5;
  }
  return { count: n, mean: m, median: quantile(s, 0.5), std: n > 1 ? sd : null, min: s[0], max: s[n - 1], q1, q3, iqr: q3 - q1, skewness: skew, cv: n > 1 && m !== 0 ? sd / Math.abs(m) : null };
}
function roundObj(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === "number" ? r4(v) : v;
  return out;
}

function holt(y, a, b) {
  let l = y[0], t = y[1] - y[0], sse = 0, ape = 0, cnt = 0;
  const fitted = [null];
  for (let i = 1; i < y.length; i++) {
    const f = l + t;
    fitted.push(f);
    const e = y[i] - f;
    sse += e * e;
    if (y[i] !== 0) { ape += Math.abs(e / y[i]); cnt++; }
    const nl = a * y[i] + (1 - a) * (l + t);
    t = b * (nl - l) + (1 - b) * t;
    l = nl;
  }
  return { l, t, sse, mape: cnt ? (ape / cnt) * 100 : null, fitted };
}
function holtWinters(y, L, a, b, g) {
  const s1 = mean(y.slice(0, L)), s2 = mean(y.slice(L, 2 * L));
  let l = s1, t = (s2 - s1) / L, sse = 0, ape = 0, cnt = 0;
  const s = y.slice(0, L).map((v) => v - s1);
  for (let i = L; i < y.length; i++) {
    const f = l + t + s[i % L];
    const e = y[i] - f;
    sse += e * e;
    if (y[i] !== 0) { ape += Math.abs(e / y[i]); cnt++; }
    const nl = a * (y[i] - s[i % L]) + (1 - a) * (l + t);
    t = b * (nl - l) + (1 - b) * t;
    s[i % L] = g * (y[i] - nl) + (1 - g) * s[i % L];
    l = nl;
  }
  return { l, t, s, sse, mape: cnt ? (ape / cnt) * 100 : null };
}

export async function callStatsTool(name, args = {}, env = {}) {
  switch (name) {
    case "stats_describe": {
      const v = nums(args.values);
      const d = describe(v);
      const shape = d.skewness == null ? "" : d.skewness > 1 ? "오른쪽 꼬리가 긴 분포(큰 값 몇 개가 평균을 끌어올림)" : d.skewness < -1 ? "왼쪽 꼬리가 긴 분포" : "대체로 대칭";
      return { ...roundObj(d), 해석: `평균 ${r4(d.mean)}, 중앙값 ${r4(d.median)}. ${shape}${Math.abs(d.mean - d.median) > 0.1 * (d.std || 1) ? " — 평균과 중앙값 차이가 있어 대표값은 중앙값도 함께 보세요." : "."}` };
    }
    case "stats_percentile": {
      const v = nums(args.values).sort((a, b) => a - b);
      const ps = args.percentiles ? nums(args.percentiles, "percentiles") : [25, 50, 75, 90, 95, 99];
      if (ps.some((p) => p < 0 || p > 100)) throw new Error("percentiles는 0~100 사이여야 합니다.");
      return { count: v.length, percentiles: ps.map((p) => ({ percentile: p, value: r4(quantile(v, p / 100)) })), method: "선형 보간 (엑셀 PERCENTILE.INC와 동일)" };
    }
    case "stats_histogram": {
      const v = nums(args.values);
      const mn = Math.min(...v), mx = Math.max(...v);
      let width, bins;
      if (args.width != null) {
        width = toNum(args.width);
        if (!(width > 0)) throw new Error("width는 0보다 커야 합니다.");
        bins = Math.max(1, Math.ceil((mx - mn) / width + 1e-12)) || 1;
        if (bins > 100) throw new Error(`구간이 ${bins}개로 너무 많습니다. width를 키워 주세요 (최대 100개).`);
      } else {
        bins = args.bins ? Math.min(100, Math.max(1, Math.floor(toNum(args.bins)))) : Math.ceil(Math.log2(v.length) + 1);
        width = (mx - mn) / bins || 1;
      }
      const counts = new Array(bins).fill(0);
      for (const x of v) counts[Math.min(bins - 1, Math.floor((x - mn) / width))]++;
      const rows = counts.map((c, i) => ({ from: r4(mn + i * width), to: r4(mn + (i + 1) * width), count: c, share: r4(c / v.length) }));
      const top = rows.reduce((a, b) => (b.count > a.count ? b : a));
      return { count: v.length, bins, width: r4(width), histogram: rows, 해석: `가장 많은 구간은 ${top.from}~${top.to} (${top.count}개, ${r4(top.share * 100)}%).` };
    }
    case "stats_zscore_outliers": {
      const v = nums(args.values, "values", { min: 3 });
      const zt = args.zThreshold != null ? toNum(args.zThreshold) : 3, k = args.iqrK != null ? toNum(args.iqrK) : 1.5;
      const m = mean(v), sd = Math.sqrt(variance(v));
      const s = [...v].sort((a, b) => a - b), q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1;
      const lo = q1 - k * iqr, hi = q3 + k * iqr;
      const z = [], iq = [];
      v.forEach((x, i) => {
        const zs = sd > 0 ? (x - m) / sd : 0;
        if (Math.abs(zs) >= zt) z.push({ index: i, value: x, z: r4(zs) });
        if (x < lo || x > hi) iq.push({ index: i, value: x, side: x > hi ? "위" : "아래" });
      });
      const note = v.length <= 10 && zt >= 3 ? " 표본이 10개 이하이면 Z점수가 3을 넘기 어려워 IQR 결과를 우선 보세요." : "";
      return { count: v.length, mean: r4(m), std: r4(sd), zThreshold: zt, iqrBounds: { lower: r4(lo), upper: r4(hi) }, zOutliers: z.slice(0, 100), iqrOutliers: iq.slice(0, 100), 해석: `Z점수 기준 ${z.length}개, IQR 기준 ${iq.length}개 이상치.${note}` };
    }
    case "stats_ttest": {
      const a = nums(args.a, "a", { min: 2 }), b = nums(args.b, "b", { min: 2 });
      const c = confLevel(args.confidence);
      const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b);
      const se = Math.sqrt(va / a.length + vb / b.length);
      if (!(se > 0)) throw new Error("두 집단 모두 값이 전부 같아 검정할 수 없습니다.");
      const t = (ma - mb) / se;
      const df = (va / a.length + vb / b.length) ** 2 / ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1));
      const p = tTwoSided(t, df), tc = tInv(1 - (1 - c) / 2, df);
      const d = (ma - mb) / Math.sqrt((va + vb) / 2);
      return {
        meanA: r4(ma), meanB: r4(mb), diff: r4(ma - mb), t: r4(t), df: r4(df), pValue: rp(p),
        ci: { level: c, lower: r4(ma - mb - tc * se), upper: r4(ma - mb + tc * se) }, cohenD: r4(d), method: "Welch two-sample t-test (양측)",
        해석: p < 1 - c ? `두 평균 차이 ${r4(ma - mb)}는 유의함 (p=${rp(p)}).` : `차이 ${r4(ma - mb)}는 우연으로도 나올 수 있는 수준 (p=${rp(p)}).`,
      };
    }
    case "stats_paired_ttest": {
      const b = nums(args.before, "before", { min: 2 }), a = nums(args.after, "after", { min: 2 });
      if (a.length !== b.length) throw new Error(`before(${b.length}개)와 after(${a.length}개)의 길이가 같아야 합니다.`);
      const c = confLevel(args.confidence);
      const d = a.map((x, i) => x - b[i]), n = d.length, md = mean(d), sd = Math.sqrt(variance(d));
      if (!(sd > 0)) throw new Error("모든 차이가 같아 검정할 수 없습니다.");
      const se = sd / Math.sqrt(n), t = md / se, df = n - 1, p = tTwoSided(t, df), tc = tInv(1 - (1 - c) / 2, df);
      return {
        n, meanBefore: r4(mean(b)), meanAfter: r4(mean(a)), meanDiff: r4(md), sdDiff: r4(sd), t: r4(t), df, pValue: rp(p),
        ci: { level: c, lower: r4(md - tc * se), upper: r4(md + tc * se) }, method: "paired t-test (after - before, 양측)",
        해석: p < 1 - c ? `평균 ${r4(md)} 변화는 유의함 (p=${rp(p)}).` : `평균 ${r4(md)} 변화는 유의하지 않음 (p=${rp(p)}).`,
      };
    }
    case "stats_ab_test_proportions": {
      const ca = toNum(args.conversionsA), na = toNum(args.visitorsA), cb = toNum(args.conversionsB), nb = toNum(args.visitorsB);
      for (const [k, v] of Object.entries({ conversionsA: ca, visitorsA: na, conversionsB: cb, visitorsB: nb })) if (!(v >= 0)) throw new Error(`${k}에 0 이상의 숫자를 넣어 주세요.`);
      if (!(na > 0 && nb > 0) || ca > na || cb > nb) throw new Error("방문 수는 0보다 크고 전환 수 이상이어야 합니다.");
      const alpha = args.alpha != null ? toNum(args.alpha) : 0.05;
      const pa = ca / na, pb = cb / nb, pp = (ca + cb) / (na + nb);
      const sePool = Math.sqrt(pp * (1 - pp) * (1 / na + 1 / nb));
      const z = sePool > 0 ? (pb - pa) / sePool : 0, p = 2 * (1 - normCdf(Math.abs(z)));
      const se = Math.sqrt((pa * (1 - pa)) / na + (pb * (1 - pb)) / nb), zc = normInv(1 - alpha / 2);
      const sig = p < alpha;
      return {
        rateA: r4(pa), rateB: r4(pb), absLift: r4(pb - pa), relLiftPct: pa > 0 ? r4(((pb - pa) / pa) * 100) : null, z: r4(z), pValue: rp(p),
        diffCI: { level: 1 - alpha, lower: r4(pb - pa - zc * se), upper: r4(pb - pa + zc * se) }, alpha, significant: sig,
        해석: `B 전환율 ${r4(pb * 100)}% vs A ${r4(pa * 100)}% (${pb >= pa ? "+" : ""}${r4((pb - pa) * 100)}%p). ${sig ? `유의수준 ${alpha}에서 유의한 차이.` : "아직 유의하지 않음 — 표본을 더 모으거나 결론을 보류하세요."}`,
      };
    }
    case "stats_sample_size": {
      const p1 = rate01(args.baselineRate, "baselineRate");
      let mde = toNum(args.mde);
      if (!(mde > 0)) throw new Error("mde는 0보다 커야 합니다.");
      const type = args.mdeType === "relative" ? "relative" : "absolute";
      const p2 = type === "relative" ? p1 * (1 + (mde > 1 ? mde / 100 : mde)) : p1 + (mde >= 1 ? mde / 100 : mde);
      if (!(p2 > 0 && p2 < 1)) throw new Error("기준 전환율에 효과를 더한 값이 0~1을 벗어납니다.");
      const alpha = args.alpha != null ? toNum(args.alpha) : 0.05, power = args.power != null ? (toNum(args.power) > 1 ? toNum(args.power) / 100 : toNum(args.power)) : 0.8;
      const za = normInv(1 - alpha / 2), zb = normInv(power), pbar = (p1 + p2) / 2;
      const n = Math.ceil((za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2 / (p2 - p1) ** 2);
      return { baselineRate: r4(p1), targetRate: r4(p2), absEffect: r4(p2 - p1), alpha, power, perGroup: n, total: 2 * n, 해석: `전환율 ${r4(p1 * 100)}% → ${r4(p2 * 100)}% 차이를 검정력 ${power * 100}%로 잡으려면 그룹당 ${n.toLocaleString("en-US")}명(총 ${(2 * n).toLocaleString("en-US")}명) 필요.` };
    }
    case "stats_confidence_interval": {
      const c = confLevel(args.confidence);
      const type = args.type || (args.values != null ? "mean" : "proportion");
      if (type === "mean") {
        const v = nums(args.values, "values", { min: 2 });
        const m = mean(v), se = Math.sqrt(variance(v) / v.length), tc = tInv(1 - (1 - c) / 2, v.length - 1);
        return { type, n: v.length, mean: r4(m), se: r4(se), level: c, lower: r4(m - tc * se), upper: r4(m + tc * se), method: "t 분포", 해석: `평균 ${r4(m)}, ${c * 100}% 신뢰구간 ${r4(m - tc * se)} ~ ${r4(m + tc * se)}.` };
      }
      const x = toNum(args.successes), n = toNum(args.n);
      if (!(n > 0) || !(x >= 0) || x > n) throw new Error("비율 신뢰구간은 successes(0 이상)와 n(성공 수 이상)이 필요합니다.");
      const z = normInv(1 - (1 - c) / 2), p = x / n, den = 1 + (z * z) / n;
      const center = (p + (z * z) / (2 * n)) / den, half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / den;
      return { type: "proportion", successes: x, n, proportion: r4(p), level: c, lower: r4(center - half), upper: r4(center + half), method: "Wilson score", 해석: `비율 ${r4(p * 100)}%, ${c * 100}% 신뢰구간 ${r4((center - half) * 100)}% ~ ${r4((center + half) * 100)}%.` };
    }
    case "stats_chi_square": {
      if (!Array.isArray(args.table) || args.table.length < 2) throw new Error("table에 2행 이상의 빈도표(배열의 배열)를 넣어 주세요.");
      const T = args.table.map((row, i) => nums(row, `table[${i}]`, { skipMissing: false }));
      const c = T[0].length;
      if (c < 2 || T.some((r) => r.length !== c)) throw new Error("모든 행의 열 수가 같고 2열 이상이어야 합니다.");
      if (T.some((r) => r.some((v) => v < 0))) throw new Error("빈도는 음수일 수 없습니다.");
      const rs = T.map((r) => r.reduce((a, b) => a + b, 0)), cs = T[0].map((_, j) => T.reduce((a, r) => a + r[j], 0)), N = rs.reduce((a, b) => a + b, 0);
      if (rs.some((v) => v === 0) || cs.some((v) => v === 0)) throw new Error("합계가 0인 행이나 열이 있습니다.");
      const yates = !!args.yates && T.length === 2 && c === 2;
      let chi = 0, small = 0;
      const E = T.map((r, i) => r.map((o, j) => {
        const e = (rs[i] * cs[j]) / N;
        if (e < 5) small++;
        const dlt = yates ? Math.max(0, Math.abs(o - e) - 0.5) : Math.abs(o - e);
        chi += (dlt * dlt) / e;
        return r4(e);
      }));
      const df = (T.length - 1) * (c - 1), p = chi2Upper(chi, df), v = Math.sqrt(chi / (N * (Math.min(T.length, c) - 1)));
      return {
        chiSquare: r4(chi), df, pValue: rp(p), cramersV: r4(v), n: N, expected: E, rowLabels: args.rowLabels, colLabels: args.colLabels, yatesCorrection: yates,
        warning: small ? `기대빈도 5 미만 칸이 ${small}개 — 결과를 조심해서 보세요(피셔 정확검정 고려).` : undefined,
        해석: `${p < 0.05 ? "두 변수는 관련이 있음" : "독립이라는 가정을 기각할 근거 부족"} (p=${rp(p)}), 연관 강도 V=${r4(v)} (${v < 0.1 ? "매우 약함" : v < 0.3 ? "약함" : v < 0.5 ? "중간" : "강함"}).`,
      };
    }
    case "stats_anova_oneway": {
      const g = args.groups;
      if (!g || typeof g !== "object") throw new Error("groups에 집단별 숫자 배열을 넣어 주세요.");
      const entries = Array.isArray(g) ? g.map((v, i) => [`집단${i + 1}`, v]) : Object.entries(g);
      if (entries.length < 2) throw new Error("집단이 2개 이상 필요합니다.");
      const G = entries.map(([k, v]) => [k, nums(v, k, { min: 2 })]);
      const all = G.flatMap(([, v]) => v), gm = mean(all), N = all.length, k = G.length;
      let ssb = 0, ssw = 0;
      for (const [, v] of G) { const m = mean(v); ssb += v.length * (m - gm) ** 2; ssw += v.reduce((a, x) => a + (x - m) ** 2, 0); }
      const dfb = k - 1, dfw = N - k;
      if (!(ssw > 0)) throw new Error("집단 내 변동이 0이라 F를 계산할 수 없습니다.");
      const F = ssb / dfb / (ssw / dfw), p = fUpper(F, dfb, dfw);
      return {
        groups: G.map(([n, v]) => ({ name: n, n: v.length, mean: r4(mean(v)), std: r4(Math.sqrt(variance(v))) })),
        F: r4(F), dfBetween: dfb, dfWithin: dfw, pValue: rp(p), etaSquared: r4(ssb / (ssb + ssw)),
        해석: p < 0.05 ? `집단 평균 중 적어도 하나는 다름 (p=${rp(p)}). 어느 집단인지는 사후검정(쌍별 t-검정 등)으로 확인하세요.` : `집단 평균 차이가 유의하지 않음 (p=${rp(p)}).`,
      };
    }
    case "stats_linear_regression": {
      const y = nums(args.y, "y", { min: 3, skipMissing: false });
      if (!Array.isArray(args.x)) throw new Error("x에 숫자 배열(또는 배열의 배열)을 넣어 주세요.");
      let X;
      if (args.x.length && Array.isArray(args.x[0])) {
        let rows = args.x.map((r, i) => nums(r, `x[${i}]`, { skipMissing: false }));
        if (rows.length !== y.length && rows[0].length === y.length) rows = y.map((_, i) => rows.map((col) => col[i]));
        X = rows;
      } else X = nums(args.x, "x", { skipMissing: false }).map((v) => [v]);
      const n = y.length, k = X[0].length;
      if (X.length !== n || X.some((r) => r.length !== k)) throw new Error(`x와 y의 관측치 수가 맞지 않습니다 (x ${X.length}개, y ${n}개).`);
      if (n <= k + 1) throw new Error(`관측치(${n}개)가 변수 수+1(${k + 1})보다 많아야 합니다.`);
      const D = X.map((r) => [1, ...r]), p = k + 1;
      const XtX = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => D.reduce((a, r) => a + r[i] * r[j], 0)));
      const Xty = Array.from({ length: p }, (_, i) => D.reduce((a, r, t) => a + r[i] * y[t], 0));
      const inv = invert(XtX);
      const beta = inv.map((row) => row.reduce((a, v, j) => a + v * Xty[j], 0));
      const pred = D.map((r) => r.reduce((a, v, j) => a + v * beta[j], 0));
      const my = mean(y), sse = y.reduce((a, v, i) => a + (v - pred[i]) ** 2, 0), sst = y.reduce((a, v) => a + (v - my) ** 2, 0);
      const df = n - p, s2 = sse / df, r2 = sst > 0 ? 1 - sse / sst : null;
      const names = ["절편", ...Array.from({ length: k }, (_, i) => args.xNames?.[i] || (k === 1 ? "x" : `x${i + 1}`))];
      const coefs = beta.map((b, i) => {
        const se = Math.sqrt(s2 * inv[i][i]), t = se > 0 ? b / se : null;
        return { name: names[i], estimate: r4(b), se: r4(se), t: r4(t), pValue: t == null ? null : rp(tTwoSided(t, df)) };
      });
      let predictions;
      if (Array.isArray(args.newX)) predictions = args.newX.slice(0, 100).map((nx) => {
        const row = Array.isArray(nx) ? nums(nx, "newX") : [toNum(nx)];
        if (row.length !== k || row.some(Number.isNaN)) throw new Error(`newX 각 항목은 설명변수 ${k}개여야 합니다.`);
        return { x: Array.isArray(nx) ? row : row[0], y: r4(beta[0] + row.reduce((a, v, j) => a + v * beta[j + 1], 0)) };
      });
      const eq = `y = ${r4(beta[0])}` + beta.slice(1).map((b, i) => ` ${b >= 0 ? "+" : "-"} ${r4(Math.abs(b))}·${names[i + 1]}`).join("");
      return {
        n, coefficients: coefs, rSquared: r4(r2), adjRSquared: r2 == null ? null : r4(1 - ((1 - r2) * (n - 1)) / df), residualStd: r4(Math.sqrt(s2)), equation: eq, predictions,
        해석: `${eq}. 결과 변동의 ${r4((r2 ?? 0) * 100)}%를 설명. 상관이지 인과는 아님.`,
      };
    }
    case "stats_correlation_matrix": {
      const s = args.series;
      if (!s || typeof s !== "object" || Array.isArray(s)) throw new Error("series에 {\"지표명\": [숫자...]} 형태로 넣어 주세요.");
      const keys = Object.keys(s).slice(0, 30);
      if (keys.length < 2) throw new Error("지표가 2개 이상 필요합니다.");
      const data = keys.map((k) => nums(s[k], k, { min: 3, skipMissing: false }));
      if (data.some((d) => d.length !== data[0].length)) throw new Error("모든 지표의 길이가 같아야 합니다.");
      const matrix = {}, pairs = [];
      keys.forEach((a, i) => {
        matrix[a] = {};
        keys.forEach((b, j) => {
          const r = i === j ? 1 : pearson(data[i], data[j]);
          matrix[a][b] = r4(r);
          if (j > i) pairs.push({ a, b, r: r4(r) });
        });
      });
      pairs.sort((x, y) => Math.abs(y.r ?? 0) - Math.abs(x.r ?? 0));
      return { n: data[0].length, matrix, strongestPairs: pairs.slice(0, 10), 해석: `가장 강한 관계: ${pairs[0].a}↔${pairs[0].b} (r=${pairs[0].r}). 상관은 인과가 아니며 공통 원인(계절·요일 등)을 확인하세요.` };
    }
    case "stats_moving_average": {
      const v = nums(args.values, "values", { skipMissing: false });
      const w = args.window != null ? Math.floor(toNum(args.window)) : 7;
      if (!(w >= 1) || w > v.length) throw new Error(`window는 1 이상 ${v.length} 이하여야 합니다.`);
      const al = args.alpha != null ? toNum(args.alpha) : 2 / (w + 1);
      if (!(al > 0 && al <= 1)) throw new Error("alpha는 0~1 사이여야 합니다.");
      let sum = 0, ema = null;
      const rows = v.map((x, i) => {
        sum += x;
        if (i >= w) sum -= v[i - w];
        ema = ema == null ? x : al * x + (1 - al) * ema;
        return { index: i, value: x, sma: i >= w - 1 ? r4(sum / w) : null, ema: r4(ema) };
      });
      return { window: w, alpha: r4(al), rows: rows.slice(-500), note: rows.length > 500 ? "최근 500개만 표시" : undefined, latest: rows[rows.length - 1] };
    }
    case "stats_growth_rates": {
      const v = nums(args.values, "values", { min: 2, skipMissing: false });
      const lag = args.lag != null ? Math.floor(toNum(args.lag)) : null;
      const pct = (cur, prev) => (prev === 0 ? null : r4(((cur - prev) / Math.abs(prev)) * 100));
      const rows = v.map((x, i) => ({ period: args.labels?.[i] ?? i, value: x, popPct: i ? pct(x, v[i - 1]) : null, ...(lag ? { lagPct: i >= lag ? pct(x, v[i - lag]) : null } : {}) }));
      const first = v[0], last = v[v.length - 1], periods = v.length - 1;
      let cagr = null, annual = null;
      if (first > 0 && last > 0) {
        cagr = (last / first) ** (1 / periods) - 1;
        if (args.periodsPerYear) annual = (1 + cagr) ** toNum(args.periodsPerYear) - 1;
      }
      return {
        rows: rows.slice(-500), lag, totalChangePct: pct(last, first), cagrPerPeriodPct: cagr == null ? null : r4(cagr * 100), cagrAnnualPct: annual == null ? null : r4(annual * 100),
        해석: cagr == null ? "시작 또는 끝 값이 0 이하라 CAGR은 계산하지 않았습니다." : `${periods}기간 동안 기간당 평균 ${r4(cagr * 100)}% 성장${annual != null ? ` (연환산 ${r4(annual * 100)}%)` : ""}.`,
      };
    }
    case "stats_forecast": {
      const y = nums(args.values, "values", { min: 4, skipMissing: false });
      const h = args.horizon != null ? Math.min(60, Math.max(1, Math.floor(toNum(args.horizon)))) : 6;
      const L = args.seasonLength != null ? Math.floor(toNum(args.seasonLength)) : null;
      const grid = [];
      for (let g = 0.05; g < 0.96; g += 0.05) grid.push(Math.round(g * 100) / 100);
      if (L) {
        if (L < 2 || y.length < 2 * L) throw new Error(`계절 모델은 최소 2주기(${2 * (L || 2)}개) 데이터가 필요합니다.`);
        const g2 = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        let best = null;
        for (const a of g2) for (const b of [0.01, 0.05, 0.1, 0.2, 0.3]) for (const g of g2) {
          const f = holtWinters(y, L, a, b, g);
          if (!best || f.sse < best.sse) best = { ...f, a, b, g };
        }
        const n = y.length;
        const fc = Array.from({ length: h }, (_, i) => r4(best.l + (i + 1) * best.t + best.s[(n - 1 + i + 1) % L]));
        return { model: "Holt-Winters additive", seasonLength: L, params: { alpha: best.a, beta: best.b, gamma: best.g }, level: r4(best.l), trend: r4(best.t), forecast: fc, fitMapePct: r4(best.mape), 해석: `다음 ${h}기간 예측: ${fc.slice(0, 6).join(", ")}${h > 6 ? " …" : ""}. 적합 오차(MAPE) ${r4(best.mape)}%.` };
      }
      let best = null;
      for (const a of grid) for (const b of grid) {
        const f = holt(y, a, b);
        if (!best || f.sse < best.sse) best = { ...f, a, b };
      }
      const fc = Array.from({ length: h }, (_, i) => r4(best.l + (i + 1) * best.t));
      return { model: "Holt linear trend", params: { alpha: best.a, beta: best.b }, level: r4(best.l), trend: r4(best.t), forecast: fc, fitMapePct: r4(best.mape), 해석: `추세 기간당 ${r4(best.t)}. 다음 ${h}기간 예측: ${fc.slice(0, 6).join(", ")}${h > 6 ? " …" : ""}. 적합 MAPE ${r4(best.mape)}%. 계절성이 있으면 seasonLength를 넣으세요.` };
    }
    case "stats_seasonality": {
      if (!Array.isArray(args.dates)) throw new Error("dates에 날짜 배열을 넣어 주세요.");
      const v = nums(args.values, "values", { min: 7, skipMissing: false });
      if (args.dates.length !== v.length) throw new Error("dates와 values의 길이가 같아야 합니다.");
      const WD = ["일", "월", "화", "수", "목", "금", "토"];
      const wd = {}, mo = {};
      const bad = [];
      args.dates.forEach((s, i) => {
        const d = parseDate(s);
        if (!d) { bad.push(s); return; }
        (wd[WD[d.getUTCDay()]] ||= []).push(v[i]);
        (mo[`${d.getUTCMonth() + 1}월`] ||= []).push(v[i]);
      });
      if (bad.length) throw new Error(`날짜를 읽지 못했습니다: ${bad.slice(0, 5).join(", ")} (YYYY-MM-DD 형식)`);
      const overall = mean(v);
      if (!overall) throw new Error("전체 평균이 0이라 지수를 만들 수 없습니다.");
      const idx = (obj, order) => order.filter((k) => obj[k]).map((k) => ({ key: k, n: obj[k].length, mean: r4(mean(obj[k])), index: r4(mean(obj[k]) / overall) }));
      const w = idx(wd, ["월", "화", "수", "목", "금", "토", "일"]), m = idx(mo, Array.from({ length: 12 }, (_, i) => `${i + 1}월`));
      const range = (a) => (a.length > 1 ? Math.max(...a.map((x) => x.index)) - Math.min(...a.map((x) => x.index)) : 0);
      const rw = range(w), rm = range(m);
      const strongest = rm > rw && m.length >= 3 ? "월" : "요일";
      const arr = strongest === "월" ? m : w;
      const pk = arr.reduce((a, b) => (b.index > a.index ? b : a)), tr = arr.reduce((a, b) => (b.index < a.index ? b : a));
      return { overallMean: r4(overall), weekday: w, month: m, weekdayRange: r4(rw), monthRange: r4(rm), strongestPattern: strongest, 해석: `${strongest} 패턴이 더 강함: ${pk.key}이 평균의 ${pk.index}배, ${tr.key}이 ${tr.index}배.${m.length < 12 && strongest === "요일" ? " 월 패턴은 1년 이상 데이터가 있어야 믿을 만합니다." : ""}` };
    }
    case "stats_margin_of_error": {
      const c = confLevel(args.confidence);
      const p = args.p != null ? rate01(args.p, "p") : 0.5;
      const z = normInv(1 - (1 - c) / 2), N = args.population != null ? toNum(args.population) : null;
      if (N != null && !(N > 1)) throw new Error("population은 1보다 커야 합니다.");
      if (args.targetMoe != null) {
        let e = toNum(args.targetMoe);
        if (e >= 1) e = e / 100;
        if (!(e > 0 && e < 1)) throw new Error("targetMoe는 0.03 또는 3(%p)처럼 넣어 주세요.");
        const n0 = (z * z * p * (1 - p)) / (e * e), n = Math.ceil(N ? n0 / (1 + (n0 - 1) / N) : n0);
        return { targetMoe: e, p, confidence: c, population: N, requiredN: n, 해석: `오차 ±${r4(e * 100)}%p (${c * 100}% 신뢰)를 맞추려면 ${n.toLocaleString("en-US")}명 필요.` };
      }
      const n = toNum(args.n);
      if (!(n > 0)) throw new Error("n(표본 수) 또는 targetMoe(목표 오차)를 넣어 주세요.");
      if (N && n > N) throw new Error("표본 수가 모집단보다 클 수 없습니다.");
      const fpc = N ? Math.sqrt((N - n) / (N - 1)) : 1, moe = z * Math.sqrt((p * (1 - p)) / n) * fpc;
      return { n, p, confidence: c, population: N, fpc: r4(fpc), moe: r4(moe), moePctPoint: r4(moe * 100), 해석: `${c * 100}% 신뢰수준에서 최대 허용 표본오차 ±${r4(moe * 100)}%p.` };
    }
    default:
      throw new Error(`알 수 없는 통계 도구: ${name}`);
  }
}
