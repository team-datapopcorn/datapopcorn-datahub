// 관심도·리서치 도구: 위키백과 조회수(관심도 대리지표), 위키 요약, OpenAlex 논문 검색. 키 불필요.

const UA = "DataPopcornDataMCP/0.5 (https://api.datapopcorn.ai; contact@datapopcorn.ai)";
const READ_ONLY = { readOnlyHint: true, openWorldHint: true };
const WIKI_ATTR = "출처: Wikimedia Foundation Pageviews API / Wikipedia (본문 CC BY-SA 4.0, 조회수 데이터 CC0)";
const OPENALEX_ATTR = "출처: OpenAlex (CC0), https://openalex.org";
const PV_NOTE =
  "위키백과 조회수(사람 사용자, 봇 제외)는 '관심도'의 대리지표. 검색량·판매량과 같지 않으며, 뉴스·사건·메인 노출로 급등할 수 있음.";

export const RESEARCH_TOOLS = [
  {
    name: "wiki_get_pageviews",
    description:
      "[관심도] 위키백과 문서의 일별/월별 조회수 추이(관심도 대리지표)를 줍니다. 합계, 일평균, 최고일, 최근 30일 vs 직전 30일 증감률 포함. 기본 한국어 위키. 예: '위키백과에서 두쫀쿠 관심도 최근 3개월 추이'",
    inputSchema: {
      type: "object",
      properties: {
        article: { type: "string", description: "문서 제목 (예: 서울특별시). 정확하지 않으면 검색으로 가장 가까운 문서를 찾음" },
        project: { type: "string", description: "위키 프로젝트 (기본 ko.wikipedia, 예: en.wikipedia)" },
        granularity: { type: "string", enum: ["daily", "monthly"], description: "단위 (기본 daily)" },
        fromDate: { type: "string", description: "시작일 YYYY-MM-DD (기본: 90일 전)" },
        toDate: { type: "string", description: "종료일 YYYY-MM-DD (기본: 어제)" },
      },
      required: ["article"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "wiki_compare_pageviews",
    description:
      "[관심도] 위키백과 문서 2~5개의 같은 기간 조회수를 비교합니다(합계, 점유율, 최근 30일 증감률 순위). 예: '챗GPT, 클로드, 제미나이 위키 관심도 비교'",
    inputSchema: {
      type: "object",
      properties: {
        articles: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5, description: "비교할 문서 제목 2~5개" },
        project: { type: "string", description: "위키 프로젝트 (기본 ko.wikipedia)" },
        fromDate: { type: "string", description: "시작일 YYYY-MM-DD (기본: 90일 전)" },
        toDate: { type: "string", description: "종료일 YYYY-MM-DD (기본: 어제)" },
      },
      required: ["articles"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "wiki_get_summary",
    description:
      "[리서치] 위키백과 문서의 요약(첫 단락), 한 줄 설명, 링크를 줍니다. 리다이렉트는 따라갑니다. 예: '위키에서 합계출산율 정의 요약해줘'",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "문서 제목" },
        lang: { type: "string", enum: ["ko", "en"], description: "언어 (기본 ko)" },
      },
      required: ["title"],
    },
    annotations: READ_ONLY,
  },
  {
    name: "paper_search_works",
    description:
      "[리서치] 전 세계 학술 논문을 검색해 제목, 연도, 학술지, 저자, 피인용 수, DOI, 무료 원문 링크를 줍니다. OpenAlex를 먼저 쓰고, 한도 초과 등으로 실패하면 Crossref로 자동 전환합니다. 예: '배달앱과 외식 소비 관련 많이 인용된 논문 찾아줘'",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "검색어 (영어가 결과가 많음)" },
        fromYear: { type: "integer", description: "선택. 이 연도 이후 출판만" },
        sort: { type: "string", enum: ["relevance", "cited_by_count"], description: "정렬 (기본 relevance)" },
        limit: { type: "integer", minimum: 1, maximum: 25, description: "결과 수 (기본 10, 최대 25)" },
        openAccessOnly: { type: "boolean", description: "무료 원문이 있는 논문만" },
      },
      required: ["query"],
    },
    annotations: READ_ONLY,
  },
];

export const RESEARCH_TOOL_NAMES = new Set(RESEARCH_TOOLS.map((t) => t.name));

