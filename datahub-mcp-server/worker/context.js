// 요청 맥락 추출: 위치(Cloudflare cf), 기기(User-Agent), MCP 앱 이름, 유입 경로 쿠키.
// IP 원문은 다루지 않는다. 위치는 Cloudflare가 붙여 주는 국가·지역·도시·네트워크 조직명만 쓴다.

const CLOUD_ASN = /amazon|aws|google|microsoft|azure|cloudflare|digitalocean|oracle|alibaba|tencent|hetzner|ovh|linode|akamai|fastly|vercel|anthropic|openai|fly\.io|vultr|naver cloud|kt cloud|nhn/i;

export function geo(request) {
  const cf = request.cf || {};
  const asnOrg = cf.asOrganization || null;
  return {
    country: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    asn_org: asnOrg,
    origin: asnOrg ? (CLOUD_ASN.test(asnOrg) ? "cloud" : "local") : null,
  };
}

// 브라우저 UA(로그인 화면) → 기기·OS·브라우저
export function browserInfo(ua = "") {
  const device = /iPad|Tablet/i.test(ua) ? "tablet" : /Mobi|Android|iPhone/i.test(ua) ? "mobile" : ua ? "desktop" : null;
  const os = /iPhone|iPad|iOS/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS X|Macintosh/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : null;
  const browser = /KAKAOTALK/i.test(ua) ? "카카오톡" : /NAVER|Whale/i.test(ua) ? "네이버·웨일" : /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "삼성 인터넷" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : null;
  return { device, os, browser };
}

// MCP 앱 이름 정규화: initialize의 clientInfo.name 또는 요청 User-Agent
const APPS = [
  [/claude[-_ ]?code/i, "Claude Code"],
  [/claude[-_ ]?(ai|desktop)|anthropic|claude/i, "Claude"],
  [/codex/i, "Codex"],
  [/openai|chatgpt/i, "ChatGPT"],
  [/cursor/i, "Cursor"],
  [/aside/i, "Aside"],
  [/windsurf|codeium/i, "Windsurf"],
  [/gemini/i, "Gemini CLI"],
  [/vscode|visual studio code|copilot/i, "VS Code"],
  [/zed/i, "Zed"],
  [/cline/i, "Cline"],
  [/goose/i, "Goose"],
  [/n8n/i, "n8n"],
  [/mcp-inspector|inspector/i, "MCP Inspector"],
  [/^(node|undici|python-httpx|python-requests|axios|curl|go-http-client)/i, "직접 호출(코드)"],
];
export function appName(name = "", ua = "") {
  for (const src of [name, ua]) {
    if (!src) continue;
    for (const [re, label] of APPS) if (re.test(src)) return label;
  }
  return name ? String(name).slice(0, 40) : null;
}

// 첫 방문 유입 쿠키(dp_mcp_ref): datapopcorn.ai/data-mcp 또는 이 서버 첫 화면에서 심는다.
export function readRef(request) {
  const m = (request.headers.get("cookie") || "").match(/(?:^|;\s*)dp_mcp_ref=([^;]+)/);
  if (!m) return {};
  try {
    const j = JSON.parse(atob(decodeURIComponent(m[1]).replace(/-/g, "+").replace(/_/g, "/")));
    const s = (v, n = 80) => (v ? String(v).slice(0, n) : null);
    return { ref_source: s(j.s), ref_medium: s(j.m), ref_campaign: s(j.c), ref_host: s(j.h), ref_landing: s(j.p, 120) };
  } catch {
    return {};
  }
}

export function hostOf(u) {
  try { return new URL(u).hostname; } catch { return null; }
}
