// 데이터팝콘 계정 로그인 (MCP OAuth 2.1)
//
// MCP 클라이언트(Claude, ChatGPT, Cursor 등)가 /mcp를 부르면 401과 함께 OAuth 메타데이터를 받는다.
// 클라이언트가 /authorize로 사용자를 보내면:
//   1) 동의 화면: 어떤 앱이, 어디(redirect 호스트)로 권한을 받는지 보여 주고 "Google로 계속하기"를 누르게 한다.
//   2) Google 로그인(OpenID Connect, PKCE). 처음 로그인하면 그게 곧 가입이다.
//   3) completeAuthorization → 클라이언트가 /token에서 토큰을 받는다(토큰·코드는 KV에 해시로만 저장).
// 비밀값: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (wrangler secret). 사용자 기록: OAUTH_KV "dp-user:<google sub>".
import { AuthorizationError, CimdFetchError, authorizationErrorRedirect } from "@cloudflare/workers-oauth-provider";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(title, body, status = 200, headers = new Headers()) {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self' https://accounts.google.com; frame-ancestors 'none'");
  headers.set("x-frame-options", "DENY");
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · 데이터팝콘</title>
<style>
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Pretendard',sans-serif;background:#f6f5fb;color:#16141f;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{background:#fff;border:1px solid #e7e5f0;border-radius:18px;max-width:440px;width:calc(100% - 32px);padding:30px 28px;box-shadow:0 10px 40px #1d14500f}
.brand{font-size:13px;font-weight:700;color:#ff3d8a;letter-spacing:.04em}
h1{font-size:21px;margin:10px 0 14px;line-height:1.4}
p{font-size:14.5px;line-height:1.65;color:#4a4858;margin:8px 0}
.box{background:#f6f5fb;border-radius:12px;padding:12px 14px;margin:14px 0;font-size:14px;line-height:1.6}
.warn{background:#fff6e5;border:1px solid #ffd99a;border-radius:12px;padding:10px 14px;font-size:13.5px;margin:12px 0}
.btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;border:1px solid #dadce0;background:#fff;border-radius:12px;padding:13px;font-size:15px;font-weight:600;cursor:pointer;color:#16141f;margin-top:10px}
.btn.primary{background:#16141f;color:#fff;border-color:#16141f}
.ghost{background:none;border:none;color:#6b6880;font-size:13.5px;cursor:pointer;width:100%;margin-top:8px;padding:8px}
.small{font-size:12px;color:#8a879a}
a{color:#5848dc}
</style></head><body><main class="card"><div class="brand">DATAPOPCORN</div>${body}</main></body></html>`, { status, headers });
}

const googleIcon = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>`;

function errorPage(message, status = 400) {
  return page("문제가 생겼어요", `<h1>로그인을 이어 갈 수 없어요</h1><p>${esc(message)}</p><p class="small">연결하려던 앱에서 다시 시작해 주세요.</p>`, status);
}

function handleAuthError(err) {
  if (err instanceof AuthorizationError && err.redirectTo) return Response.redirect(err.redirectTo, 302);
  if (err instanceof AuthorizationError) return errorPage(err.description || "요청이 올바르지 않거나 시간이 지났어요.");
  if (err instanceof CimdFetchError) return errorPage("연결하려는 앱의 정보를 확인할 수 없어요.");
  throw err;
}

async function s256(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function consentBody(d, handle) {
  const scopes = (d.scope || []).map((s) => `<input type="hidden" name="scope" value="${esc(s)}">`).join("");
  const origin = d.clientDomain
    ? `게시자: <strong>${esc(d.clientDomain)}</strong>`
    : `<span class="small">앱 이름은 앱이 스스로 등록한 값이라 확인되지 않았어요.</span>`;
  return `<h1><strong>${esc(d.clientName)}</strong> 앱이<br>데이터팝콘 데이터 MCP를 쓰려고 해요</h1>
<div class="box">${origin}<br>권한을 받을 곳: <strong>${esc(d.redirectHost)}</strong><br>권한: 데이터 MCP 도구 호출 (읽기 전용)</div>
${d.redirectIsLoopback ? '<div class="warn">이 컴퓨터에서 실행 중인 앱으로 권한이 전달돼요. 방금 직접 연결을 시작했을 때만 계속하세요.</div>' : ""}
<form method="post" action="/authorize">
<input type="hidden" name="handle" value="${esc(handle)}">${scopes}
<button class="btn" name="decision" value="approve">${googleIcon} Google로 계속하기</button>
<button class="ghost" name="decision" value="deny">취소</button>
</form>
<p class="small">처음이면 Google 로그인과 함께 데이터팝콘 계정이 만들어져요. 이메일·이름만 받고 다른 Google 데이터에는 접근하지 않아요. 계속하면 <a href="https://datapopcorn.ai/privacy" target="_blank" rel="noopener">개인정보처리방침</a>에 동의하게 됩니다.</p>`;
}

async function upsertUser(env, info) {
  const key = `dp-user:${info.sub}`;
  const prev = await env.OAUTH_KV.get(key, "json");
  const now = new Date().toISOString();
  const user = {
    sub: info.sub,
    email: info.email,
    name: info.name || "",
    createdAt: prev?.createdAt || now,
    lastLoginAt: now,
    logins: (prev?.logins || 0) + 1,
    blocked: prev?.blocked || false,
  };
  await env.OAUTH_KV.put(key, JSON.stringify(user));
  return user;
}

export async function handleAuthRoutes(request, env) {
  const url = new URL(request.url);
  const oauth = env.OAUTH_PROVIDER;

  if (url.pathname === "/authorize" && request.method === "GET") {
    try {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page("연결 허용", consentBody(details, consent.handle), 200, consent.headers);
    } catch (err) {
      return handleAuthError(err);
    }
  }

  if (url.pathname === "/authorize" && request.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return errorPage("로그인 설정이 아직 끝나지 않았어요.", 503);
    try {
      const form = await request.formData();
      const handle = String(form.get("handle") || "");
      if (form.get("decision") !== "approve") {
        const denied = await oauth.denyConsent(request, handle);
        return new Response(null, { status: 302, headers: denied.headers });
      }
      const approved = await oauth.approveConsent(request, handle, { scope: form.getAll("scope").map(String) });
      const verifier = randomString(48);
      const { state, headers } = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
      const g = new URL(GOOGLE_AUTH);
      g.searchParams.set("client_id", env.GOOGLE_CLIENT_ID);
      g.searchParams.set("redirect_uri", `${url.origin}/callback`);
      g.searchParams.set("response_type", "code");
      g.searchParams.set("scope", "openid email profile");
      g.searchParams.set("state", state);
      g.searchParams.set("code_challenge", await s256(verifier));
      g.searchParams.set("code_challenge_method", "S256");
      g.searchParams.set("prompt", "select_account");
      headers.set("Location", g.toString());
      return new Response(null, { status: 302, headers });
    } catch (err) {
      return handleAuthError(err);
    }
  }

  if (url.pathname === "/callback" && request.method === "GET") {
    try {
      const { request: original, data, headers } = await oauth.finishUpstream(request);
      if (url.searchParams.get("error") || !url.searchParams.get("code")) {
        headers.set("Location", authorizationErrorRedirect(original, "access_denied"));
        return new Response(null, { status: 302, headers });
      }
      const tok = await fetch(GOOGLE_TOKEN, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: url.searchParams.get("code"),
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/callback`,
          grant_type: "authorization_code",
          code_verifier: data.verifier,
        }),
      });
      if (!tok.ok) return errorPage("Google 로그인을 확인하지 못했어요.", 502);
      const { access_token } = await tok.json();
      const ui = await fetch(GOOGLE_USERINFO, { headers: { authorization: `Bearer ${access_token}` } });
      if (!ui.ok) return errorPage("Google 계정 정보를 받지 못했어요.", 502);
      const info = await ui.json();
      if (!info.sub || !info.email || info.email_verified !== true) return errorPage("이메일 인증이 끝난 Google 계정만 쓸 수 있어요.", 403);
      const user = await upsertUser(env, info);
      if (user.blocked) return errorPage("이 계정은 사용이 중지됐어요. contact@datapopcorn.ai로 문의해 주세요.", 403);
      const { redirectTo } = await oauth.completeAuthorization({
        request: original,
        userId: `google_${info.sub}`,
        metadata: { email: info.email },
        scope: original.scope,
        props: { userId: `google_${info.sub}`, email: info.email, name: info.name || "" },
      });
      headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers });
    } catch (err) {
      return handleAuthError(err);
    }
  }

  return null;
}
