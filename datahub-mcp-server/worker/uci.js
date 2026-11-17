// UCI Machine Learning Repository 도구 (키 불필요). 강의·실습용 검증된 공개 데이터셋 검색·메타데이터·미리보기.

const UA = "DataPopcornDataMCP/0.5 (https://api.datapopcorn.ai; contact@datapopcorn.ai)";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const API = "https://archive.ics.uci.edu/api";
const LICENSE_NOTE =
  "UCI ML Repository 데이터셋은 페이지에 CC BY 4.0으로 표기됨(API 응답에는 라이선스 필드가 없음). 사용 시 데이터셋 페이지에서 라이선스를 한 번 더 확인하고 출처(DOI)를 표기할 것.";
const PREVIEW_BYTES = 200 * 1024;

const CURATED = [
  { id: 560, name: "Seoul Bike Sharing Demand", use: "서울 따릉이 시간대별 대여량과 날씨: 수요 예측·요일/날씨 효과 회귀 실습 (bike_get_daily_usage와 연결)" },
  { id: 352, name: "Online Retail", use: "영국 온라인몰 거래 54만 건: RFM 고객 세분화, 주간 매출 리포트, 재구매 분석" },
  { id: 502, name: "Online Retail II", use: "Online Retail 2년 확장판(100만 건): 코호트·리텐션 분석 (zip만 제공, CSV 미리보기 불가)" },
  { id: 222, name: "Bank Marketing", use: "포르투갈 은행 텔레마케팅 캠페인: 캠페인 반응률·타깃팅 분류 실습" },
  { id: 468, name: "Online Shoppers Purchasing Intention Dataset", use: "이커머스 세션 1.2만 건: 구매 전환율, 이탈 요인, 퍼널 분석" },
  { id: 350, name: "Default of Credit Card Clients", use: "대만 카드 고객 3만 명: 연체 예측, 리스크 세그먼트 분석" },
  { id: 603, name: "In-Vehicle Coupon Recommendation", use: "운전자 상황별 쿠폰 수락 여부: 프로모션 반응·개인화 분석" },
  { id: 186, name: "Wine Quality", use: "와인 성분과 품질 점수: 분류·회귀 입문, 상관관계 실습" },
  { id: 320, name: "Student Performance", use: "포르투갈 중등학생 성적과 생활 요인: 교육 데이터 분석, 교란변수 토론" },
  { id: 2, name: "Adult", use: "미국 인구조사 소득(5만 달러 초과 여부): 분류 고전, 공정성·편향 토론" },
  { id: 275, name: "Bike Sharing", use: "워싱턴 DC 공유자전거 시간·일별 대여: 서울 따릉이와 비교 분석" },
  { id: 360, name: "Air Quality", use: "이탈리아 도시 대기질 센서 시계열: 결측·이상치 처리, 시계열 실습" },
];

export const UCI_TOOLS = [
  {
    name: "uci_search_datasets",
    description:
      "[실습데이터] UCI 머신러닝 저장소(약 690개 공개 데이터셋)에서 이름 키워드로 검색해 id와 이름을 줍니다. 예: 'UCI에서 retail 관련 데이터셋 찾아줘'",
    inputSchema: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "검색어 (영문 데이터셋 이름 부분 일치, 여러 단어는 모두 포함)" },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "최대 결과 수 (기본 20)" },
      },
      required: ["keyword"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "uci_get_dataset",
    description:
      "[실습데이터] UCI 데이터셋 하나의 요약, 분야, 작업 유형, 행·열 수, 변수 설명, DOI와 출처 표기 문구를 줍니다. 예: 'UCI 352번 데이터셋 설명해줘'",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "UCI 데이터셋 id (예: 352)" },
        name: { type: "string", description: "id 대신 데이터셋 이름 (예: bank marketing)" },
      },
    },
    annotations: READ_ONLY,
  },
  {
    name: "uci_preview_data",
    description:
      "[실습데이터] UCI 데이터셋 CSV 앞부분(최대 50행)과 컬럼별 간단 요약(숫자/문자, 결측, 최소·최대·평균)을 줍니다. 파일 앞 200KB만 읽습니다. 예: '서울 따릉이 UCI 데이터 앞부분 보여줘'",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "UCI 데이터셋 id" },
        rows: { type: "integer", minimum: 1, maximum: 50, description: "보여줄 행 수 (기본 10)" },
      },
      required: ["id"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "uci_list_curated",
    description:
      "[실습데이터] 데이터팝콘이 비즈니스·교육 분석 실습용으로 고른 UCI 데이터셋 12개와 쓰임을 보여 줍니다. 예: '분석 실습할 만한 데이터 추천해줘'",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false },
  },
];

