// CSV·텍스트 데이터 정리 도구 (data_*). 외부 API 없이 순수 JS. Cloudflare Workers에서 동작.

const RO = { readOnlyHint: true, openWorldHint: false };
const MAX_ROWS = 5000;
const CSV = { type: "string", description: "CSV 텍스트 (첫 줄은 헤더, 쉼표 또는 탭 구분 자동 인식, 최대 5000행)" };
const COLS = (d) => ({ type: ["array", "string"], items: { type: "string" }, description: d });

const r4 = (x) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 1e4) / 1e4 : x ?? null);

// ---------- CSV ----------
export function parseCsv(text) {
  if (typeof text !== "string" || !text.trim()) throw new Error("csv에 CSV 텍스트를 넣어 주세요.");
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/, 1)[0];
  const cnt = (ch) => first.split(ch).length - 1;
  const delim = cnt("\t") > cnt(",") ? "\t" : cnt(";") > cnt(",") ? ";" : ",";
  const rows = [];
  let row = [], field = "", inQ = false, truncated = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"' && field.trim() === "") { inQ = true; field = ""; }
    else if (ch === delim) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
      if (rows.length > MAX_ROWS + 1) { truncated = true; break; }
    } else field += ch;
  }
  if (!truncated && (field !== "" || row.length)) { row.push(field); if (row.some((f) => f !== "")) rows.push(row); }
  if (rows.length > MAX_ROWS + 1) { rows.length = MAX_ROWS + 1; truncated = true; }
  if (!rows.length) throw new Error("CSV에 내용이 없습니다.");
  const seen = {};
  const headers = rows[0].map((h, i) => {
    let name = h.trim() || `열${i + 1}`;
    if (seen[name]) name = `${name}_${++seen[name]}`; else seen[name] = 1;
    return name;
  });
  const data = rows.slice(1).map((r) => headers.map((_, i) => r[i] ?? ""));
  return { headers, rows: data, delimiter: delim === "\t" ? "tab" : delim, truncated, note: truncated ? `${MAX_ROWS}행까지만 읽었습니다.` : undefined };
}
function csvField(v) {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(csvField).join(",")).join("\n");
}
function colList(v, headers, name, { required = true } = {}) {
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) {
    if (required) throw new Error(`${name}에 열 이름을 넣어 주세요. 사용 가능: ${headers.join(", ")}`);
    return [];
  }
  const list = Array.isArray(v) ? v : String(v).split(",").map((s) => s.trim());
  for (const c of list) if (!headers.includes(c)) throw new Error(`'${c}' 열이 없습니다. 사용 가능: ${headers.join(", ")}`);
  return list;
}

