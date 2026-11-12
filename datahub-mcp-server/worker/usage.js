// 사용 기록과 관리자 통계 (D1: USAGE_DB)
// - 로그인(가입 포함)과 /mcp 호출(JSON-RPC 메시지 단위: method, 도구 이름)을 남긴다. 요청 본문(도구 인자)은 남기지 않는다.
// - /admin/stats: ADMIN_TOKEN(Bearer)으로만 읽는다. dashboard.datapopcorn.ai 서버가 대표 계정에게만 중계한다.

const kstDay = (d = new Date()) => new Date(d.getTime() + 9 * 3600e3).toISOString().slice(0, 10);

export async function recordLogin(env, user, c = {}) {
  if (!env.USAGE_DB) return;
  const now = new Date().toISOString();
  await env.USAGE_DB.batch([
    env.USAGE_DB.prepare(
      `INSERT INTO users (user_id, email, name, created_at, last_login_at, logins,
         signup_ref_source, signup_ref_host, signup_ref_medium, signup_ref_campaign, signup_ref_landing, signup_auth_referer, signup_country, signup_city, signup_device)
       VALUES (?1, ?2, ?3, ?4, ?4, 1, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
       ON CONFLICT(user_id) DO UPDATE SET email = ?2, name = ?3, last_login_at = ?4, logins = logins + 1`
    ).bind(user.userId, user.email, user.name || "", now, c.ref_source ?? null, c.ref_host ?? null, c.ref_medium ?? null, c.ref_campaign ?? null,
           c.ref_landing ?? null, c.auth_referer ?? null, c.country ?? null, c.city ?? null, c.device ?? null),
    env.USAGE_DB.prepare(
      `INSERT INTO events (ts, day, user_id, kind, country, region, city, asn_org, origin, device, os, browser, ua, ref_source, ref_medium, ref_campaign, ref_host, ref_landing, auth_referer)
       VALUES (?1, ?2, ?3, 'login', ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`
    ).bind(now, kstDay(), user.userId, c.country ?? null, c.region ?? null, c.city ?? null, c.asn_org ?? null, c.origin ?? null, c.device ?? null, c.os ?? null,
           c.browser ?? null, c.ua ? String(c.ua).slice(0, 300) : null, c.ref_source ?? null, c.ref_medium ?? null, c.ref_campaign ?? null, c.ref_host ?? null,
           c.ref_landing ?? null, c.auth_referer ?? null),
  ]);
}

export async function recordRpc(env, { userId, clientId, messages, ok, ms, ctx: c = {} }) {
  if (!env.USAGE_DB || !messages.length) return;
  const now = new Date().toISOString(), day = kstDay();
  const init = messages.find((m) => m.method === "initialize" && m.clientName);
  const app = c.app || null;
  const stmts = messages.slice(0, 20).map((m) =>
    env.USAGE_DB.prepare(
      `INSERT INTO events (ts, day, user_id, client_id, kind, method, tool, ok, ms, country, region, city, asn_org, origin, device, app, app_ver, ua)
       VALUES (?1, ?2, ?3, ?4, 'rpc', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'app', ?14, ?15, ?16)`
    ).bind(now, day, userId || null, clientId || null, String(m.method || "").slice(0, 60), m.tool ? String(m.tool).slice(0, 80) : null, ok ? 1 : 0, ms,
           c.country ?? null, c.region ?? null, c.city ?? null, c.asn_org ?? null, c.origin ?? null, app, c.app_ver ?? null, c.ua ? String(c.ua).slice(0, 300) : null)
  );
  if (clientId) {
    let name = null;
    try { name = (await env.OAUTH_PROVIDER.lookupClient(clientId))?.clientName || null; } catch {}
    stmts.push(env.USAGE_DB.prepare(`INSERT OR IGNORE INTO clients (client_id, name, first_seen) VALUES (?1, ?2, ?3)`).bind(clientId, name, now));
    if (init) stmts.push(env.USAGE_DB.prepare(`UPDATE clients SET app = ?2, app_ver = ?3 WHERE client_id = ?1`).bind(clientId, app, c.app_ver ?? null));
  }
  await env.USAGE_DB.batch(stmts);
}