// ---------- 공통 ----------
async function fetchJson(url, label, { allow404 = false } = {}) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" } });
  if (allow404 && res.status === 404) return null;
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`${label} HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const iso = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
function parseDate(v) {
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})$/);
  if (!m) throw new Error(`날짜 형식은 YYYY-MM-DD 입니다: '${v}'`);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
function range(args) {
  const yesterday = new Date(Date.now() - 86400000);
  const end = args.toDate ? parseDate(args.toDate) : yesterday;
  const start = args.fromDate ? parseDate(args.fromDate) : new Date(end.getTime() - 89 * 86400000);
  if (start > end) throw new Error("fromDate가 toDate보다 늦습니다.");
  if (start < new Date(Date.UTC(2015, 6, 1))) throw new Error("위키 조회수 데이터는 2015-07-01부터 있습니다.");
  return { start, end };
}
function projectHost(project) {
  const p = String(project || "ko.wikipedia").trim();
  if (!/^[a-z-]+\.(wikipedia|wiktionary|wikinews|wikiquote|wikibooks|wikivoyage)$/.test(p)) {
    throw new Error(`project 형식 오류: '${project}' (예: ko.wikipedia, en.wikipedia)`);
  }
  return { project: p, host: `${p}.org` };
}
const toTitle = (s) => String(s).trim().replace(/ /g, "_");

// 정확한 문서 제목 찾기: 리다이렉트 해석 → 없으면 검색
async function resolveTitle(host, article) {
  const q = new URL(`https://${host}/w/api.php`);
  q.search = new URLSearchParams({ action: "query", titles: article, redirects: "1", format: "json", formatversion: "2" });
  const j = await fetchJson(q.toString(), "위키 API");
  const page = j?.query?.pages?.[0];
  if (page && !page.missing && !page.invalid) return { title: page.title, how: j.query.redirects ? "redirect" : "exact" };
  const s = new URL(`https://${host}/w/api.php`);
  s.search = new URLSearchParams({ action: "query", list: "search", srsearch: article, srlimit: "1", format: "json", formatversion: "2" });
  const sj = await fetchJson(s.toString(), "위키 검색");
  const hit = sj?.query?.search?.[0];
  if (!hit) throw new Error(`'${article}' 문서를 ${host}에서 찾지 못했습니다.`);
  return { title: hit.title, how: "search" };
}

async function pageviews(project, host, article, granularity, start, end) {
  const resolved = await resolveTitle(host, article);
  let s = ymd(start), e = ymd(end);
  if (granularity === "monthly") {
    s = s.slice(0, 6) + "01";
    e = e.slice(0, 6) + "01";
  }
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${project}/all-access/user/${encodeURIComponent(toTitle(resolved.title))}/${granularity}/${s}/${e}`;
  const j = await fetchJson(url, "Wikimedia pageviews", { allow404: true });
  const items = j?.items || [];
  const series = items.map((it) => ({ date: iso(it.timestamp.slice(0, 8)), views: it.views }));
  return { resolved, series };
}

function summarize(series, granularity) {
  const total = series.reduce((a, b) => a + b.views, 0);
  const peak = series.reduce((a, b) => (b.views > (a?.views ?? -1) ? b : a), null);
  let growth = null;
  if (granularity === "daily" && series.length >= 60) {
    const last = series.slice(-30).reduce((a, b) => a + b.views, 0);
    const prev = series.slice(-60, -30).reduce((a, b) => a + b.views, 0);
    growth = { last30: last, prior30: prev, changePct: prev ? Math.round(((last - prev) / prev) * 1000) / 10 : null };
  } else if (granularity === "monthly" && series.length >= 2) {
    const a = series[series.length - 2].views, b = series[series.length - 1].views;
    growth = { lastMonth: b, priorMonth: a, changePct: a ? Math.round(((b - a) / a) * 1000) / 10 : null, note: "마지막 달이 진행 중이면 낮게 나옴" };
  }
  return {
    total,
    avg: series.length ? Math.round((total / series.length) * 10) / 10 : 0,
    peak,
    growth,
  };
}

async function wikiPageviews(args) {
  if (!args.article) throw new Error("article이 필요합니다.");
  const { project, host } = projectHost(args.project);
  const granularity = args.granularity === "monthly" ? "monthly" : "daily";
  const { start, end } = range(args);
  const { resolved, series } = await pageviews(project, host, args.article, granularity, start, end);
  const out = series.length > 400 ? series.slice(-400) : series;
  return {
    source: "wikimedia-pageviews",
    project,
    requested: args.article,
    article: resolved.title,
    resolvedBy: resolved.how,
    granularity,
    fromDate: ymd(start).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    toDate: ymd(end).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3"),
    days: series.length,
    summary: summarize(series, granularity),
    series: out,
    truncated: series.length > 400 ? "최근 400개만 반환" : false,
    url: `https://${host}/wiki/${encodeURIComponent(toTitle(resolved.title))}`,
    note: series.length ? PV_NOTE : "이 기간 조회수 기록이 없음(문서가 새로 생겼거나 조회가 거의 없음). " + PV_NOTE,
    attribution: WIKI_ATTR,
  };
}