// ---------- 값 판별 ----------
export function toNumber(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const m = s.match(/^([-+]?)[₩$]?\s*((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?|\.\d+)\s*(원|%)?$/);
  return m ? Number(m[1] + m[2].replace(/,/g, "")) : NaN;
}
const BOOL_RE = /^(true|false|yes|no|예|아니오|참|거짓)$/i;
function cellType(v) {
  const s = String(v ?? "").trim();
  if (!s) return "missing";
  if (BOOL_RE.test(s)) return "bool";
  if (!Number.isNaN(toNumber(s))) return "number";
  if (parseDateStr(s)) return "date";
  return "text";
}
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
function agg(values, how) {
  if (how === "count") return values.filter((v) => String(v ?? "").trim() !== "").length;
  const n = values.map(toNumber).filter((x) => !Number.isNaN(x));
  if (!n.length) return null;
  switch (how) {
    case "sum": return r4(n.reduce((a, b) => a + b, 0));
    case "mean": case "avg": return r4(n.reduce((a, b) => a + b, 0) / n.length);
    case "min": return Math.min(...n);
    case "max": return Math.max(...n);
    case "median": return r4(quantile([...n].sort((a, b) => a - b), 0.5));
    default: throw new Error(`집계 방식 '${how}'은 지원하지 않습니다 (sum, mean, count, min, max, median).`);
  }
}

// ---------- 날짜 ----------
const EN_MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
export function parseDateStr(raw) {
  let s = String(raw ?? "").trim().replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  let hh = null, mi = null, ss = null, m;
  const ampm = (tag, h) => {
    if (!tag) return h;
    const pm = /오후|pm/i.test(tag);
    if (pm && h < 12) return h + 12;
    if (!pm && h === 12) return 0;
    return h;
  };
  if ((m = s.match(/[T\s]+(오전|오후)?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM)?\s*(Z|[+-]\d{2}:?\d{2})?$/i))) {
    hh = ampm(m[1] || m[5], +m[2]); mi = +m[3]; ss = m[4] != null ? +m[4] : null; s = s.slice(0, m.index).trim();
  } else if ((m = s.match(/\s+(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?(?:\s*(\d{1,2})\s*초)?$/))) {
    hh = ampm(m[1], +m[2]); mi = m[3] != null ? +m[3] : 0; ss = m[4] != null ? +m[4] : null; s = s.slice(0, m.index).trim();
  }
  let y, mo, d;
  if ((m = s.match(/^(\d{2}|\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일?$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{4})\s*[-./]\s*(\d{1,2})\s*[-./]\s*(\d{1,2})\.?$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/))) {
    const a = +m[1], b = +m[2];
    [y, mo, d] = a > 12 ? [+m[3], b, a] : [+m[3], a, b];
  } else if ((m = s.match(/^(\d{2})([-./])(\d{1,2})[-./](\d{1,2})\.?$/))) {
    const a = +m[1], b = +m[3], c = +m[4];
    if (m[2] === "/" && b > 12 && a <= 12) [y, mo, d] = [c, a, b];
    else [y, mo, d] = [a, b, c];
  } else if ((m = s.match(/^(\d{4})(\d{2})(\d{2})$/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/)) && EN_MON[m[1].toLowerCase().slice(0, 3)]) [y, mo, d] = [+m[3], EN_MON[m[1].toLowerCase().slice(0, 3)], +m[2]];
  else if ((m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})$/)) && EN_MON[m[2].toLowerCase().slice(0, 3)]) [y, mo, d] = [+m[3], EN_MON[m[2].toLowerCase().slice(0, 3)], +m[1]];
  else return null;
  if (y < 100) y += 2000;
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  if (d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null;
  if (hh != null && (hh > 23 || mi > 59 || (ss != null && ss > 59))) return null;
  let iso = `${y}-${pad(mo)}-${pad(d)}`;
  if (hh != null) iso += `T${pad(hh)}:${pad(mi)}${ss != null ? `:${pad(ss)}` : ""}`;
  return iso;
}

