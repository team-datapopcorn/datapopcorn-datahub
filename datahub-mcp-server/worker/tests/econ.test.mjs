import { ECON_TOOLS, ECON_TOOL_NAMES, callEconTool } from "../econ.js";
import { run, assert } from "./_h.mjs";
assert(ECON_TOOLS.length === 7 && ECON_TOOL_NAMES.size === 7, "7개 아님");
await run("econ", { names: ECON_TOOL_NAMES, call: callEconTool }, [
  ["fx_get_latest", {}, (r) => (assert(r.rates.KRW > 500, "KRW"), r.readable.join(" | "))],
  ["fx_get_latest", { base: "KRW", symbols: ["USD", "JPY"] }, (r) => r.readable.join(" | ")],
  ["fx_get_history", { fromDate: "2026-10-01", toDate: "2026-10-31" }, (r) => (assert(r.count > 15, "count"), JSON.stringify(r.summary))],
  ["fx_convert", { amount: 1500, from: "USD", to: "KRW" }, (r) => r.readable],
  ["fx_convert", { amount: 1000000, from: "KRW", to: "JPY", date: "2025-12-31" }, (r) => r.readable],
  ["crypto_get_ticker", { markets: ["BTC", "KRW-ETH"] }, (r) => (assert(r.rows.length === 2, "rows"), r.rows.map((x) => `${x.market} ${x.price} ${x.changeRatePct}%`).join(", "))],
  ["crypto_get_candles", { market: "BTC", count: 30 }, (r) => (assert(r.rows.length === 30, "30"), JSON.stringify(r.summary))],
  ["crypto_get_candles", { market: "ETH", interval: "minutes", unit: 60, count: 24 }, (r) => r.summary.periodReturnPct + "%"],
  ["wb_get_indicator", { indicator: "fertility", countries: ["한국", "일본"], fromYear: 2015 }, (r) => r.series.map((s) => `${s.iso3} ${s.latest?.year}:${s.latest?.value}`).join(", ")],
  ["wb_get_indicator", { indicator: "co2_per_capita", countries: ["KOR"], fromYear: 2018 }, (r) => (assert(r.series[0].latest, "co2 데이터 없음"), JSON.stringify(r.series[0].latest))],
  ["wb_compare_countries", { indicator: "fertility", group: "OECD 일부", order: "desc" }, (r) => (assert(r.count > 10, "count"), r.korea)],
  ["wb_compare_countries", { indicator: "gdp_per_capita", group: "G7" }, (r) => r.korea],
  ["fx_convert", { amount: 1, from: "US", to: "KRW" }, "expectError"],
]);