async function wikiCompare(args) {
  const list = Array.isArray(args.articles) ? args.articles.filter(Boolean) : [];
  if (list.length < 2 || list.length > 5) throw new Error("articles는 2~5개여야 합니다.");
  const { project, host } = projectHost(args.project);
  const { start, end } = range(args);
  const results = await Promise.all(
    list.map(async (a) => {
      try {
        const { resolved, series } = await pageviews(project, host, a, "daily", start, end);
        return { requested: a, article: resolved.title, resolvedBy: resolved.how, ...summarize(series, "daily"), days: series.length };
      } catch (e) {
        return { requested: a, error: e.message };
      }
    })
  );
  const ok = results.filter((r) => !r.error);
  const grand = ok.reduce((a, b) => a + b.total, 0);
  ok.forEach((r) => (r.sharePct = grand ? Math.round((r.total / grand) * 1000) / 10 : null));
  const byTotal = [...ok].sort((a, b) => b.total - a.total).map((r, i) => ({ rank: i + 1, article: r.article, total: r.total, sharePct: r.sharePct }));
  const byGrowth = ok
    .filter((r) => r.growth?.changePct != null)
    .sort((a, b) => b.growth.changePct - a.growth.changePct)
    .map((r, i) => ({ rank: i + 1, article: r.article, changePct: r.growth.changePct, last30: r.growth.last30, prior30: r.growth.prior30 }));
  return {
    source: "wikimedia-pageviews",
    project,
    fromDate: iso(ymd(start)),
    toDate: iso(ymd(end)),
    rankingByTotal: byTotal,
    rankingByGrowth: byGrowth.length ? byGrowth : "증감률은 기간이 60일 이상일 때 계산",
    details: results.map(({ peak, ...r }) => ({ ...r, peak })),
    note: PV_NOTE + " 언어판마다 문서 존재·제목이 달라 같은 project 안에서만 비교할 것.",
    attribution: WIKI_ATTR,
  };
}

async function wikiSummary(args) {
  if (!args.title) throw new Error("title이 필요합니다.");
  const lang = args.lang === "en" ? "en" : "ko";
  const host = `${lang}.wikipedia.org`;
  const url = `https://${host}/api/rest_v1/page/summary/${encodeURIComponent(toTitle(args.title))}?redirect=true`;
  let j = await fetchJson(url, "위키 요약", { allow404: true });
  let resolvedBy = "exact";
  if (!j) {
    const r = await resolveTitle(host, args.title);
    resolvedBy = r.how;
    j = await fetchJson(`https://${host}/api/rest_v1/page/summary/${encodeURIComponent(toTitle(r.title))}?redirect=true`, "위키 요약");
  }
  return {
    source: "wikipedia-rest-summary",
    lang,
    requested: args.title,
    title: j.title,
    resolvedBy,
    type: j.type,
    description: j.description || null,
    extract: j.extract,
    url: j.content_urls?.desktop?.page || `https://${host}/wiki/${encodeURIComponent(toTitle(j.title))}`,
    lastEdited: j.timestamp,
    note: j.type === "disambiguation" ? "동음이의어 문서임. 더 구체적인 제목으로 다시 조회할 것." : null,
    attribution: "출처: Wikipedia (CC BY-SA 4.0). 인용 시 문서 링크를 표기할 것.",
  };
}

