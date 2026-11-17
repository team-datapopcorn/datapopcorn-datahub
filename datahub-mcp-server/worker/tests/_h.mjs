export async function run(label, mod, cases) {
  let pass = 0, fail = 0;
  const names = [...mod.names];
  const covered = new Set(cases.map((c) => c[0]));
  for (const n of names) if (!covered.has(n)) { console.log(`FAIL ${n}: 테스트 없음`); fail++; }
  for (const [name, args, check] of cases) {
    try {
      const r = await mod.call(name, args, {});
      JSON.stringify(r);
      if (!r.source) throw new Error("source 없음");
      const msg = check ? check(r) : "";
      console.log(`ok   ${name} ${msg || ""}`);
      pass++;
    } catch (e) {
      if (check === "expectError") { console.log(`ok   ${name} (expected error: ${e.message.slice(0, 80)})`); pass++; continue; }
      console.log(`FAIL ${name} ${JSON.stringify(args)}: ${e.message}`);
      fail++;
    }
  }
  console.log(`${label}: ${pass} passed, ${fail} failed`);
  if (fail) process.exitCode = 1;
}
export function assert(c, m) { if (!c) throw new Error(m); }
