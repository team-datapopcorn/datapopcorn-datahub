import { RESEARCH_TOOLS, RESEARCH_TOOL_NAMES, callResearchTool } from "../research.js";
import { run, assert } from "./_h.mjs";
assert(RESEARCH_TOOLS.length === 4 && RESEARCH_TOOL_NAMES.size === 4, "4개 아님");
await run("research", { names: RESEARCH_TOOL_NAMES, call: callResearchTool }, [
  ["wiki_get_pageviews", { article: "서울" }, (r) => (assert(r.days > 60, "days"), `${r.article}(${r.resolvedBy}) total=${r.summary.total} growth=${r.summary.growth?.changePct}%`)],
  ["wiki_get_pageviews", { article: "ChatGPT", project: "en.wikipedia", granularity: "monthly", fromDate: "2025-01-01" }, (r) => `${r.article} months=${r.days} peak=${r.summary.peak?.date}`],
  ["wiki_get_pageviews", { article: "챗지피티" }, (r) => `${r.requested} → ${r.article} (${r.resolvedBy}) total=${r.summary.total}`],
  ["wiki_compare_pageviews", { articles: ["ChatGPT", "클로드 (언어 모델)", "제미나이 (언어 모델)"] }, (r) => JSON.stringify(r.rankingByTotal)],
  ["wiki_get_summary", { title: "합계출산율" }, (r) => (assert(r.extract, "extract"), `${r.title}: ${r.extract.slice(0, 60)}`)],
  ["wiki_get_summary", { title: "Total fertility rate", lang: "en" }, (r) => r.title],
  ["paper_search_works", { query: "food delivery app restaurant", sort: "cited_by_count", limit: 5, fromYear: 2018 }, (r) => (assert(r.rows.length, "rows"), r.rows.map((x) => `${x.year} ${x.citedBy} ${x.title.slice(0, 40)}`).join(" / "))],
]);