async function openalexSearch(args, env = {}) {
  const query = String(args.query || "").trim();
  if (!query) throw new Error("query가 필요합니다.");
  const limit = Math.max(1, Math.min(Number(args.limit) || 10, 25));
  const u = new URL("https://api.openalex.org/works");
  u.searchParams.set("search", query);
  u.searchParams.set("per_page", String(limit));
  u.searchParams.set("mailto", "contact@datapopcorn.ai");
  if (env.OPENALEX_API_KEY) u.searchParams.set("api_key", env.OPENALEX_API_KEY);
  u.searchParams.set(
    "select",
    "id,doi,display_name,publication_year,cited_by_count,primary_location,open_access,authorships,type"
  );
  const filters = [];
  if (args.fromYear) filters.push(`from_publication_date:${Number(args.fromYear)}-01-01`);
  if (args.openAccessOnly) filters.push("is_oa:true");
  if (filters.length) u.searchParams.set("filter", filters.join(","));
  if (args.sort === "cited_by_count") u.searchParams.set("sort", "cited_by_count:desc");
  const j = await fetchJson(u.toString(), "OpenAlex");
  const rows = (j.results || []).map((w) => ({
    title: w.display_name,
    year: w.publication_year,
    type: w.type,
    venue: w.primary_location?.source?.display_name || null,
    authors: (w.authorships || []).slice(0, 5).map((a) => a.author?.display_name).filter(Boolean),
    citedBy: w.cited_by_count,
    doi: w.doi || null,
    openAccessUrl: w.open_access?.oa_url || null,
    openalex: w.id,
  }));
  return {
    source: "openalex",
    query,
    sort: args.sort === "cited_by_count" ? "cited_by_count desc" : "relevance",
    totalMatches: j.meta?.count ?? null,
    count: rows.length,
    rows,
    note: "피인용 수는 OpenAlex 집계 기준(구글 스칼라와 다름).",
    attribution: OPENALEX_ATTR,
  };
}

// OpenAlex 무료 한도(키 없음, IP당 일일 예산)가 Cloudflare 공용 IP에서 금방 차므로 Crossref로 대체한다.
async function crossrefSearch(args, reason) {
  const query = String(args.query || "").trim();
  if (!query) throw new Error("query가 필요합니다.");
  const limit = Math.max(1, Math.min(Number(args.limit) || 10, 25));
  const u = new URL("https://api.crossref.org/works");
  u.searchParams.set("query.bibliographic", query);
  u.searchParams.set("rows", String(limit));
  u.searchParams.set("mailto", "contact@datapopcorn.ai");
  u.searchParams.set("select", "DOI,title,issued,container-title,author,is-referenced-by-count,type,link,license");
  const filters = [];
  if (args.fromYear) filters.push(`from-pub-date:${Number(args.fromYear)}-01-01`);
  if (args.openAccessOnly) filters.push("has-license:true");
  if (filters.length) u.searchParams.set("filter", filters.join(","));
  if (args.sort === "cited_by_count") { u.searchParams.set("sort", "is-referenced-by-count"); u.searchParams.set("order", "desc"); }
  const j = await fetchJson(u.toString(), "Crossref");
  const items = j.message?.items || [];
  const rows = items.map((w) => ({
    title: (w.title || [])[0] || null,
    year: w.issued?.["date-parts"]?.[0]?.[0] ?? null,
    type: w.type,
    venue: (w["container-title"] || [])[0] || null,
    authors: (w.author || []).slice(0, 5).map((a) => [a.given, a.family].filter(Boolean).join(" ") || a.name).filter(Boolean),
    citedBy: w["is-referenced-by-count"] ?? null,
    doi: w.DOI ? `https://doi.org/${w.DOI}` : null,
    openAccessUrl: null,
  }));
  return {
    source: "crossref",
    fallbackReason: reason,
    query,
    sort: args.sort === "cited_by_count" ? "cited_by_count desc" : "relevance",
    totalMatches: j.message?.["total-results"] ?? null,
    count: rows.length,
    rows,
    note: "Crossref 기준 피인용 수(Crossref에 등록된 인용만 집계). 무료 원문 링크는 Crossref에서 제공하지 않음. openAccessOnly는 라이선스 정보가 있는 논문으로 근사.",
    attribution: "출처: Crossref 메타데이터 (CC0), https://www.crossref.org",
  };
}

async function paperSearch(args, env) {
  try {
    return await openalexSearch(args, env);
  } catch (e) {
    if (/query가 필요/.test(e.message)) throw e;
    return crossrefSearch(args, `OpenAlex 실패: ${e.message.slice(0, 80)}`);
  }
}

export async function callResearchTool(name, args = {}, env = {}) {
  switch (name) {
    case "wiki_get_pageviews": return wikiPageviews(args);
    case "wiki_compare_pageviews": return wikiCompare(args);
    case "wiki_get_summary": return wikiSummary(args);
    case "paper_search_works": return paperSearch(args, env);
    default: throw new Error(`알 수 없는 리서치 도구: ${name}`);
  }
}