export const UCI_TOOL_NAMES = new Set(UCI_TOOLS.map((t) => t.name));

let listCache = null;
let listCachedAt = 0;

async function getJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`UCI API HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const j = await res.json();
  if (j.status && j.status !== 200) throw new Error(`UCI API 오류 ${j.status}: ${j.message || j.statusText || ""}`);
  return j;
}

async function loadList() {
  if (listCache && Date.now() - listCachedAt < 6 * 3600 * 1000) return listCache;
  const j = await getJson(`${API}/datasets/list`);
  listCache = (j.data || []).map((d) => ({ id: d.id, name: d.name }));
  listCachedAt = Date.now();
  return listCache;
}

async function getMeta(args) {
  let id = args.id != null ? Number(args.id) : null;
  if (!id && args.name) {
    const j = await getJson(`${API}/dataset?name=${encodeURIComponent(String(args.name))}`).catch(() => null);
    if (j?.data) return j.data;
    const q = String(args.name).toLowerCase();
    const hit = (await loadList()).find((d) => d.name.toLowerCase().includes(q));
    if (!hit) throw new Error(`'${args.name}' 이름의 UCI 데이터셋을 찾지 못했습니다. uci_search_datasets로 먼저 검색하세요.`);
    id = hit.id;
  }
  if (!Number.isInteger(id) || id <= 0) throw new Error("id(정수) 또는 name이 필요합니다.");
  const j = await getJson(`${API}/dataset?id=${id}`);
  if (!j.data) throw new Error(`UCI 데이터셋 id ${id}를 찾지 못했습니다.`);
  return j.data;
}

function attribution(d) {
  const doi = d.dataset_doi ? `https://doi.org/${d.dataset_doi}` : d.repository_url;
  const who = (d.creators || []).join(", ");
  return `${who ? who + ". " : ""}${d.name}${d.year_of_dataset_creation ? ` (${d.year_of_dataset_creation})` : ""}. UCI Machine Learning Repository. ${doi}. CC BY 4.0`;
}

async function search(args) {
  const kw = String(args.keyword || "").trim().toLowerCase();
  if (!kw) throw new Error("keyword가 필요합니다.");
  const limit = Math.max(1, Math.min(Number(args.limit) || 20, 100));
  const words = kw.split(/\s+/);
  const all = await loadList();
  const hits = all.filter((d) => words.every((w) => d.name.toLowerCase().includes(w)));
  return {
    source: "uci-ml-repository",
    keyword: args.keyword,
    totalDatasets: all.length,
    matched: hits.length,
    rows: hits.slice(0, limit),
    truncated: hits.length > limit ? `일치 ${hits.length}개 중 ${limit}개만 반환` : false,
    tip: "자세한 내용은 uci_get_dataset(id), 데이터 앞부분은 uci_preview_data(id)",
  };
}

async function getDataset(args) {
  const d = await getMeta(args);
  const vars = d.variables || [];
  const info = d.additional_info || {};
  return {
    source: "uci-ml-repository",
    id: d.uci_id,
    name: d.name,
    url: d.repository_url,
    abstract: d.abstract,
    summary: info.summary ? String(info.summary).slice(0, 1500) : null,
    area: d.area,
    tasks: d.tasks,
    characteristics: d.characteristics,
    rows: d.num_instances,
    cols: d.num_features,
    hasMissingValues: d.has_missing_values,
    target: d.target_col,
    yearCreated: d.year_of_dataset_creation,
    lastUpdated: d.last_updated,
    doi: d.dataset_doi,
    csvAvailable: !!d.data_url,
    dataUrl: d.data_url || null,
    variables: vars.slice(0, 60).map((v) => ({
      name: v.name,
      role: v.role,
      type: v.type,
      description: v.description ? String(v.description).slice(0, 200) : null,
      units: v.units,
      missing: v.missing_values,
    })),
    variablesTruncated: vars.length > 60 ? `변수 ${vars.length}개 중 60개만 반환` : false,
    attribution: attribution(d),
    license: LICENSE_NOTE,
  };
}