function timingSafeEqual(a, b) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let r = 0;
  for (let i = 0; i < x.length; i++) r |= x[i] ^ y[i];
  return r === 0;
}

export async function handleAdmin(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/admin/stats") return null;
  const auth = request.headers.get("authorization") || "";
  if (!env.ADMIN_TOKEN || !auth.startsWith("Bearer ") || !timingSafeEqual(auth.slice(7), env.ADMIN_TOKEN)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const db = env.USAGE_DB;
  const today = kstDay(), d7 = kstDay(new Date(Date.now() - 6 * 864e5)), d30 = kstDay(new Date(Date.now() - 29 * 864e5));
  const one = async (sql, ...b) => (await db.prepare(sql).bind(...b).first()) || {};
  const all = async (sql, ...b) => (await db.prepare(sql).bind(...b).all()).results || [];
  const toolCall = `kind = 'rpc' AND method = 'tools/call'`;
  const [users, newUsers7, act1, act7, act30, calls1, calls7, calls30, errors7] = await Promise.all([
    one(`SELECT COUNT(*) n FROM users`),
    one(`SELECT COUNT(*) n FROM users WHERE substr(created_at,1,10) >= ?1`, d7),
    one(`SELECT COUNT(DISTINCT user_id) n FROM events WHERE kind='rpc' AND day = ?1`, today),
    one(`SELECT COUNT(DISTINCT user_id) n FROM events WHERE kind='rpc' AND day >= ?1`, d7),
    one(`SELECT COUNT(DISTINCT user_id) n FROM events WHERE kind='rpc' AND day >= ?1`, d30),
    one(`SELECT COUNT(*) n FROM events WHERE ${toolCall} AND day = ?1`, today),
    one(`SELECT COUNT(*) n FROM events WHERE ${toolCall} AND day >= ?1`, d7),
    one(`SELECT COUNT(*) n FROM events WHERE ${toolCall} AND day >= ?1`, d30),
    one(`SELECT COUNT(*) n FROM events WHERE kind='rpc' AND ok = 0 AND day >= ?1`, d7),
  ]);
  const [daily, signups, tools, clients, userRows, recent] = await Promise.all([
    all(`SELECT day, SUM(CASE WHEN method='tools/call' THEN 1 ELSE 0 END) calls, COUNT(DISTINCT user_id) users FROM events WHERE kind='rpc' AND day >= ?1 GROUP BY day ORDER BY day`, d30),
    all(`SELECT substr(created_at,1,10) day, COUNT(*) n FROM users WHERE substr(created_at,1,10) >= ?1 GROUP BY day ORDER BY day`, d30),
    all(`SELECT tool, COUNT(*) n, COUNT(DISTINCT user_id) users FROM events WHERE ${toolCall} AND day >= ?1 GROUP BY tool ORDER BY n DESC LIMIT 20`, d30),
    all(`SELECT COALESCE(c.name, e.client_id) client, COUNT(*) n, COUNT(DISTINCT e.user_id) users FROM events e LEFT JOIN clients c ON c.client_id = e.client_id WHERE e.kind='rpc' AND e.day >= ?1 GROUP BY client ORDER BY n DESC LIMIT 15`, d30),
    all(`SELECT u.user_id, u.email, u.name, u.created_at, u.last_login_at, u.logins, u.signup_country, u.signup_city, u.signup_device,
           COALESCE(u.signup_ref_source, u.signup_ref_host) signup_ref,
           (SELECT COALESCE(e.app, c.app, c.name) FROM events e LEFT JOIN clients c ON c.client_id = e.client_id WHERE e.user_id = u.user_id AND e.kind='rpc' ORDER BY e.id DESC LIMIT 1) last_app,
           (SELECT MAX(ts) FROM events e WHERE e.user_id = u.user_id AND e.kind='rpc') last_call,
           (SELECT COUNT(*) FROM events e WHERE e.user_id = u.user_id AND e.kind='rpc' AND e.method='tools/call' AND e.day >= ?1) calls7,
           (SELECT COUNT(*) FROM events e WHERE e.user_id = u.user_id AND e.kind='rpc' AND e.method='tools/call') calls_total
         FROM users u ORDER BY COALESCE(last_call, u.last_login_at) DESC LIMIT 500`, d7),
    all(`SELECT e.ts, e.kind, e.method, e.tool, e.ok, e.ms, u.email, COALESCE(e.app, c.app, c.name, e.client_id) client, e.country, e.city, e.origin, e.device, e.os FROM events e
         LEFT JOIN users u ON u.user_id = e.user_id LEFT JOIN clients c ON c.client_id = e.client_id
         WHERE NOT (e.kind='rpc' AND e.method IN ('notifications/initialized','ping')) ORDER BY e.id DESC LIMIT 60`),
  ]);
  const appExpr = `COALESCE(e.app, c.app, c.name, e.client_id)`;
  const [apps, countriesLogin, countriesRpc, devices, oses, browsers, referrals, authRefs, origins] = await Promise.all([
    all(`SELECT ${appExpr} AS app_label, COUNT(*) n, SUM(CASE WHEN e.method='tools/call' THEN 1 ELSE 0 END) calls, COUNT(DISTINCT e.user_id) users FROM events e LEFT JOIN clients c ON c.client_id = e.client_id WHERE e.kind='rpc' AND e.day >= ?1 GROUP BY app_label ORDER BY users DESC, n DESC LIMIT 15`, d30).then((r) => r.map(({ app_label, ...x }) => ({ app: app_label, ...x }))),
    all(`SELECT COALESCE(country,'?') country, COALESCE(city,'') city, COUNT(*) n, COUNT(DISTINCT user_id) users FROM events WHERE kind='login' AND day >= ?1 GROUP BY country, city ORDER BY users DESC, n DESC LIMIT 20`, d30),
    all(`SELECT COALESCE(country,'?') country, COALESCE(origin,'?') origin, COALESCE(asn_org,'') asn_org, COUNT(*) n, COUNT(DISTINCT user_id) users FROM events WHERE kind='rpc' AND day >= ?1 GROUP BY country, origin, asn_org ORDER BY n DESC LIMIT 20`, d30),
    all(`SELECT COALESCE(device,'?') device, COUNT(DISTINCT user_id) users, COUNT(*) n FROM events WHERE kind='login' AND day >= ?1 GROUP BY device ORDER BY users DESC`, d30),
    all(`SELECT COALESCE(os,'?') os, COUNT(DISTINCT user_id) users FROM events WHERE kind='login' AND day >= ?1 GROUP BY os ORDER BY users DESC`, d30),
    all(`SELECT COALESCE(browser,'?') browser, COUNT(DISTINCT user_id) users FROM events WHERE kind='login' AND day >= ?1 GROUP BY browser ORDER BY users DESC`, d30),
    all(`SELECT COALESCE(signup_ref_source, signup_ref_host, CASE WHEN signup_ref_landing IS NOT NULL THEN '직접 방문' END, '기록 없음') source, COALESCE(signup_ref_medium,'') medium, COALESCE(signup_ref_campaign,'') campaign, COUNT(*) n FROM users WHERE substr(created_at,1,10) >= ?1 GROUP BY source, medium, campaign ORDER BY n DESC LIMIT 20`, d30),
    all(`SELECT COALESCE(auth_referer,'(없음: 데스크톱·CLI 앱)') host, COUNT(*) n, COUNT(DISTINCT user_id) users FROM events WHERE kind='login' AND day >= ?1 GROUP BY host ORDER BY n DESC LIMIT 15`, d30),
    all(`SELECT COALESCE(origin,'?') origin, COUNT(*) n, COUNT(DISTINCT user_id) users FROM events WHERE kind='rpc' AND day >= ?1 GROUP BY origin`, d30),
  ]);
  return Response.json({
    apps, countriesLogin, countriesRpc, devices, oses, browsers, referrals, authRefs, origins,
    generatedAt: new Date().toISOString(),
    totals: {
      users: users.n || 0, newUsers7: newUsers7.n || 0,
      activeToday: act1.n || 0, active7: act7.n || 0, active30: act30.n || 0,
      callsToday: calls1.n || 0, calls7: calls7.n || 0, calls30: calls30.n || 0, errors7: errors7.n || 0,
    },
    daily, signups, tools, clients,
    users: userRows.map(({ user_id, ...u }) => u),
    recent,
  }, { headers: { "cache-control": "no-store" } });
}