// ---------- 텍스트 ----------
const PARTICLES = ["에서", "으로", "은", "는", "이", "가", "을", "를", "의", "에", "로", "와", "과", "도", "만"];
const STOP_KO = "그리고 그러나 하지만 그런데 그래서 또한 또 및 등 더 수 것 이 그 저 이런 그런 저런 있다 있는 있습니다 없는 하는 했다 합니다 한다 하고 해서 정말 너무 아주 매우 좀 잘 위해 위한 대한 통해 때문 때문에 우리 저희 제 내 나 너 거 게 걸 때 중 후 전".split(" ");
const STOP_EN = "the a an and or but of to in on at for with by from is are was were be been being it its this that these those as not no do does did i you he she we they my our your their me us them so if then than too very can will just".split(" ");
function stripParticle(t) {
  if (!/[가-힣]$/.test(t)) return t;
  for (const p of PARTICLES) if (t.endsWith(p) && t.length - p.length >= 2) return t.slice(0, -p.length);
  return t;
}
function tokenizer(args) {
  const stop = new Set(args.useDefaultStopwords === false ? [] : [...STOP_KO, ...STOP_EN]);
  for (const w of Array.isArray(args.stopwords) ? args.stopwords : typeof args.stopwords === "string" ? args.stopwords.split(/[,\s]+/) : []) if (w) stop.add(String(w).toLowerCase());
  const minLen = args.minLength != null ? Number(args.minLength) : 1;
  return (text) => String(text).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(stripParticle).filter((t) => t.length >= minLen && !stop.has(t) && !/^\d+$/.test(t));
}
function topCounts(tokens, topN) {
  const c = new Map();
  for (const t of tokens) c.set(t, (c.get(t) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, topN).map(([k, v]) => ({ term: k, count: v, share: r4(v / tokens.length) }));
}
function textArg(args) {
  const t = Array.isArray(args.text) ? args.text.join("\n") : args.text;
  if (typeof t !== "string" || !t.trim()) throw new Error("text에 분석할 글을 넣어 주세요.");
  return t.length > 500000 ? t.slice(0, 500000) : t;
}

// ---------- 도구 정의 ----------
export const DATA_TOOLS = [
  {
    name: "data_profile_csv",
    description: "[데이터 정리] CSV를 넣으면 열마다 자료형(숫자·날짜·텍스트·참거짓), 결측 수·비율, 고유값 수, 많이 나온 값 5개, 숫자 열의 최소·최대·평균을 보여줍니다. 예: '이 엑셀 내보낸 CSV 어떤 데이터인지 훑어줘'",
    inputSchema: { type: "object", properties: { csv: CSV }, required: ["csv"] },
    annotations: RO,
  },
  {
    name: "data_quality_check",
    description: "[데이터 정리] CSV의 품질 문제(중복 행, 결측, 한 열에 숫자·글자 섞임, 숫자 이상치, 앞뒤 공백)를 찾아 심각도와 함께 목록으로 줍니다. 예: '분석 전에 이 데이터 문제 없는지 점검해줘'",
    inputSchema: { type: "object", properties: { csv: CSV }, required: ["csv"] },
    annotations: RO,
  },
  {
    name: "data_group_aggregate",
    description: "[데이터 정리] CSV를 열 기준으로 묶어(group by) 합계·평균·개수·최소·최대·중앙값을 계산합니다. 예: '지역별 매출 합계와 주문 수 구해줘'",
    inputSchema: {
      type: "object",
      properties: {
        csv: CSV, groupBy: COLS("묶을 열 이름 (하나 또는 여러 개)"),
        metrics: { type: "array", items: { type: "object", properties: { column: { type: "string" }, agg: { type: "string", enum: ["sum", "mean", "count", "min", "max", "median"] } }, required: ["column", "agg"] }, description: "집계 목록 [{column:'매출', agg:'sum'}]" },
        sortBy: { type: "string", description: "선택. 정렬할 결과 열 이름 (예: '매출_sum'), 내림차순" },
      },
      required: ["csv", "groupBy", "metrics"],
    },
    annotations: RO,
  },
  {
    name: "data_pivot_table",
    description: "[데이터 정리] 엑셀 피벗 테이블처럼 행·열·값·집계 방식을 지정해 교차 집계표를 만듭니다. 예: '월(행) × 채널(열) 매출 합계 피벗 만들어줘'",
    inputSchema: {
      type: "object",
      properties: {
        csv: CSV, rows: COLS("행으로 쓸 열 이름"), columns: { type: "string", description: "선택. 열로 펼칠 열 이름 (고유값 최대 50개)" },
        value: { type: "string", description: "집계할 값 열 (count면 생략 가능)" }, agg: { type: "string", enum: ["sum", "mean", "count", "min", "max", "median"], description: "집계 방식 (기본 sum)" },
      },
      required: ["csv", "rows"],
    },
    annotations: RO,
  },
  {
    name: "data_csv_to_json",
    description: "[데이터 정리] CSV를 JSON 레코드 배열로 바꿉니다. 숫자처럼 보이는 값('1,234원', '15%' 포함)은 숫자로 변환할 수 있습니다. 예: '이 CSV를 JSON으로 바꿔줘'",
    inputSchema: { type: "object", properties: { csv: CSV, castNumbers: { type: "boolean", description: "숫자 변환 (기본 true)" }, limit: { type: "integer", minimum: 1, maximum: 1000, description: "돌려받을 최대 레코드 수 (기본 100)" } }, required: ["csv"] },
    annotations: RO,
  },
  {
    name: "data_dedupe",
    description: "[데이터 정리] 지정한 키 열(생략 시 모든 열) 기준으로 중복 행을 지우고 정리된 CSV와 제거 건수를 돌려줍니다. 앞뒤 공백·대소문자는 무시하고 비교합니다. 예: '이메일 기준으로 중복 회원 지워줘'",
    inputSchema: { type: "object", properties: { csv: CSV, keys: COLS("선택. 중복 판단 열 이름"), keep: { type: "string", enum: ["first", "last"], description: "남길 행 (기본 first)" } }, required: ["csv"] },
    annotations: RO,
  },
  {
    name: "data_join_tables",
    description: "[데이터 정리] 두 CSV를 공통 키 열로 합칩니다(엑셀 VLOOKUP처럼). inner(양쪽 모두 있는 행) 또는 left(왼쪽 전부 유지)를 고를 수 있습니다. 예: '주문표에 회원표를 회원ID로 붙여줘'",
    inputSchema: {
      type: "object",
      properties: { leftCsv: CSV, rightCsv: CSV, on: COLS("키 열 이름 (양쪽에 같은 이름으로 있어야 함)"), how: { type: "string", enum: ["inner", "left"], description: "기본 left" } },
      required: ["leftCsv", "rightCsv", "on"],
    },
    annotations: RO,
  },
  {
    name: "data_normalize_dates",
    description: "[데이터 정리] '2026년 11월 17일', '26.11.17', '2026/11/17', '11/17/2026', '20261117', '2026-11-17 14:30', '오후 2시 30분' 같은 제각각 날짜를 ISO 형식(YYYY-MM-DD, 시간 있으면 THH:MM)으로 통일합니다. 예: '이 날짜들 형식 통일해줘'",
    inputSchema: { type: "object", properties: { values: { type: "array", items: { type: "string" }, description: "날짜 문자열 목록 (최대 5000개)" } }, required: ["values"] },
    annotations: RO,
  },
  {
    name: "data_word_frequency",
    description: "[데이터 정리] 한국어·영어 글(리뷰, 설문 주관식, 댓글)에서 자주 나온 단어를 셉니다. 한국어 조사(은/는/이/가/을/를/에서 등)를 떼고 불용어를 뺍니다. 예: '이 리뷰 500개에서 많이 나온 단어 20개'",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: ["string", "array"], description: "분석할 글 (문자열 또는 문자열 배열)" }, topN: { type: "integer", minimum: 1, maximum: 200, description: "상위 개수 (기본 20)" },
        stopwords: { type: ["array", "string"], items: { type: "string" }, description: "추가로 뺄 단어" }, useDefaultStopwords: { type: "boolean", description: "기본 불용어 사용 (기본 true)" },
        minLength: { type: "integer", minimum: 1, description: "최소 글자 수 (기본 1)" },
      },
      required: ["text"],
    },
    annotations: RO,
  },
  {
    name: "data_keyword_ngrams",
    description: "[데이터 정리] 글에서 자주 함께 나오는 2단어·3단어 묶음(n-gram)을 셉니다. 문장 경계는 넘지 않습니다. 예: '고객 리뷰에서 자주 나오는 두 단어 조합 찾아줘'",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: ["string", "array"], description: "분석할 글" }, n: { type: "integer", enum: [2, 3], description: "묶음 단어 수 (기본 2)" },
        topN: { type: "integer", minimum: 1, maximum: 200, description: "상위 개수 (기본 20)" }, stopwords: { type: ["array", "string"], items: { type: "string" }, description: "추가로 뺄 단어" },
        useDefaultStopwords: { type: "boolean", description: "기본 불용어 제거 (기본 true)" },
      },
      required: ["text"],
    },
    annotations: RO,
  },
];

