import { UCI_TOOLS, UCI_TOOL_NAMES, callUciTool, UCI_CURATED } from "../uci.js";
import { run, assert } from "./_h.mjs";
assert(UCI_TOOLS.length === 4 && UCI_TOOL_NAMES.size === 4, "4개 아님");
await run("uci", { names: UCI_TOOL_NAMES, call: callUciTool }, [
  ["uci_search_datasets", { keyword: "retail" }, (r) => (assert(r.matched >= 2, "retail"), r.rows.map((x) => x.id + ":" + x.name).join(", "))],
  ["uci_get_dataset", { id: 352 }, (r) => (assert(r.doi && r.variables.length, "meta"), r.attribution)],
  ["uci_get_dataset", { name: "bank marketing" }, (r) => `${r.id} ${r.name} rows=${r.rows}`],
  ["uci_preview_data", { id: 560, rows: 5 }, (r) => (assert(r.rows.length === 5, "5행"), r.header.slice(0, 5).join(",") + ` scanned=${r.scannedRows}`)],
  ["uci_preview_data", { id: 352, rows: 3 }, (r) => `partial=${!!r.partial} ${r.columnSummary.map((c) => c.name + ":" + c.type).join(",")}`],
  ["uci_preview_data", { id: 502 }, "expectError"],
  ["uci_list_curated", {}, (r) => (assert(r.count === 12, "12"), "12개")],
]);
// 큐레이션 이름 검증
let bad = 0;
for (const c of UCI_CURATED) {
  const r = await callUciTool("uci_get_dataset", { id: c.id });
  if (r.name !== c.name) { console.log(`FAIL curated ${c.id}: '${c.name}' != '${r.name}'`); bad++; }
}
console.log(`uci curated names: ${UCI_CURATED.length - bad}/${UCI_CURATED.length} match`);
if (bad) process.exitCode = 1;