// 간단한 CSV 한 줄 파서(따옴표 지원)
function parseCsvLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

async function readHead(url, maxBytes) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!res.ok) throw new Error(`UCI 파일 HTTP ${res.status}`);
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0, done = false;
  while (total < maxBytes) {
    const r = await reader.read();
    if (r.done) { done = true; break; }
    chunks.push(r.value);
    total += r.value.byteLength;
  }
  if (!done) await reader.cancel().catch(() => {});
  const buf = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { buf.set(c, o); o += c.byteLength; }
  return { text: new TextDecoder("utf-8").decode(buf), complete: done, bytes: total };
}

async function preview(args) {
  const n = Math.max(1, Math.min(Number(args.rows) || 10, 50));
  const d = await getMeta({ id: args.id });
  if (!d.data_url) {
    throw new Error(`'${d.name}'(id ${d.uci_id})은 CSV(data_url)가 없고 zip 파일로만 제공됩니다. ${d.repository_url} 에서 내려받아야 합니다.`);
  }
  const { text, complete, bytes } = await readHead(d.data_url, PREVIEW_BYTES);
  let lines = text.split(/\r?\n/);
  if (!complete) lines = lines.slice(0, -1); // 잘린 마지막 줄 버림
  lines = lines.filter((l) => l.length);
  if (!lines.length) throw new Error("CSV가 비어 있습니다.");
  const header = parseCsvLine(lines[0]);
  const body = lines.slice(1).map(parseCsvLine);
  const columns = header.map((h, i) => {
    const vals = body.map((r) => r[i]);
    const missing = vals.filter((v) => v == null || v === "" || v === "?" || v === "NA").length;
    const nums = vals.map((v) => Number(v)).filter((v, k) => vals[k] !== "" && vals[k] != null && Number.isFinite(v));
    const numeric = nums.length >= (vals.length - missing) * 0.9 && nums.length > 0;
    const col = { name: h, type: numeric ? "number" : "text", missing };
    if (numeric) {
      col.min = Math.min(...nums);
      col.max = Math.max(...nums);
      col.mean = Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000;
    } else {
      const uniq = new Set(vals.filter((v) => v));
      col.distinct = uniq.size;
      col.examples = [...uniq].slice(0, 5);
    }
    return col;
  });
  return {
    source: "uci-ml-repository",
    id: d.uci_id,
    name: d.name,
    dataUrl: d.data_url,
    totalRowsInDataset: d.num_instances,
    readBytes: bytes,
    scannedRows: body.length,
    partial: !complete ? `파일 앞 ${Math.round(bytes / 1024)}KB(${body.length}행)만 읽고 요약함. 전체 통계와 다를 수 있음` : false,
    header,
    rows: body.slice(0, n).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))),
    columnSummary: columns.slice(0, 60),
    attribution: attribution(d),
    license: LICENSE_NOTE,
  };
}

function curated() {
  return {
    source: "datapopcorn-curation (UCI ML Repository)",
    count: CURATED.length,
    rows: CURATED.map((c) => ({ ...c, url: `https://archive.ics.uci.edu/dataset/${c.id}` })),
    tip: "uci_get_dataset(id)로 변수 설명, uci_preview_data(id)로 앞부분을 본 뒤 analysis_get_skill(stage=1-hypothesis)로 가설부터 시작하면 됨",
    license: LICENSE_NOTE,
  };
}

export async function callUciTool(name, args = {}, env = {}) {
  switch (name) {
    case "uci_search_datasets": return search(args);
    case "uci_get_dataset": return getDataset(args);
    case "uci_preview_data": return preview(args);
    case "uci_list_curated": return curated();
    default: throw new Error(`알 수 없는 UCI 도구: ${name}`);
  }
}

export const UCI_CURATED = CURATED;