export const DATA_TOOL_NAMES = new Set(DATA_TOOLS.map((t) => t.name));

function profileColumn(vals) {
  const types = { number: 0, date: 0, text: 0, bool: 0, missing: 0 };
  for (const v of vals) types[cellType(v)]++;
  const nonMissing = vals.length - types.missing;
  const dominant = Object.entries(types).filter(([k]) => k !== "missing").sort((a, b) => b[1] - a[1])[0];
  const type = nonMissing ? dominant[0] : "empty";
  const counts = new Map();
  for (const v of vals) { const s = String(v).trim(); if (s) counts.set(s, (counts.get(s) || 0) + 1); }
  const out = {
    type, missing: types.missing, missingRate: r4(types.missing / (vals.length || 1)), unique: counts.size,
    top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value: value.length > 60 ? value.slice(0, 60) + "…" : value, count })),
    typeCounts: Object.fromEntries(Object.entries(types).filter(([, v]) => v)),
  };
  if (type === "number") {
    const n = vals.map(toNumber).filter((x) => !Number.isNaN(x));
    out.min = Math.min(...n); out.max = Math.max(...n); out.mean = r4(n.reduce((a, b) => a + b, 0) / n.length);
  }
  if (type === "date") {
    const d = vals.map(parseDateStr).filter(Boolean).sort();
    out.min = d[0]; out.max = d[d.length - 1];
  }
  return out;
}

export async function callDataTool(name, args = {}, env = {}) {
  switch (name) {
    case "data_profile_csv": {
      const t = parseCsv(args.csv);
      const columns = t.headers.map((h, i) => ({ column: h, ...profileColumn(t.rows.map((r) => r[i])) }));
      return { rows: t.rows.length, columns: t.headers.length, delimiter: t.delimiter, note: t.note, profile: columns, 해석: `${t.rows.length}행 × ${t.headers.length}열. 결측이 있는 열: ${columns.filter((c) => c.missing).map((c) => `${c.column}(${c.missing})`).join(", ") || "없음"}.` };
    }
    case "data_quality_check": {
      const t = parseCsv(args.csv);
      const issues = [];
      const seen = new Map();
      t.rows.forEach((r, i) => { const k = r.map((v) => v.trim()).join("\u0001"); (seen.get(k) || seen.set(k, []).get(k)).push(i + 2); });
      const dups = [...seen.values()].filter((l) => l.length > 1);
      if (dups.length) issues.push({ severity: "high", type: "duplicate_rows", detail: `완전히 같은 행 ${dups.reduce((a, l) => a + l.length - 1, 0)}개 (예: ${dups.slice(0, 3).map((l) => l.join("·") + "행").join(", ")})` });
      t.headers.forEach((h, ci) => {
        const vals = t.rows.map((r) => r[ci]);
        const p = profileColumn(vals);
        if (p.missing) issues.push({ severity: p.missingRate > 0.2 ? "high" : "medium", type: "missing", column: h, detail: `결측 ${p.missing}개 (${r4(p.missingRate * 100)}%)` });
        const tc = Object.entries(p.typeCounts).filter(([k]) => k !== "missing");
        if (tc.length > 1) {
          const odd = vals.map((v, i) => [i + 2, v]).filter(([, v]) => { const c = cellType(v); return c !== "missing" && c !== p.type; }).slice(0, 5);
          issues.push({ severity: "high", type: "mixed_types", column: h, detail: `${tc.map(([k, v]) => `${k} ${v}`).join(", ")} 섞임. 다른 형식 예: ${odd.map(([r, v]) => `${r}행 '${v}'`).join(", ")}` });
        }
        if (p.type === "number") {
          const n = vals.map((v, i) => [i + 2, toNumber(v)]).filter(([, x]) => !Number.isNaN(x));
          const s = n.map(([, x]) => x).sort((a, b) => a - b);
          if (s.length >= 4) {
            const q1 = quantile(s, 0.25), q3 = quantile(s, 0.75), iqr = q3 - q1, lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
            const out = n.filter(([, x]) => x < lo || x > hi);
            if (out.length) issues.push({ severity: "medium", type: "outliers", column: h, detail: `IQR 기준 이상치 ${out.length}개 (정상 범위 ${r4(lo)}~${r4(hi)}; 예: ${out.slice(0, 5).map(([r, x]) => `${r}행 ${x}`).join(", ")})` });
          }
        }
        const ws = vals.filter((v) => v !== v.trim() || /\s{2,}/.test(v)).length;
        if (ws) issues.push({ severity: "low", type: "whitespace", column: h, detail: `앞뒤 공백이나 연속 공백이 있는 값 ${ws}개 — 같은 값이 다르게 집계될 수 있음` });
      });
      if (t.headers.some((h) => /^열\d+$|_\d+$/.test(h))) issues.push({ severity: "low", type: "header", detail: "빈 헤더나 중복 헤더가 있어 이름을 자동으로 붙였습니다." });
      const order = { high: 0, medium: 1, low: 2 };
      issues.sort((a, b) => order[a.severity] - order[b.severity]);
      return { rows: t.rows.length, columns: t.headers.length, note: t.note, issueCount: issues.length, issues: issues.slice(0, 100), 해석: issues.length ? `문제 ${issues.length}건 (심각 ${issues.filter((i) => i.severity === "high").length}건). 심각 항목부터 정리하세요.` : "눈에 띄는 품질 문제가 없습니다." };
    }
    case "data_group_aggregate": {
      const t = parseCsv(args.csv);
      const gb = colList(args.groupBy, t.headers, "groupBy");
      if (!Array.isArray(args.metrics) || !args.metrics.length) throw new Error("metrics에 [{column, agg}] 목록을 넣어 주세요.");
      const metrics = args.metrics.map((m) => ({ column: m.column === "*" || !m.column ? "*" : colList(m.column, t.headers, "metrics.column")[0], agg: m.agg || "sum" }));
      const gi = gb.map((c) => t.headers.indexOf(c));
      const groups = new Map();
      for (const r of t.rows) { const k = gi.map((i) => r[i].trim()).join("\u0001"); (groups.get(k) || groups.set(k, []).get(k)).push(r); }
      let out = [...groups.entries()].map(([k, rows]) => {
        const o = {};
        k.split("\u0001").forEach((v, i) => (o[gb[i]] = v));
        for (const m of metrics) {
          const key = `${m.column === "*" ? "rows" : m.column}_${m.agg}`;
          o[key] = m.column === "*" ? rows.length : agg(rows.map((r) => r[t.headers.indexOf(m.column)]), m.agg);
        }
        return o;
      });
      const sk = args.sortBy || Object.keys(out[0] || {}).find((k) => !gb.includes(k));
      if (sk) out.sort((a, b) => (b[sk] ?? -Infinity) - (a[sk] ?? -Infinity));
      return { groupCount: out.length, note: [t.note, out.length > 200 ? "상위 200개 그룹만 표시" : null].filter(Boolean).join(" ") || undefined, sortedBy: sk, rows: out.slice(0, 200) };
    }
    case "data_pivot_table": {
      const t = parseCsv(args.csv);
      const rk = colList(args.rows, t.headers, "rows");
      const ck = args.columns ? colList(args.columns, t.headers, "columns")[0] : null;
      const how = args.agg || "sum";
      if (how !== "count" && !args.value) throw new Error("value(집계할 열)를 넣어 주세요. 행 수만 세려면 agg를 count로.");
      const vi = args.value ? t.headers.indexOf(colList(args.value, t.headers, "value")[0]) : -1;
      const ri = rk.map((c) => t.headers.indexOf(c)), ci = ck ? t.headers.indexOf(ck) : -1;
      const colVals = ck ? [...new Set(t.rows.map((r) => r[ci].trim()))].sort() : ["값"];
      if (colVals.length > 50) throw new Error(`'${ck}' 열의 고유값이 ${colVals.length}개라 너무 많습니다 (최대 50).`);
      const cells = new Map();
      for (const r of t.rows) {
        const k = ri.map((i) => r[i].trim()).join("\u0001"), c = ck ? r[ci].trim() : "값";
        if (!cells.has(k)) cells.set(k, new Map());
        const m = cells.get(k);
        (m.get(c) || m.set(c, []).get(c)).push(vi >= 0 ? r[vi] : r[0] || "x");
      }
      const table = [...cells.entries()].map(([k, m]) => {
        const o = {};
        k.split("\u0001").forEach((v, i) => (o[rk[i]] = v));
        for (const c of colVals) o[c] = m.has(c) ? agg(m.get(c), how === "count" ? "count" : how) : null;
        if (how === "count") for (const c of colVals) if (m.has(c)) o[c] = m.get(c).length;
        return o;
      }).sort((a, b) => rk.map((c) => String(a[c]).localeCompare(String(b[c]), "ko")).find((x) => x) || 0);
      return { rows: rk, columns: ck, value: args.value || null, agg: how, columnValues: colVals, rowCount: table.length, note: [t.note, table.length > 200 ? "200행까지만 표시" : null].filter(Boolean).join(" ") || undefined, table: table.slice(0, 200) };
    }
    case "data_csv_to_json": {
      const t = parseCsv(args.csv);
      const cast = args.castNumbers !== false, limit = Math.min(1000, Math.max(1, Number(args.limit) || 100));
      const records = t.rows.slice(0, limit).map((r) => Object.fromEntries(t.headers.map((h, i) => {
        const v = r[i];
        if (cast) { const n = toNumber(v); if (!Number.isNaN(n)) return [h, n]; if (v.trim() === "") return [h, null]; }
        return [h, v];
      })));
      return { totalRows: t.rows.length, returned: records.length, columns: t.headers, note: [t.note, t.rows.length > limit ? `앞 ${limit}행만 변환 (limit로 최대 1000)` : null].filter(Boolean).join(" ") || undefined, records };
    }
    case "data_dedupe": {
      const t = parseCsv(args.csv);
      const keys = colList(args.keys, t.headers, "keys", { required: false });
      const ki = (keys.length ? keys : t.headers).map((c) => t.headers.indexOf(c));
      const keep = args.keep === "last" ? "last" : "first";
      const keyOf = (r) => ki.map((i) => r[i].trim().toLowerCase()).join("\u0001");
      const pos = new Map();
      t.rows.forEach((r, i) => { const k = keyOf(r); if (keep === "last" || !pos.has(k)) pos.set(k, i); });
      const keepIdx = new Set(pos.values());
      const kept = t.rows.filter((_, i) => keepIdx.has(i));
      const removed = t.rows.map((r, i) => [i + 2, r]).filter(([i]) => !keepIdx.has(i - 2));
      return { keys: keys.length ? keys : "모든 열", keep, originalRows: t.rows.length, keptRows: kept.length, removedCount: removed.length, removedSample: removed.slice(0, 10).map(([line, r]) => ({ line, row: Object.fromEntries(t.headers.map((h, i) => [h, r[i]])) })), note: t.note, csv: toCsv(t.headers, kept) };
    }
    case "data_join_tables": {
      const L = parseCsv(args.leftCsv), R = parseCsv(args.rightCsv);
      const on = Array.isArray(args.on) ? args.on : String(args.on || "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!on.length) throw new Error("on에 키 열 이름을 넣어 주세요.");
      for (const c of on) {
        if (!L.headers.includes(c)) throw new Error(`왼쪽 표에 '${c}' 열이 없습니다. 사용 가능: ${L.headers.join(", ")}`);
        if (!R.headers.includes(c)) throw new Error(`오른쪽 표에 '${c}' 열이 없습니다. 사용 가능: ${R.headers.join(", ")}`);
      }
      const how = args.how === "inner" ? "inner" : "left";
      const li = on.map((c) => L.headers.indexOf(c)), ri = on.map((c) => R.headers.indexOf(c));
      const rExtra = R.headers.map((h, i) => [h, i]).filter(([h]) => !on.includes(h));
      const outHeaders = [...L.headers, ...rExtra.map(([h]) => (L.headers.includes(h) ? `${h}_right` : h))];
      const index = new Map();
      for (const r of R.rows) { const k = ri.map((i) => r[i].trim()).join("\u0001"); (index.get(k) || index.set(k, []).get(k)).push(r); }
      const rows = [];
      let matched = 0, unmatched = 0;
      for (const l of L.rows) {
        const hits = index.get(li.map((i) => l[i].trim()).join("\u0001"));
        if (hits) { matched++; for (const r of hits) rows.push([...l, ...rExtra.map(([, i]) => r[i])]); }
        else { unmatched++; if (how === "left") rows.push([...l, ...rExtra.map(() => "")]); }
        if (rows.length > MAX_ROWS) break;
      }
      const capped = rows.length > MAX_ROWS;
      if (capped) rows.length = MAX_ROWS;
      return {
        how, on, leftRows: L.rows.length, rightRows: R.rows.length, resultRows: rows.length, matchedLeftRows: matched, unmatchedLeftRows: unmatched, columns: outHeaders,
        note: [L.note, R.note, capped ? `결과를 ${MAX_ROWS}행에서 잘랐습니다.` : null].filter(Boolean).join(" ") || undefined,
        records: rows.slice(0, 50).map((r) => Object.fromEntries(outHeaders.map((h, i) => [h, r[i]]))), csv: toCsv(outHeaders, rows),
        해석: `왼쪽 ${L.rows.length}행 중 ${matched}행이 짝을 찾음, ${unmatched}행은 못 찾음${how === "left" ? " (빈칸으로 유지)" : " (제외)"}. 결과 ${rows.length}행${rows.length > L.rows.length ? " — 오른쪽 키 중복으로 행이 늘었습니다" : ""}.`,
      };
    }
    case "data_normalize_dates": {
      const vals = Array.isArray(args.values) ? args.values : typeof args.values === "string" ? args.values.split(/\r?\n/) : null;
      if (!vals) throw new Error("values에 날짜 문자열 목록을 넣어 주세요.");
      const list = vals.slice(0, MAX_ROWS);
      const results = list.map((v) => ({ input: v, iso: parseDateStr(v) }));
      const unparsed = results.filter((r) => !r.iso).map((r) => r.input);
      return { count: list.length, parsed: list.length - unparsed.length, unparsedCount: unparsed.length, unparsed: unparsed.slice(0, 100), results: results.slice(0, 1000), note: vals.length > MAX_ROWS ? `${MAX_ROWS}개까지만 처리했습니다.` : undefined, 규칙: "2자리 연도는 2000년대, 'AA/BB/YYYY'는 AA가 12 이하면 미국식(월/일), 13 이상이면 일/월로 읽습니다. 'YY.MM.DD'는 한국식(연.월.일)." };
    }
    case "data_word_frequency": {
      const text = textArg(args), tok = tokenizer(args);
      const tokens = tok(text), topN = Math.min(200, Math.max(1, Number(args.topN) || 20));
      if (!tokens.length) throw new Error("불용어를 빼고 나니 남은 단어가 없습니다.");
      return { totalTokens: tokens.length, uniqueTokens: new Set(tokens).size, top: topCounts(tokens, topN), 방법: "소문자화 → 글자·숫자 외 기호로 분리 → 단어 끝 조사(은·는·이·가·을·를·의·에·에서·으로·로·와·과·도·만) 제거(남는 글자 2자 이상일 때) → 불용어·숫자 제외. 형태소 분석기는 아니라서 '고양이'→'고양'처럼 잘못 잘릴 수 있습니다." };
    }
    case "data_keyword_ngrams": {
      const text = textArg(args), n = Number(args.n) === 3 ? 3 : 2, topN = Math.min(200, Math.max(1, Number(args.topN) || 20));
      const tok = tokenizer(args), grams = [];
      for (const sent of text.split(/[.!?。\n]+/)) {
        const t = tok(sent);
        for (let i = 0; i + n <= t.length; i++) grams.push(t.slice(i, i + n).join(" "));
      }
      if (!grams.length) throw new Error(`${n}단어 묶음을 만들 만큼 단어가 없습니다.`);
      return { n, totalNgrams: grams.length, uniqueNgrams: new Set(grams).size, top: topCounts(grams, topN) };
    }
    default:
      throw new Error(`알 수 없는 데이터 도구: ${name}`);
  }
}
