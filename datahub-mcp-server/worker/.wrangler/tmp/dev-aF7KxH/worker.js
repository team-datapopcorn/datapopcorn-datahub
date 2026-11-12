var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
import LANDING_PAGE from "./ec6117d32d4e620bda7b34478e4b65b018fcda14-landing.html";

// node_modules/@cloudflare/workers-oauth-provider/dist/oauth-provider.js
import { WorkerEntrypoint } from "cloudflare:workers";
var OAUTH_SCOPE_TOKEN_PATTERN = /^[\x21\x23-\x5B\x5D-\x7E]+$/;
function authorizationErrorRedirect(request, code, description) {
  const redirect = new URL(request.redirectUri);
  for (const key of ERROR_RESPONSE_PARAMETERS) redirect.searchParams.delete(key);
  redirect.searchParams.set("error", code);
  if (description) redirect.searchParams.set("error_description", description);
  if (request.state) redirect.searchParams.set("state", request.state);
  if (request.issuer) redirect.searchParams.set("iss", request.issuer);
  return redirect.href;
}
__name(authorizationErrorRedirect, "authorizationErrorRedirect");
var ERROR_RESPONSE_PARAMETERS = [
  "error",
  "error_description",
  "error_uri",
  "state",
  "iss"
];
var AuthorizationError = class extends Error {
  static {
    __name(this, "AuthorizationError");
  }
  constructor(code, options) {
    super(options.description);
    this.name = "AuthorizationError";
    this.code = code;
    this.description = options.description;
    this.redirectUri = options.redirectUri;
    this.state = options.state;
    this.issuer = options.issuer;
    this.redirectTo = options.redirectUri ? safeErrorRedirect(code, options) : void 0;
  }
};
function safeErrorRedirect(code, options) {
  try {
    return authorizationErrorRedirect({
      redirectUri: options.redirectUri,
      state: options.state,
      issuer: options.issuer
    }, code, options.description);
  } catch {
    return;
  }
}
__name(safeErrorRedirect, "safeErrorRedirect");
function withAuthorizationRedirect(error, redirectUri, state, issuer) {
  return new AuthorizationError(error.code, {
    description: error.description,
    redirectUri,
    state,
    issuer
  });
}
__name(withAuthorizationRedirect, "withAuthorizationRedirect");
function buildOAuthServerCapabilities(options) {
  return {
    grantTypes: [
      "authorization_code",
      "refresh_token",
      ...options.allowTokenExchangeGrant ? ["urn:ietf:params:oauth:grant-type:token-exchange"] : [],
      ...options.enterpriseManagedAuthorization ? ["urn:ietf:params:oauth:grant-type:jwt-bearer"] : []
    ],
    responseTypes: ["code"],
    tokenEndpointAuthMethods: [
      "client_secret_basic",
      "client_secret_post",
      "none"
    ],
    codeChallengeMethods: ["S256"],
    allowPrivateUseRedirectUris: options.allowPrivateUseRedirectUris
  };
}
__name(buildOAuthServerCapabilities, "buildOAuthServerCapabilities");
function validateClientCapabilities(server, client) {
  if (!server.tokenEndpointAuthMethods.includes(client.tokenEndpointAuthMethod)) throw new Error(`Unsupported token_endpoint_auth_method: ${client.tokenEndpointAuthMethod}`);
  const unsupportedGrant = client.grantTypes.find((grantType) => !server.grantTypes.includes(grantType));
  if (unsupportedGrant) throw new Error(`Unsupported grant_type: ${unsupportedGrant}`);
  const unsupportedResponse = client.responseTypes.find((responseType) => !server.responseTypes.includes(responseType));
  if (unsupportedResponse) throw new Error(`Unsupported response_type: ${unsupportedResponse}`);
  if (client.grantTypes.includes("authorization_code") !== client.responseTypes.includes("code")) throw new Error("grant_types authorization_code and response_types code must be registered together");
}
__name(validateClientCapabilities, "validateClientCapabilities");
var SHARED_SECRET_TOKEN_ENDPOINT_AUTH_METHODS = /* @__PURE__ */ new Set([
  "client_secret_basic",
  "client_secret_post",
  "client_secret_jwt"
]);
function negotiateTokenEndpointAuthMethod(options) {
  const { acceptedMethods, defaultMethod, preferredMethod, supportedMethods, context } = options;
  if (preferredMethod !== void 0 && supportedMethods !== void 0 && !supportedMethods.includes(preferredMethod)) throw new Error("token_endpoint_auth_method must be included in token_endpoint_auth_methods_supported");
  const advertisedMethods = supportedMethods ?? [preferredMethod ?? defaultMethod];
  const effectiveMethod = preferredMethod !== void 0 && acceptedMethods.includes(preferredMethod) ? preferredMethod : acceptedMethods.find((method) => advertisedMethods.includes(method));
  if (effectiveMethod !== void 0) return effectiveMethod;
  const advertised = [.../* @__PURE__ */ new Set([...preferredMethod === void 0 ? [] : [preferredMethod], ...advertisedMethods])];
  throw new Error(`${context} does not support an accepted token endpoint authentication method. Supported methods: ${acceptedMethods.join(", ")}. Client advertised: ${advertised.length > 0 ? advertised.join(", ") : "(none)"}`);
}
__name(negotiateTokenEndpointAuthMethod, "negotiateTokenEndpointAuthMethod");
var PRIVATE_KEY_JWT = "private_key_jwt";
function negotiateCimdTokenEndpointAuthMethods(server, preferredMethod, supportedMethods, privateKeyJwt) {
  if (preferredMethod !== void 0 && SHARED_SECRET_TOKEN_ENDPOINT_AUTH_METHODS.has(preferredMethod)) throw new Error(`CIMD clients cannot use symmetric token endpoint authentication method: ${preferredMethod}`);
  if (preferredMethod !== void 0 && supportedMethods !== void 0 && !supportedMethods.includes(preferredMethod)) throw new Error("token_endpoint_auth_method must be included in token_endpoint_auth_methods_supported");
  const acceptedMethods = [...server.tokenEndpointAuthMethods.filter((method) => !SHARED_SECRET_TOKEN_ENDPOINT_AUTH_METHODS.has(method)), ...privateKeyJwt ? [PRIVATE_KEY_JWT] : []];
  const advertisedMethods = supportedMethods ?? [preferredMethod ?? "none"];
  const methods = acceptedMethods.filter((method) => advertisedMethods.includes(method));
  if (methods.length > 0) return methods;
  const advertised = [.../* @__PURE__ */ new Set([...preferredMethod === void 0 ? [] : [preferredMethod], ...advertisedMethods])];
  throw new Error(`CIMD client does not support an accepted token endpoint authentication method. Supported methods: ${acceptedMethods.join(", ")}. Client advertised: ${advertised.length > 0 ? advertised.join(", ") : "(none)"}`);
}
__name(negotiateCimdTokenEndpointAuthMethods, "negotiateCimdTokenEndpointAuthMethods");
function negotiateDynamicClientRegistrationCapabilities(server, client) {
  const effective = {
    grantTypes: [...client.grantTypes],
    responseTypes: [...client.responseTypes],
    tokenEndpointAuthMethod: negotiateTokenEndpointAuthMethod({
      acceptedMethods: server.tokenEndpointAuthMethods,
      defaultMethod: "client_secret_basic",
      preferredMethod: client.tokenEndpointAuthMethod,
      supportedMethods: client.tokenEndpointAuthMethodsSupported,
      context: "Client"
    })
  };
  validateClientCapabilities(server, effective);
  return effective;
}
__name(negotiateDynamicClientRegistrationCapabilities, "negotiateDynamicClientRegistrationCapabilities");
function negotiateCimdClientCapabilities(server, client, options = { privateKeyJwt: false }) {
  const tokenEndpointAuthMethods = negotiateCimdTokenEndpointAuthMethods(server, client.tokenEndpointAuthMethod, client.tokenEndpointAuthMethodsSupported, options.privateKeyJwt);
  const effective = {
    grantTypes: client.grantTypes.filter((grantType) => server.grantTypes.includes(grantType)),
    responseTypes: client.responseTypes.filter((responseType) => server.responseTypes.includes(responseType)),
    tokenEndpointAuthMethod: tokenEndpointAuthMethods[0],
    tokenEndpointAuthMethods
  };
  validateClientCapabilities({
    ...server,
    tokenEndpointAuthMethods: [...server.tokenEndpointAuthMethods, PRIVATE_KEY_JWT]
  }, effective);
  return effective;
}
__name(negotiateCimdClientCapabilities, "negotiateCimdClientCapabilities");
function validateAuthorizationResponseType(server, responseType, clientResponseTypes) {
  if (!responseType) throw new AuthorizationError("invalid_request", { description: "response_type is required" });
  if (!server.responseTypes.includes(responseType)) throw new AuthorizationError("unsupported_response_type", { description: `The authorization server does not support response_type ${responseType}` });
  if (!(clientResponseTypes ?? ["code"]).includes(responseType)) throw new AuthorizationError("unauthorized_client", { description: `The client is not registered for response_type ${responseType}` });
}
__name(validateAuthorizationResponseType, "validateAuthorizationResponseType");
function normalizePkceCodeChallengeMethod(method) {
  const effectiveMethod = method ?? "plain";
  if (effectiveMethod !== "plain" && effectiveMethod !== "S256") throw new AuthorizationError("invalid_request", { description: `Unsupported PKCE code_challenge_method: ${effectiveMethod}` });
  return effectiveMethod;
}
__name(normalizePkceCodeChallengeMethod, "normalizePkceCodeChallengeMethod");
function validatePkceCodeChallengeMethod(server, method) {
  const effectiveMethod = normalizePkceCodeChallengeMethod(method);
  if (!server.codeChallengeMethods.includes(effectiveMethod)) throw new AuthorizationError("invalid_request", { description: "The plain PKCE method is not allowed. Use S256 instead." });
  return effectiveMethod;
}
__name(validatePkceCodeChallengeMethod, "validatePkceCodeChallengeMethod");
function validateAuthorizationPkce(server, request, client) {
  if (request.codeChallenge) {
    validatePkceCodeChallengeMethod(server, request.codeChallengeMethod);
    return;
  }
  if (request.codeChallengeMethod) throw new AuthorizationError("invalid_request", { description: "PKCE code_challenge is required when code_challenge_method is provided." });
  if (request.responseType === "code" && client.tokenEndpointAuthMethod === "none") throw new AuthorizationError("invalid_request", { description: "Public clients must use PKCE with the authorization code flow." });
}
__name(validateAuthorizationPkce, "validateAuthorizationPkce");
function validateAuthorizationServerScopes(scopes) {
  if (!scopes) return;
  if (scopes.some((scope) => !isValidOAuthScopeToken(scope))) throw new TypeError("scopesSupported must contain valid OAuth scope tokens");
  if (new Set(scopes).size !== scopes.length) throw new TypeError("scopesSupported must not contain duplicate values");
}
__name(validateAuthorizationServerScopes, "validateAuthorizationServerScopes");
function isValidOAuthScopeToken(scopeToken) {
  return OAUTH_SCOPE_TOKEN_PATTERN.test(scopeToken);
}
__name(isValidOAuthScopeToken, "isValidOAuthScopeToken");
var version = "1.2.4";
var OUTBOUND_USER_AGENT = `workers-oauth-provider/${version} (+https://github.com/cloudflare/workers-oauth-provider)`;
function withCorsHeaders(response, request) {
  const origin = request.headers.get("Origin");
  if (!origin) return response;
  const cors = new Response(response.body, response);
  const setUnlessPresent = /* @__PURE__ */ __name((name, value) => {
    if (!cors.headers.has(name)) cors.headers.set(name, value);
  }, "setUnlessPresent");
  setUnlessPresent("Access-Control-Allow-Origin", origin);
  setUnlessPresent("Access-Control-Allow-Methods", "*");
  setUnlessPresent("Access-Control-Allow-Headers", "Authorization, *");
  setUnlessPresent("Access-Control-Max-Age", "86400");
  appendHeaderValue(cors.headers, "Vary", "Origin");
  appendHeaderValue(cors.headers, "Access-Control-Expose-Headers", "WWW-Authenticate");
  appendHeaderValue(cors.headers, "Access-Control-Expose-Headers", "Retry-After");
  return cors;
}
__name(withCorsHeaders, "withCorsHeaders");
function appendHeaderValue(headers, name, value) {
  const values = (headers.get(name) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!values.some((item) => item.toLowerCase() === value.toLowerCase())) values.push(value);
  headers.set(name, values.join(", "));
}
__name(appendHeaderValue, "appendHeaderValue");
function resolveRequiredScopes(requiredScopes, deprecatedScopesSupported) {
  if (requiredScopes !== void 0 && deprecatedScopesSupported !== void 0) throw new TypeError("Set requiredScopes only: resourceMetadata.scopes_supported is deprecated in its favour");
  const scopes = requiredScopes ?? deprecatedScopesSupported;
  return scopes === void 0 ? void 0 : [...scopes];
}
__name(resolveRequiredScopes, "resolveRequiredScopes");
function baselineResourceScopes(scopes) {
  return [...new Set(scopes)].filter((scope) => scope !== "offline_access");
}
__name(baselineResourceScopes, "baselineResourceScopes");
var OAuthError = class extends Error {
  static {
    __name(this, "OAuthError");
  }
  constructor(code, options) {
    super(options.description);
    this.name = "OAuthError";
    this.code = code;
    this.options = {
      ...options,
      statusCode: options.statusCode ?? 400
    };
    this.description = this.options.description;
    this.statusCode = this.options.statusCode;
    this.headers = this.options.headers;
    this.requiredScopes = this.options.requiredScopes;
  }
};
var EMA_ID_JAG_JWT_TYPE = "oauth-id-jag+jwt";
var EMA_ID_JAG_GRANT_PROFILE = "urn:ietf:params:oauth:grant-profile:id-jag";
var EMA_MAX_JWT_BYTES = 16 * 1024;
var EMA_JWKS_MAX_SIZE_BYTES = 64 * 1024;
var EMA_JWKS_FETCH_TIMEOUT_MS = 1e4;
var EMA_DEFAULT_JWKS_CACHE_TTL_SECONDS = 300;
var EMA_DEFAULT_CLOCK_SKEW_SECONDS = 60;
var EMA_DEFAULT_MAX_ASSERTION_LIFETIME_SECONDS = 300;
var EMA_JWKS_FORCE_REFRESH_COOLDOWN_SECONDS = 30;
var EMA_JTI_MIN_TTL_SECONDS = 60;
var EMA_DEFAULT_JWT_ALGORITHM = "RS256";
var EMA_SUPPORTED_JWT_ALGORITHMS = /* @__PURE__ */ new Set(["RS256", "ES256"]);
var ok = /* @__PURE__ */ __name((value) => ({
  ok: true,
  value
}), "ok");
var err = /* @__PURE__ */ __name((error) => ({
  ok: false,
  error
}), "err");
function emaErrorToWire(e) {
  switch (e.reason) {
    case "assertion_missing":
      return {
        code: "invalid_request",
        message: "assertion is required"
      };
    case "invalid_scope_param":
      return {
        code: "invalid_request",
        message: "Invalid scope parameter format"
      };
    case "resource_invalid":
    case "resource_mismatch":
      return {
        code: "invalid_target",
        message: "Invalid resource"
      };
    case "mapper_denied":
    case "mapper_threw":
      return {
        code: "invalid_grant",
        message: "Assertion was not authorized"
      };
    case "invalid_mapped_user":
      return {
        code: "invalid_grant",
        message: "Invalid mapped user"
      };
    case "invalid_mapped_scope":
      return {
        code: "invalid_grant",
        message: "Invalid mapped scope"
      };
    case "invalid_mapped_props":
      return {
        code: "invalid_grant",
        message: "Invalid mapped props"
      };
    case "invalid_mapped_ttl":
      return {
        code: "invalid_grant",
        message: "Invalid access token TTL"
      };
    case "assertion_expired_after_processing":
      return {
        code: "invalid_grant",
        message: "Assertion has expired"
      };
    case "assertion_too_large":
    case "assertion_malformed":
    case "invalid_typ":
    case "invalid_alg":
    case "issuer_not_trusted":
    case "no_matching_key":
    case "signature_failed":
    case "jwks_fetch_failed":
    case "invalid_claim":
    case "aud_mismatch":
    case "unsupported_claim":
    case "expired":
    case "iat_in_future":
    case "nbf_in_future":
    case "lifetime_too_long":
    case "replayed":
    case "client_id_mismatch":
      return {
        code: "invalid_grant",
        message: "Invalid assertion"
      };
  }
}
__name(emaErrorToWire, "emaErrorToWire");
async function sha256Hex$1(input) {
  const data = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex$1, "sha256Hex$1");
var EMA_JTI_KV_PREFIX = "enterprise-jti:";
function createKvJtiStore(keyPrefix = EMA_JTI_KV_PREFIX) {
  return { async markUsed({ issuer, jti, exp, now, env }) {
    const ttl = Math.max(EMA_JTI_MIN_TTL_SECONDS, exp - now);
    const key = `${keyPrefix}${await sha256Hex$1(`${issuer}
${jti}`)}`;
    if (await env.OAUTH_KV.get(key)) return err({
      reason: "replayed",
      jti
    });
    await env.OAUTH_KV.put(key, "1", { expirationTtl: ttl });
    return ok(void 0);
  } };
}
__name(createKvJtiStore, "createKvJtiStore");
function createDefaultJwksProvider(opts = {}) {
  const cache = /* @__PURE__ */ new Map();
  const cacheTtl = opts.cacheTtlSeconds ?? EMA_DEFAULT_JWKS_CACHE_TTL_SECONDS;
  return { async fetch(issuer, { forceRefresh, now }) {
    const cached = cache.get(issuer.issuer);
    if (!forceRefresh && cached && cached.expiresAt > now) return ok(cached.jwks);
    if (forceRefresh && cached && cached.nextForceRefreshAllowedAt > now) return ok(cached.jwks);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), EMA_JWKS_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(issuer.jwksUri, {
        headers: {
          Accept: "application/json",
          "User-Agent": OUTBOUND_USER_AGENT
        },
        signal: abortController.signal,
        cf: { cacheEverything: true }
      });
      if (!response.ok) return err({
        reason: "jwks_fetch_failed",
        status: response.status
      });
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > EMA_JWKS_MAX_SIZE_BYTES) return err({
        reason: "jwks_fetch_failed",
        status: response.status
      });
      const rawJwks = await readJsonWithSizeLimit$1(response, EMA_JWKS_MAX_SIZE_BYTES);
      if (!rawJwks.ok) return err({ reason: "jwks_fetch_failed" });
      if (!Array.isArray(rawJwks.value.keys)) return err({ reason: "jwks_fetch_failed" });
      const jwks = { keys: rawJwks.value.keys };
      cache.delete(issuer.issuer);
      if (opts.maxEntries !== void 0 && cache.size >= opts.maxEntries) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
      }
      cache.set(issuer.issuer, {
        jwks,
        expiresAt: now + cacheTtl,
        nextForceRefreshAllowedAt: now + EMA_JWKS_FORCE_REFRESH_COOLDOWN_SECONDS
      });
      return ok(jwks);
    } catch {
      return err({ reason: "jwks_fetch_failed" });
    } finally {
      clearTimeout(timeoutId);
    }
  } };
}
__name(createDefaultJwksProvider, "createDefaultJwksProvider");
async function readJsonWithSizeLimit$1(response, maxBytes) {
  if (!response.body) return { ok: false };
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        reader.cancel();
        return { ok: false };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed = JSON.parse(new TextDecoder().decode(merged));
    if (typeof parsed !== "object" || parsed === null) return { ok: false };
    return {
      ok: true,
      value: parsed
    };
  } catch {
    return { ok: false };
  }
}
__name(readJsonWithSizeLimit$1, "readJsonWithSizeLimit$1");
function parseIdJag(assertion, maxBytes) {
  if (typeof assertion !== "string" || assertion.length === 0) return err({ reason: "assertion_missing" });
  if (assertion.length > maxBytes) return err({
    reason: "assertion_too_large",
    size: assertion.length,
    max: maxBytes
  });
  const parts = assertion.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) return err({ reason: "assertion_malformed" });
  const [encodedHeader, encodedClaims, encodedSignature] = parts;
  let header;
  let rawClaims;
  let signature;
  try {
    header = parseJwtJsonPart(encodedHeader);
    rawClaims = parseJwtJsonPart(encodedClaims);
    signature = base64UrlToBytes(encodedSignature);
  } catch {
    return err({ reason: "assertion_malformed" });
  }
  const signingInput = new TextEncoder().encode(`${encodedHeader}.${encodedClaims}`);
  return ok({
    header,
    rawClaims,
    signingInput,
    signature
  });
}
__name(parseIdJag, "parseIdJag");
function base64UrlToBytes(base64Url) {
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, "=");
  const binaryString = atob(padded);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}
__name(base64UrlToBytes, "base64UrlToBytes");
function parseJwtJsonPart(encoded) {
  try {
    const json = new TextDecoder().decode(base64UrlToBytes(encoded));
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("JWT part must be an object");
    return parsed;
  } catch {
    throw new Error("Malformed JWT part");
  }
}
__name(parseJwtJsonPart, "parseJwtJsonPart");
function selectJwk(jwks, alg, kid) {
  const matching = (jwks.keys ?? []).filter((key) => {
    if (kid && key.kid !== kid) return false;
    if (key.alg && key.alg !== alg) return false;
    if (key.use && key.use !== "sig") return false;
    if (Array.isArray(key.key_ops) && !key.key_ops.includes("verify")) return false;
    if (alg.startsWith("RS") && key.kty !== "RSA") return false;
    if (alg.startsWith("ES") && key.kty !== "EC") return false;
    return true;
  });
  if (kid) {
    const picked = matching[0];
    if (!picked) return err({
      reason: "no_matching_key",
      kid
    });
    return ok(picked);
  }
  if (matching.length !== 1) return err({ reason: "no_matching_key" });
  return ok(matching[0]);
}
__name(selectJwk, "selectJwk");
async function verifyIdJagSignature(input) {
  try {
    const { importAlgorithm, verifyAlgorithm } = getJwtCryptoAlgorithms(input.alg);
    const key = await crypto.subtle.importKey("jwk", input.jwk, importAlgorithm, false, ["verify"]);
    return await crypto.subtle.verify(verifyAlgorithm, key, input.signature, input.signingInput);
  } catch {
    return false;
  }
}
__name(verifyIdJagSignature, "verifyIdJagSignature");
function getJwtCryptoAlgorithms(alg) {
  if (alg === "RS256") {
    const algorithm = {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256"
    };
    return {
      importAlgorithm: algorithm,
      verifyAlgorithm: algorithm
    };
  }
  if (alg === "ES256") return {
    importAlgorithm: {
      name: "ECDSA",
      namedCurve: "P-256"
    },
    verifyAlgorithm: {
      name: "ECDSA",
      hash: "SHA-256"
    }
  };
  throw new Error(`Unsupported JWT alg: ${alg}`);
}
__name(getJwtCryptoAlgorithms, "getJwtCryptoAlgorithms");
var JWT_BEARER_CLIENT_ASSERTION_TYPE = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
var CLIENT_ASSERTION_ALGORITHMS = ["RS256", "ES256"];
var CLIENT_ASSERTION_MAX_BYTES = 16 * 1024;
var CLIENT_ASSERTION_CLOCK_SKEW_SECONDS = 60;
var CLIENT_ASSERTION_MAX_LIFETIME_SECONDS = 3600;
var CLIENT_JWKS_CACHE_MAX_ENTRIES = 256;
var CLIENT_ASSERTION_JTI_KV_PREFIX = "client-assertion-jti:";
var CLIENT_AUTHENTICATION_JWT_TYPES = /* @__PURE__ */ new Set(["client-authentication+jwt", "application/client-authentication+jwt"]);
function isKeyUsableForAlgorithm(key, alg) {
  if (key.use !== void 0 && key.use !== "sig") return false;
  if (key.alg !== void 0 && key.alg !== alg) return false;
  if (Array.isArray(key.key_ops) && !key.key_ops.includes("verify")) return false;
  return alg === "RS256" ? key.kty === "RSA" : key.kty === "EC" && key.crv === "P-256";
}
__name(isKeyUsableForAlgorithm, "isKeyUsableForAlgorithm");
function readClientAssertionIssuer(assertion) {
  if (typeof assertion !== "string") return void 0;
  const parsed = parseIdJag(assertion, CLIENT_ASSERTION_MAX_BYTES);
  if (!parsed.ok) return void 0;
  const iss = parsed.value.rawClaims.iss;
  return typeof iss === "string" && iss.length > 0 ? iss : void 0;
}
__name(readClientAssertionIssuer, "readClientAssertionIssuer");
function createClientAssertionVerifier() {
  const jwksProvider = createDefaultJwksProvider({ maxEntries: CLIENT_JWKS_CACHE_MAX_ENTRIES });
  const jtiStore = createKvJtiStore(CLIENT_ASSERTION_JTI_KV_PREFIX);
  return { async verify(input) {
    if (typeof input.assertion !== "string") return err({ reason: "assertion_missing" });
    const parsed = parseIdJag(input.assertion, CLIENT_ASSERTION_MAX_BYTES);
    if (!parsed.ok) return parsed;
    const header = validateHeader(parsed.value.header, input.keys.algorithms);
    if (!header.ok) return header;
    const now = Math.floor(Date.now() / 1e3);
    const claims = validateClaims(parsed.value.rawClaims, input, header.value.typed, now);
    if (!claims.ok) return claims;
    const verified = await verifySignature({
      parsed: parsed.value,
      alg: header.value.alg,
      kid: header.value.kid,
      keys: input.keys,
      jwksProvider,
      now
    });
    if (!verified.ok) return verified;
    return jtiStore.markUsed({
      issuer: input.clientId,
      jti: claims.value.jti,
      exp: claims.value.exp + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS,
      now: Math.floor(Date.now() / 1e3),
      env: input.env
    });
  } };
}
__name(createClientAssertionVerifier, "createClientAssertionVerifier");
function validateHeader(header, algorithms) {
  if (header.crit !== void 0 || header.b64 !== void 0) return err({ reason: "assertion_malformed" });
  const alg = header.alg;
  if (typeof alg !== "string" || !algorithms.includes(alg)) return err({
    reason: "invalid_alg",
    got: alg
  });
  const typ = header.typ;
  let typed = false;
  if (typ !== void 0) {
    const normalized = typeof typ === "string" ? typ.toLowerCase() : "";
    typed = CLIENT_AUTHENTICATION_JWT_TYPES.has(normalized);
    if (!typed && normalized !== "jwt") return err({
      reason: "invalid_typ",
      got: typ
    });
  }
  const kid = header.kid;
  if (kid !== void 0 && (typeof kid !== "string" || kid.length === 0)) return err({ reason: "assertion_malformed" });
  return ok({
    alg,
    kid,
    typed
  });
}
__name(validateHeader, "validateHeader");
function validateClaims(claims, input, typed, now) {
  if (claims.iss !== input.clientId) return err({
    reason: "client_id_mismatch",
    expected: input.clientId,
    got: String(claims.iss)
  });
  if (claims.sub !== input.clientId) return err({
    reason: "client_id_mismatch",
    expected: input.clientId,
    got: String(claims.sub)
  });
  const aud = claims.aud;
  if (!(typed ? aud === input.issuer : aud === input.issuer || aud === input.tokenEndpoint || Array.isArray(aud) && aud.every((value) => typeof value === "string") && (aud.includes(input.issuer) || aud.includes(input.tokenEndpoint)))) return err({
    reason: "aud_mismatch",
    expected: input.issuer,
    got: Array.isArray(aud) ? aud.map(String) : String(aud)
  });
  const exp = claims.exp;
  if (typeof exp !== "number" || !Number.isInteger(exp)) return err({
    reason: "invalid_claim",
    claim: "exp"
  });
  if (exp + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS <= now) return err({
    reason: "expired",
    exp,
    now
  });
  if (exp - now > CLIENT_ASSERTION_MAX_LIFETIME_SECONDS) return err({
    reason: "lifetime_too_long",
    lifetime: exp - now,
    max: CLIENT_ASSERTION_MAX_LIFETIME_SECONDS
  });
  const nbf = claims.nbf;
  if (nbf !== void 0) {
    if (typeof nbf !== "number" || !Number.isInteger(nbf)) return err({
      reason: "invalid_claim",
      claim: "nbf"
    });
    if (nbf > now + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS) return err({
      reason: "nbf_in_future",
      nbf,
      now,
      skew: CLIENT_ASSERTION_CLOCK_SKEW_SECONDS
    });
  }
  const iat = claims.iat;
  if (iat !== void 0) {
    if (typeof iat !== "number" || !Number.isInteger(iat)) return err({
      reason: "invalid_claim",
      claim: "iat"
    });
    if (iat > now + CLIENT_ASSERTION_CLOCK_SKEW_SECONDS) return err({
      reason: "iat_in_future",
      iat,
      now,
      skew: CLIENT_ASSERTION_CLOCK_SKEW_SECONDS
    });
  }
  const jti = claims.jti;
  if (typeof jti !== "string" || jti.length === 0) return err({
    reason: "invalid_claim",
    claim: "jti"
  });
  return ok({
    jti,
    exp
  });
}
__name(validateClaims, "validateClaims");
async function verifySignature(args) {
  const { keys, alg, kid, parsed } = args;
  const verifyWith = /* @__PURE__ */ __name(async (jwks) => {
    const jwk = selectJwk(jwks, alg, kid);
    if (!jwk.ok) return jwk;
    return await verifyIdJagSignature({
      alg,
      jwk: jwk.value,
      signingInput: parsed.signingInput,
      signature: parsed.signature
    }) ? ok(void 0) : err({ reason: "signature_failed" });
  }, "verifyWith");
  if (keys.jwks) return verifyWith(keys.jwks);
  if (!keys.jwksUri) return err({ reason: "no_matching_key" });
  const source = {
    issuer: keys.jwksUri,
    jwksUri: keys.jwksUri
  };
  const initial = await args.jwksProvider.fetch(source, {
    forceRefresh: false,
    now: args.now
  });
  if (!initial.ok) return initial;
  const result = await verifyWith(initial.value);
  if (result.ok) return result;
  const refreshed = await args.jwksProvider.fetch(source, {
    forceRefresh: true,
    now: args.now
  });
  if (!refreshed.ok) return refreshed;
  return verifyWith(refreshed.value);
}
__name(verifySignature, "verifySignature");
function isLoopbackHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "::1" || host === "[::1]") return true;
  const ipv4 = /^127\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  return ipv4 !== null && ipv4.slice(1).every((octet) => Number(octet) <= 255);
}
__name(isLoopbackHostname, "isLoopbackHostname");
function hasAcceptedCanonicalScheme(url) {
  return url.protocol === "https:" || url.protocol === "http:" && isLoopbackHostname(url.hostname);
}
__name(hasAcceptedCanonicalScheme, "hasAcceptedCanonicalScheme");
function validateResourceUri(uri) {
  if (!uri || typeof uri !== "string") return false;
  if (!/^[\x21-\x7e]+$/.test(uri) || /["\\#]/.test(uri) || !/^[A-Za-z][A-Za-z0-9+.-]*:\/\/[^/?#]+(?:\/[^?#]*)?(?:\?[^#]*)?$/.test(uri) || /%(?![0-9A-Fa-f]{2})/.test(uri) || !/^[A-Za-z0-9:/?@!$&'()*+,;=._~%\[\]-]+$/.test(uri)) return false;
  try {
    const parsed = new URL(uri);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
__name(validateResourceUri, "validateResourceUri");
function resourceMatches(requested, granted) {
  const foldedRequested = foldResourceSchemeAndHost(requested);
  const foldedGranted = foldResourceSchemeAndHost(granted);
  if (foldedRequested === void 0 || foldedGranted === void 0) return false;
  return normalizeEmptyPath(foldedRequested) === normalizeEmptyPath(foldedGranted);
}
__name(resourceMatches, "resourceMatches");
function foldResourceSchemeAndHost(resource) {
  const schemeSeparator = resource.indexOf("://");
  if (schemeSeparator <= 0) return void 0;
  const authorityStart = schemeSeparator + 3;
  const authorityEndOffset = resource.slice(authorityStart).search(/[/?#]/);
  const authorityEnd = authorityEndOffset === -1 ? resource.length : authorityStart + authorityEndOffset;
  const authority = resource.slice(authorityStart, authorityEnd);
  const hostStart = authority.lastIndexOf("@") + 1;
  let hostEnd;
  if (authority[hostStart] === "[") {
    const closingBracket = authority.indexOf("]", hostStart + 1);
    if (closingBracket === -1) return void 0;
    hostEnd = closingBracket + 1;
  } else {
    const portSeparator = authority.indexOf(":", hostStart);
    hostEnd = portSeparator === -1 ? authority.length : portSeparator;
  }
  const asciiLower = /* @__PURE__ */ __name((value) => value.replace(/[A-Z]/g, (character) => character.toLowerCase()), "asciiLower");
  return asciiLower(resource.slice(0, schemeSeparator)) + "://" + authority.slice(0, hostStart) + asciiLower(authority.slice(hostStart, hostEnd)) + authority.slice(hostEnd) + resource.slice(authorityEnd);
}
__name(foldResourceSchemeAndHost, "foldResourceSchemeAndHost");
function normalizeEmptyPath(resource) {
  const authorityStart = resource.indexOf("://") + 3;
  const pathOffset = resource.slice(authorityStart).search(/[/?#]/);
  if (pathOffset === -1) return `${resource}/`;
  const pathStart = authorityStart + pathOffset;
  return resource[pathStart] === "/" ? resource : `${resource.slice(0, pathStart)}/${resource.slice(pathStart)}`;
}
__name(normalizeEmptyPath, "normalizeEmptyPath");
function requestCarriesResourceQuery(requestUrl, resourceUrl) {
  for (const [name, value] of resourceUrl.searchParams) if (!requestUrl.searchParams.getAll(name).includes(value)) return false;
  return true;
}
__name(requestCarriesResourceQuery, "requestCarriesResourceQuery");
function findCoveringResource(requested, configured) {
  let url;
  try {
    url = new URL(requested);
  } catch {
    return;
  }
  if (url.search === "") return void 0;
  const covering = configured.map((resource) => ({
    resource,
    url: new URL(resource)
  })).filter((candidate) => candidate.url.origin === url.origin && (candidate.url.pathname || "/") === (url.pathname || "/") && requestCarriesResourceQuery(url, candidate.url)).map(({ resource, url: url$1 }) => ({
    resource,
    specificity: [...url$1.searchParams].length
  })).sort((a, b) => b.specificity - a.specificity);
  if (covering.length === 0) return void 0;
  if (covering.length > 1 && covering[0].specificity === covering[1].specificity) return void 0;
  return covering[0].resource;
}
__name(findCoveringResource, "findCoveringResource");
var CIMD_MAX_SIZE_BYTES = 5 * 1024;
var CIMD_FETCH_TIMEOUT_MS = 1e4;
var CIMD_CACHE_NAME = "workers-oauth-provider:cimd:v1";
var CIMD_CACHE_MAX_TTL_SECONDS = 10080 * 60;
function requireJsonObject(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Client metadata must be a JSON object");
  return value;
}
__name(requireJsonObject, "requireJsonObject");
function optionalString(value, fieldName) {
  if (value === void 0) return void 0;
  if (typeof value !== "string") throw new Error(`Invalid ${fieldName}: expected string, got ${typeof value}`);
  return value;
}
__name(optionalString, "optionalString");
function optionalStringArray(value, fieldName) {
  if (value === void 0) return void 0;
  if (!Array.isArray(value)) throw new Error(`Invalid ${fieldName}: expected array, got ${typeof value}`);
  if (!value.every((item) => typeof item === "string")) throw new Error(`Invalid ${fieldName}: array must contain only strings`);
  return [...value];
}
__name(optionalStringArray, "optionalStringArray");
function optionalHttpUri(value, fieldName) {
  const uri = optionalString(value, fieldName);
  if (uri === void 0) return void 0;
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`Invalid ${fieldName}: must be an absolute http: or https: URL`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error(`Invalid ${fieldName}: must be an absolute http: or https: URL`);
  return uri;
}
__name(optionalHttpUri, "optionalHttpUri");
var I18N_FIELDS = {
  client_name: "string",
  client_uri: "uri",
  logo_uri: "uri",
  tos_uri: "uri",
  policy_uri: "uri"
};
function extractI18nFields(raw) {
  const result = {};
  for (const key of Object.keys(raw)) {
    const hashIndex = key.indexOf("#");
    if (hashIndex <= 0 || hashIndex === key.length - 1) continue;
    const kind = I18N_FIELDS[key.slice(0, hashIndex)];
    if (!kind) continue;
    const value = kind === "uri" ? optionalHttpUri(raw[key], key) : optionalString(raw[key], key);
    if (value !== void 0) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : void 0;
}
__name(extractI18nFields, "extractI18nFields");
function validateChoiceConsistency(preferredName, preferredValue, choicesName, choices) {
  if (preferredValue !== void 0 && choices !== void 0 && !choices.includes(preferredValue)) throw new Error(`${preferredName} must be included in ${choicesName}`);
}
__name(validateChoiceConsistency, "validateChoiceConsistency");
function parseOAuthClientMetadata(raw) {
  const tokenEndpointAuthMethod = optionalString(raw.token_endpoint_auth_method, "token_endpoint_auth_method");
  const tokenEndpointAuthMethodsSupported = optionalStringArray(raw.token_endpoint_auth_methods_supported, "token_endpoint_auth_methods_supported");
  const tokenEndpointAuthSigningAlg = optionalString(raw.token_endpoint_auth_signing_alg, "token_endpoint_auth_signing_alg");
  const tokenEndpointAuthSigningAlgValuesSupported = optionalStringArray(raw.token_endpoint_auth_signing_alg_values_supported, "token_endpoint_auth_signing_alg_values_supported");
  validateChoiceConsistency("token_endpoint_auth_method", tokenEndpointAuthMethod, "token_endpoint_auth_methods_supported", tokenEndpointAuthMethodsSupported);
  validateChoiceConsistency("token_endpoint_auth_signing_alg", tokenEndpointAuthSigningAlg, "token_endpoint_auth_signing_alg_values_supported", tokenEndpointAuthSigningAlgValuesSupported);
  return {
    clientId: optionalString(raw.client_id, "client_id"),
    redirectUris: optionalStringArray(raw.redirect_uris, "redirect_uris"),
    clientName: optionalString(raw.client_name, "client_name"),
    clientUri: optionalHttpUri(raw.client_uri, "client_uri"),
    logoUri: optionalHttpUri(raw.logo_uri, "logo_uri"),
    policyUri: optionalHttpUri(raw.policy_uri, "policy_uri"),
    tosUri: optionalHttpUri(raw.tos_uri, "tos_uri"),
    jwksUri: optionalHttpUri(raw.jwks_uri, "jwks_uri"),
    i18n: extractI18nFields(raw),
    contacts: optionalStringArray(raw.contacts, "contacts"),
    grantTypes: optionalStringArray(raw.grant_types, "grant_types"),
    responseTypes: optionalStringArray(raw.response_types, "response_types"),
    tokenEndpointAuthMethod,
    tokenEndpointAuthMethodsSupported,
    tokenEndpointAuthSigningAlg,
    tokenEndpointAuthSigningAlgValuesSupported
  };
}
__name(parseOAuthClientMetadata, "parseOAuthClientMetadata");
function pickDisplayMetadata(metadata) {
  const { clientName, clientUri, logoUri, policyUri, tosUri, jwksUri, i18n, contacts } = metadata;
  return {
    clientName,
    clientUri,
    logoUri,
    policyUri,
    tosUri,
    jwksUri,
    i18n,
    contacts
  };
}
__name(pickDisplayMetadata, "pickDisplayMetadata");
function validateRedirectUriSafety(redirectUri) {
  const dangerousSchemes = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "mailto:",
    "blob:"
  ];
  const normalized = redirectUri.trim();
  for (let i = 0; i < normalized.length; i++) {
    const code = normalized.charCodeAt(i);
    if (code >= 0 && code <= 31 || code >= 127 && code <= 159) throw new Error("Invalid redirect URI");
  }
  const colonIndex = normalized.indexOf(":");
  if (colonIndex === -1) throw new Error("Invalid redirect URI");
  const scheme = normalized.slice(0, colonIndex + 1).toLowerCase();
  if (dangerousSchemes.includes(scheme)) throw new Error("Invalid redirect URI");
}
__name(validateRedirectUriSafety, "validateRedirectUriSafety");
function validateListedRedirectUri(redirectUri) {
  validateRedirectUriSafety(redirectUri);
  const normalized = redirectUri.trim();
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("Invalid redirect URI");
  }
  if (normalized.includes("#") || url.username || url.password) throw new Error("Invalid redirect URI");
  return url;
}
__name(validateListedRedirectUri, "validateListedRedirectUri");
function validateRedirectUri(redirectUri, server) {
  const url = validateListedRedirectUri(redirectUri);
  if (url.protocol === "https:") return;
  if (url.protocol === "http:") {
    if (isLoopbackHostname(url.hostname)) return;
    throw new Error("Redirect URI must use https, or http on a loopback host");
  }
  if (!server.allowPrivateUseRedirectUris) throw new Error("Redirect URI must use https, or http on a loopback host");
}
__name(validateRedirectUri, "validateRedirectUri");
function validateRegisteredRedirectUris(redirectUris, server) {
  if (!redirectUris || redirectUris.length === 0) throw new Error("redirect_uris is required and must not be empty");
  for (const redirectUri of redirectUris) validateListedRedirectUri(redirectUri);
  let firstRefusal;
  for (const redirectUri of redirectUris) try {
    validateRedirectUri(redirectUri, server);
    return redirectUris;
  } catch (error) {
    firstRefusal ??= error;
  }
  throw firstRefusal instanceof Error ? firstRefusal : /* @__PURE__ */ new Error("Invalid redirect URI");
}
__name(validateRegisteredRedirectUris, "validateRegisteredRedirectUris");
function requireValidRedirectUris(redirectUris, validate) {
  if (!redirectUris || redirectUris.length === 0) throw new Error("redirect_uris is required and must not be empty");
  for (const redirectUri of redirectUris) validate(redirectUri);
  return redirectUris;
}
__name(requireValidRedirectUris, "requireValidRedirectUris");
function resolveDynamicClientRegistrationMetadata(raw, server) {
  const metadata = parseOAuthClientMetadata(raw);
  const capabilities = negotiateDynamicClientRegistrationCapabilities(server, {
    tokenEndpointAuthMethod: metadata.tokenEndpointAuthMethod,
    tokenEndpointAuthMethodsSupported: metadata.tokenEndpointAuthMethodsSupported,
    grantTypes: metadata.grantTypes ?? ["authorization_code"],
    responseTypes: metadata.responseTypes ?? ["code"]
  });
  return {
    ...pickDisplayMetadata(metadata),
    redirectUris: validateRegisteredRedirectUris(metadata.redirectUris, server),
    ...capabilities,
    authMethodExplicit: metadata.tokenEndpointAuthMethod !== void 0 || metadata.tokenEndpointAuthMethodsSupported !== void 0
  };
}
__name(resolveDynamicClientRegistrationMetadata, "resolveDynamicClientRegistrationMetadata");
function rawPath(clientId) {
  const schemeEnd = clientId.indexOf("://");
  if (schemeEnd === -1) return "";
  const authorityStart = schemeEnd + 3;
  const authorityEndOffset = clientId.slice(authorityStart).search(/[/?#]/);
  if (authorityEndOffset === -1) return "";
  const pathStart = authorityStart + authorityEndOffset;
  if (clientId[pathStart] !== "/") return "";
  const pathEndOffset = clientId.slice(pathStart).search(/[?#]/);
  return pathEndOffset === -1 ? clientId.slice(pathStart) : clientId.slice(pathStart, pathStart + pathEndOffset);
}
__name(rawPath, "rawPath");
function validateClientIdentifierUrl(clientId) {
  if (clientId !== clientId.trim() || /[\x00-\x20\x7f-\x9f\\]/.test(clientId)) throw new Error("Client Identifier URL contains invalid whitespace or characters");
  if (!/^https:\/\//i.test(clientId)) throw new Error("Client Identifier URL must use an absolute HTTPS URL");
  let parsed;
  try {
    parsed = new URL(clientId);
  } catch {
    throw new Error("Client Identifier URL must be a valid HTTPS URL");
  }
  if (parsed.protocol !== "https:") throw new Error("Client Identifier URL must use HTTPS");
  if (parsed.username || parsed.password) throw new Error("Client Identifier URL must not contain userinfo");
  if (parsed.hash) throw new Error("Client Identifier URL must not contain a fragment");
  const path = rawPath(clientId);
  if (!path) throw new Error("Client Identifier URL must contain a path component");
  for (const segment of path.split("/")) {
    let decodedSegment;
    try {
      decodedSegment = decodeURIComponent(segment);
    } catch {
      throw new Error("Client Identifier URL contains invalid percent encoding");
    }
    if (decodedSegment === "." || decodedSegment === "..") throw new Error("Client Identifier URL must not contain dot path segments");
  }
}
__name(validateClientIdentifierUrl, "validateClientIdentifierUrl");
function isClientIdMetadataDocumentUrl(clientId) {
  try {
    return new URL(clientId).protocol === "https:" && rawPath(clientId) !== "";
  } catch {
    return false;
  }
}
__name(isClientIdMetadataDocumentUrl, "isClientIdMetadataDocumentUrl");
var PRIVATE_JWK_MEMBERS = /* @__PURE__ */ new Set([
  "d",
  "p",
  "q",
  "dp",
  "dq",
  "qi",
  "oth",
  "k"
]);
function parsePublicJwks(value) {
  if (value === void 0) return void 0;
  const jwks = requireJsonObject(value);
  if (!Array.isArray(jwks.keys)) throw new Error("Invalid jwks: keys must be an array");
  return { keys: jwks.keys.map((value$1) => {
    const key = requireJsonObject(value$1);
    if (Object.keys(key).some((member) => PRIVATE_JWK_MEMBERS.has(member))) throw new Error("CIMD documents must not contain private key material");
    return key;
  }) };
}
__name(parsePublicJwks, "parsePublicJwks");
function resolvePrivateKeyJwtKeys(metadata, jwks) {
  const { jwksUri } = metadata;
  if (jwks && jwksUri) return { problem: "jwks and jwks_uri must not both be present" };
  if (!jwks && !jwksUri) return { problem: "private_key_jwt requires jwks or jwks_uri" };
  if (jwks && (jwks.keys ?? []).length === 0) return { problem: "private_key_jwt jwks must contain a key" };
  if (jwksUri) {
    const url = new URL(jwksUri);
    if (url.protocol !== "https:" || url.username || url.password || url.hash) return { problem: "private_key_jwt jwks_uri must be an https: URL without userinfo or a fragment" };
  }
  const signingAlgorithms = CLIENT_ASSERTION_ALGORITHMS.filter((alg) => (metadata.tokenEndpointAuthSigningAlg === void 0 || metadata.tokenEndpointAuthSigningAlg === alg) && (metadata.tokenEndpointAuthSigningAlgValuesSupported === void 0 || metadata.tokenEndpointAuthSigningAlgValuesSupported.includes(alg)));
  if (signingAlgorithms.length === 0) return { problem: `private_key_jwt requires a token_endpoint_auth_signing_alg of ${CLIENT_ASSERTION_ALGORITHMS.join(" or ")}` };
  const algorithms = jwks ? signingAlgorithms.filter((alg) => (jwks.keys ?? []).some((key) => isKeyUsableForAlgorithm(key, alg))) : signingAlgorithms;
  if (algorithms.length === 0) return { problem: `private_key_jwt jwks has no key for ${signingAlgorithms.join(" or ")}` };
  return { keys: jwks ? {
    jwks,
    algorithms
  } : {
    jwksUri,
    algorithms
  } };
}
__name(resolvePrivateKeyJwtKeys, "resolvePrivateKeyJwtKeys");
function resolveClientIdMetadataDocument(metadataUrl, value, server) {
  const raw = requireJsonObject(value);
  const metadata = parseOAuthClientMetadata(raw);
  if (metadata.clientId !== metadataUrl) throw new Error(`client_id "${metadata.clientId}" does not match metadata URL "${metadataUrl}"`);
  if (!metadata.clientName?.trim()) throw new Error("client_name is required and must not be empty");
  const redirectUris = requireValidRedirectUris(metadata.redirectUris, validateRedirectUriSafety);
  if ("client_secret" in raw || "client_secret_expires_at" in raw) throw new Error("CIMD documents must not contain client secrets");
  const jwks = parsePublicJwks(raw.jwks);
  const privateKeyJwt = metadata.tokenEndpointAuthMethod === "private_key_jwt" || !!metadata.tokenEndpointAuthMethodsSupported?.includes("private_key_jwt") ? resolvePrivateKeyJwtKeys(metadata, jwks) : void 0;
  const clientAssertionKeys = privateKeyJwt && "keys" in privateKeyJwt ? privateKeyJwt.keys : void 0;
  let capabilities;
  try {
    capabilities = negotiateCimdClientCapabilities(server, {
      tokenEndpointAuthMethod: metadata.tokenEndpointAuthMethod,
      tokenEndpointAuthMethodsSupported: metadata.tokenEndpointAuthMethodsSupported,
      grantTypes: metadata.grantTypes ?? ["authorization_code"],
      responseTypes: metadata.responseTypes ?? ["code"]
    }, { privateKeyJwt: clientAssertionKeys !== void 0 });
  } catch (error) {
    if (privateKeyJwt && "problem" in privateKeyJwt) throw new Error(privateKeyJwt.problem);
    throw error;
  }
  return {
    ...pickDisplayMetadata(metadata),
    clientId: metadata.clientId,
    clientName: metadata.clientName,
    redirectUris,
    ...capabilities,
    ...capabilities.tokenEndpointAuthMethods.includes("private_key_jwt") ? { clientAssertionKeys } : {}
  };
}
__name(resolveClientIdMetadataDocument, "resolveClientIdMetadataDocument");
function readStreamChunk(reader, signal) {
  if (signal.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise((resolve, reject) => {
    const abort = /* @__PURE__ */ __name(() => {
      reader.cancel().catch(() => void 0);
      reject(new DOMException("Aborted", "AbortError"));
    }, "abort");
    signal.addEventListener("abort", abort, { once: true });
    reader.read().then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
__name(readStreamChunk, "readStreamChunk");
async function readJsonWithSizeLimit(response, maxBytes, signal) {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength !== null) {
    const declaredSize = Number(contentLength);
    if (Number.isFinite(declaredSize) && declaredSize > maxBytes) {
      await response.body?.cancel().catch(() => void 0);
      throw new Error(`Client metadata exceeds size limit: ${contentLength} bytes (max ${maxBytes})`);
    }
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Client metadata response body is empty");
  const chunks = [];
  let totalSize = 0;
  while (true) {
    const { done, value } = await readStreamChunk(reader, signal);
    if (done) break;
    if (!value) continue;
    totalSize += value.length;
    if (totalSize > maxBytes) {
      await reader.cancel().catch(() => void 0);
      throw new Error(`Response exceeded size limit of ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const bytes = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  let text;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: false
    }).decode(bytes);
  } catch {
    throw new Error("Client metadata response is not valid UTF-8");
  }
  try {
    return {
      value: JSON.parse(text),
      bytes
    };
  } catch {
    throw new Error("Client metadata response is not valid JSON");
  }
}
__name(readJsonWithSizeLimit, "readJsonWithSizeLimit");
function fetchCimdOrigin(metadataUrl, signal) {
  return fetch(metadataUrl, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-store",
      "User-Agent": OUTBOUND_USER_AGENT
    },
    signal,
    cache: "no-store"
  });
}
__name(fetchCimdOrigin, "fetchCimdOrigin");
async function openCimdCache() {
  if (typeof caches === "undefined") return void 0;
  try {
    return await caches.open(CIMD_CACHE_NAME);
  } catch {
    return;
  }
}
__name(openCimdCache, "openCimdCache");
function cacheTtlSeconds(response) {
  const cacheControl = response.headers.get("Cache-Control");
  if (cacheControl === null || /(?:^|,)\s*(?:no-cache|no-store|private)\b/i.test(cacheControl)) return void 0;
  const directive = /(?:^|,)\s*s-maxage\s*=\s*"?(\d+)/i.exec(cacheControl) ?? /(?:^|,)\s*max-age\s*=\s*"?(\d+)/i.exec(cacheControl);
  if (!directive) return void 0;
  const ttl = Math.min(Number(directive[1]), CIMD_CACHE_MAX_TTL_SECONDS);
  return ttl > 0 ? ttl : void 0;
}
__name(cacheTtlSeconds, "cacheTtlSeconds");
async function cacheValidatedDocument(cache, metadataUrl, response, bytes) {
  if (!cache) return;
  const ttl = cacheTtlSeconds(response);
  if (ttl === void 0) return;
  const headers = new Headers({ "Cache-Control": `public, max-age=${ttl}` });
  for (const name of [
    "Content-Type",
    "ETag",
    "Last-Modified"
  ]) {
    const value = response.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  try {
    await cache.put(metadataUrl, new Response(bytes, {
      status: 200,
      headers
    }));
  } catch {
  }
}
__name(cacheValidatedDocument, "cacheValidatedDocument");
async function tryResolveFromCache(cache, metadataUrl, server, signal) {
  let cached;
  try {
    cached = await cache?.match(metadataUrl);
  } catch {
    return;
  }
  if (!cached) return void 0;
  try {
    const { value } = await readJsonWithSizeLimit(cached, CIMD_MAX_SIZE_BYTES, signal);
    return resolveClientIdMetadataDocument(metadataUrl, value, server);
  } catch (error) {
    if (signal.aborted) throw error;
    try {
      await cache?.delete(metadataUrl);
    } catch {
    }
    return;
  }
}
__name(tryResolveFromCache, "tryResolveFromCache");
async function fetchClientIdMetadataDocument(metadataUrl, server) {
  validateClientIdentifierUrl(metadataUrl);
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), CIMD_FETCH_TIMEOUT_MS);
  try {
    const cache = await openCimdCache();
    const cachedDocument = await tryResolveFromCache(cache, metadataUrl, server, abortController.signal);
    if (cachedDocument) return cachedDocument;
    const response = await fetchCimdOrigin(metadataUrl, abortController.signal);
    if (!response.ok) throw new Error(`Failed to fetch client metadata: HTTP ${response.status}`);
    const { value, bytes } = await readJsonWithSizeLimit(response, CIMD_MAX_SIZE_BYTES, abortController.signal);
    const resolved = resolveClientIdMetadataDocument(metadataUrl, value, server);
    clearTimeout(timeoutId);
    await cacheValidatedDocument(cache, metadataUrl, response, bytes);
    return resolved;
  } catch (error) {
    if (abortController.signal.aborted) throw new Error(`Client metadata fetch timed out after ${CIMD_FETCH_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
__name(fetchClientIdMetadataDocument, "fetchClientIdMetadataDocument");
function validateIdJagHeader(header, expectedTyp, supportedAlgs) {
  const typ = header.typ;
  if (typeof typ !== "string" || typ !== expectedTyp) return err({
    reason: "invalid_typ",
    got: typ
  });
  const alg = header.alg;
  if (typeof alg !== "string" || alg === "none" || !supportedAlgs.has(alg)) return err({
    reason: "invalid_alg",
    got: alg
  });
  const kidRaw = header.kid;
  return ok({
    typ,
    alg,
    kid: typeof kidRaw === "string" && kidRaw.length > 0 ? kidRaw : void 0
  });
}
__name(validateIdJagHeader, "validateIdJagHeader");
async function resolveTrustedIssuer(input) {
  const { iss, alg, resolver, env, request, clientInfo } = input;
  if (typeof iss !== "string" || iss.length === 0) return err({
    reason: "invalid_claim",
    claim: "iss"
  });
  let resolved;
  try {
    resolved = await resolver({
      iss,
      env,
      request,
      clientInfo
    });
  } catch {
    return err({
      reason: "issuer_not_trusted",
      iss
    });
  }
  if (!resolved) return err({
    reason: "issuer_not_trusted",
    iss
  });
  if (resolved.issuer !== iss) return err({
    reason: "issuer_not_trusted",
    iss
  });
  if (!isWellFormedTrustedIssuer(resolved)) return err({
    reason: "issuer_not_trusted",
    iss
  });
  if (!(resolved.algorithms ?? [EMA_DEFAULT_JWT_ALGORITHM]).includes(alg)) return err({
    reason: "invalid_alg",
    got: alg
  });
  return ok(resolved);
}
__name(resolveTrustedIssuer, "resolveTrustedIssuer");
function isWellFormedTrustedIssuer(issuer) {
  let issuerUrl;
  try {
    issuerUrl = new URL(issuer.issuer);
  } catch {
    return false;
  }
  if (issuerUrl.protocol !== "https:") return false;
  let jwksUrl;
  try {
    jwksUrl = new URL(issuer.jwksUri);
  } catch {
    return false;
  }
  if (jwksUrl.protocol !== "https:") return false;
  const algorithms = issuer.algorithms ?? [EMA_DEFAULT_JWT_ALGORITHM];
  if (algorithms.length === 0) return false;
  for (const alg of algorithms) if (!EMA_SUPPORTED_JWT_ALGORITHMS.has(alg)) return false;
  if (issuer.audience !== void 0) try {
    new URL(issuer.audience);
  } catch {
    return false;
  }
  return true;
}
__name(isWellFormedTrustedIssuer, "isWellFormedTrustedIssuer");
function validateIdJagClaims(input) {
  const { rawClaims, trustedIssuer, expectedAudience, clientId, configuredResource } = input;
  const { now, clockSkewSeconds, maxAssertionLifetimeSeconds } = input;
  const iss = readRequiredString(rawClaims, "iss");
  if (!iss.ok) return iss;
  if (iss.value !== trustedIssuer.issuer) return err({
    reason: "issuer_not_trusted",
    iss: iss.value
  });
  const sub = readRequiredString(rawClaims, "sub");
  if (!sub.ok) return sub;
  const aud = readAudienceClaim(rawClaims);
  if (!aud.ok) return aud;
  for (const claim of ["authorization_details", "cnf"]) if (rawClaims[claim] !== void 0) return err({
    reason: "unsupported_claim",
    claim
  });
  const resource = rawClaims.resource === void 0 ? ok(configuredResource) : readRequiredString(rawClaims, "resource");
  if (!resource.ok) return resource;
  const claimClientId = readRequiredString(rawClaims, "client_id");
  if (!claimClientId.ok) return claimClientId;
  const jti = readRequiredString(rawClaims, "jti");
  if (!jti.ok) return jti;
  const exp = readNumericDateClaim(rawClaims, "exp");
  if (!exp.ok) return exp;
  const iat = readNumericDateClaim(rawClaims, "iat");
  if (!iat.ok) return iat;
  if ((Array.isArray(aud.value) ? aud.value[0] : aud.value) !== expectedAudience) return err({
    reason: "aud_mismatch",
    expected: expectedAudience,
    got: aud.value
  });
  if (claimClientId.value !== clientId) return err({
    reason: "client_id_mismatch",
    expected: clientId,
    got: claimClientId.value
  });
  if (!validateResourceUri(resource.value)) return err({
    reason: "resource_invalid",
    resource: resource.value
  });
  if (!resourceMatches(resource.value, configuredResource)) return err({
    reason: "resource_mismatch",
    expected: configuredResource,
    got: resource.value
  });
  if (exp.value + clockSkewSeconds <= now) return err({
    reason: "expired",
    exp: exp.value,
    now
  });
  if (iat.value > now + clockSkewSeconds) return err({
    reason: "iat_in_future",
    iat: iat.value,
    now,
    skew: clockSkewSeconds
  });
  if (rawClaims.nbf !== void 0) {
    const nbf = readNumericDateClaim(rawClaims, "nbf");
    if (!nbf.ok) return nbf;
    if (nbf.value > now + clockSkewSeconds) return err({
      reason: "nbf_in_future",
      nbf: nbf.value,
      now,
      skew: clockSkewSeconds
    });
  }
  const lifetime = exp.value - iat.value;
  if (lifetime > maxAssertionLifetimeSeconds + clockSkewSeconds) return err({
    reason: "lifetime_too_long",
    lifetime,
    max: maxAssertionLifetimeSeconds
  });
  let scope;
  let assertionScopes = [];
  if (rawClaims.scope !== void 0) {
    const parsed = readRequiredString(rawClaims, "scope");
    if (!parsed.ok) return parsed;
    const tokens = parsed.value.split(" ").filter(Boolean);
    for (const token of tokens) if (!isValidOAuthScopeToken(token)) return err({
      reason: "invalid_claim",
      claim: "scope"
    });
    scope = parsed.value;
    assertionScopes = tokens;
  }
  return ok({
    claims: {
      ...rawClaims,
      iss: iss.value,
      sub: sub.value,
      aud: aud.value,
      resource: resource.value,
      client_id: claimClientId.value,
      jti: jti.value,
      exp: exp.value,
      iat: iat.value,
      scope
    },
    resource: resource.value,
    assertionScopes
  });
}
__name(validateIdJagClaims, "validateIdJagClaims");
function parseEmaScopeParam(scope, assertionScopes) {
  let requested;
  if (scope === void 0) requested = [...assertionScopes];
  else if (typeof scope === "string") {
    const tokens = scope.split(" ").filter(Boolean);
    for (const token of tokens) if (!isValidOAuthScopeToken(token)) return err({ reason: "invalid_scope_param" });
    requested = tokens;
  } else if (Array.isArray(scope) && scope.every((value) => typeof value === "string")) {
    requested = [];
    for (const part of scope) {
      const tokens = part.split(" ").filter(Boolean);
      for (const token of tokens) if (!isValidOAuthScopeToken(token)) return err({ reason: "invalid_scope_param" });
      requested.push(...tokens);
    }
  } else return err({ reason: "invalid_scope_param" });
  if (assertionScopes.length > 0) {
    const allowed = new Set(assertionScopes);
    requested = requested.filter((token) => allowed.has(token));
  }
  return ok(requested);
}
__name(parseEmaScopeParam, "parseEmaScopeParam");
function validateEmaMapperResult(result) {
  if (result === null) return err({ reason: "mapper_denied" });
  if (typeof result !== "object") return err({ reason: "invalid_mapped_user" });
  const r = result;
  if (typeof r.userId !== "string" || r.userId.length === 0 || r.userId.includes(":")) return err({ reason: "invalid_mapped_user" });
  if (!Array.isArray(r.scope) || !r.scope.every((s) => typeof s === "string" && isValidOAuthScopeToken(s))) return err({ reason: "invalid_mapped_scope" });
  if (!("props" in r) || r.props === void 0) return err({ reason: "invalid_mapped_props" });
  if (r.accessTokenTTL !== void 0) {
    if (typeof r.accessTokenTTL !== "number" || !Number.isFinite(r.accessTokenTTL) || r.accessTokenTTL <= 0) return err({ reason: "invalid_mapped_ttl" });
  }
  return ok({
    userId: r.userId,
    scope: r.scope,
    props: r.props,
    metadata: r.metadata,
    accessTokenTTL: r.accessTokenTTL
  });
}
__name(validateEmaMapperResult, "validateEmaMapperResult");
function computeEmaAccessTokenTTL(input) {
  const { configuredDefaultSeconds, assertionExp, mapperTtl, now, minTtlSeconds } = input;
  if (assertionExp - now <= 0) return err({ reason: "assertion_expired_after_processing" });
  const ttl = mapperTtl ?? configuredDefaultSeconds;
  if (ttl < minTtlSeconds) return err({ reason: "invalid_mapped_ttl" });
  return ok(ttl);
}
__name(computeEmaAccessTokenTTL, "computeEmaAccessTokenTTL");
function readRequiredString(claims, claimName) {
  const value = claims[claimName];
  if (typeof value !== "string" || value.length === 0) return err({
    reason: "invalid_claim",
    claim: claimName
  });
  return ok(value);
}
__name(readRequiredString, "readRequiredString");
function readAudienceClaim(claims) {
  const aud = claims.aud;
  if (typeof aud === "string" && aud.length > 0) return ok(aud);
  if (Array.isArray(aud) && aud.length === 1 && typeof aud[0] === "string" && aud[0].length > 0) return ok(aud);
  return err({
    reason: "invalid_claim",
    claim: "aud"
  });
}
__name(readAudienceClaim, "readAudienceClaim");
function readNumericDateClaim(claims, claimName) {
  const value = claims[claimName];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return err({
    reason: "invalid_claim",
    claim: claimName
  });
  return ok(value);
}
__name(readNumericDateClaim, "readNumericDateClaim");
var TRANSACTION_TTL_SECONDS = 600;
var DEFAULT_COOKIE_PREFIX = "__Host-oauth-";
var DEFAULT_REMEMBER_SECONDS = 720 * 60 * 60;
var MIN_SECRET_LENGTH = 32;
var MAX_APPROVALS_COOKIE_BYTES = 3800;
function consentCookies(prefix = DEFAULT_COOKIE_PREFIX) {
  if (typeof prefix !== "string" || !prefix.startsWith("__Host-") || !/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(prefix)) throw new TypeError('cookiePrefix must start with "__Host-" and contain only cookie-name characters');
  return {
    consent: `${prefix}consent`,
    upstream: `${prefix}upstream`,
    approvals: `${prefix}approvals`
  };
}
__name(consentCookies, "consentCookies");
function validateRememberConsentOptions(options) {
  if (typeof options !== "object" || options === null) throw new TypeError("remember must be an object with a secret");
  if (typeof options.secret !== "string" || options.secret.length < MIN_SECRET_LENGTH) throw new TypeError(`remember.secret must be a string of at least ${MIN_SECRET_LENGTH} characters`);
  const maxAge = options.maxAgeSeconds;
  if (maxAge !== void 0 && (!Number.isInteger(maxAge) || maxAge <= 0)) throw new TypeError("remember.maxAgeSeconds must be a positive integer");
  if (options.subject !== void 0 && (typeof options.subject !== "string" || options.subject.length === 0)) throw new TypeError("remember.subject must be a non-empty string");
}
__name(validateRememberConsentOptions, "validateRememberConsentOptions");
function describeConsent(client, request, isClientIdMetadataDocument) {
  const redirectHost = new URL(request.redirectUri).hostname || request.redirectUri;
  return {
    clientId: request.clientId,
    clientName: client?.clientName?.trim() ? client.clientName : request.clientId,
    ...isClientIdMetadataDocument ? { clientDomain: new URL(request.clientId).hostname } : {},
    ...client?.clientUri ? { clientUri: client.clientUri } : {},
    ...client?.logoUri ? { logoUri: client.logoUri } : {},
    redirectUri: request.redirectUri,
    redirectHost,
    redirectIsLoopback: isLoopbackHostname(redirectHost),
    scope: [...request.scope]
  };
}
__name(describeConsent, "describeConsent");
async function beginConsent(kv, cookies, request) {
  const { handle, hash } = await createTransaction(kv, {
    kind: "consent",
    request
  });
  return {
    handle,
    headers: new Headers({
      "Set-Cookie": bindingCookie(transactionCookieName(cookies.consent, hash), hash, TRANSACTION_TTL_SECONDS),
      "Cache-Control": "no-store",
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY"
    })
  };
}
__name(beginConsent, "beginConsent");
async function approveConsent(kv, cookies, supportedScopes, request, handle, options = {}) {
  if (options.remember !== void 0) validateRememberConsentOptions(options.remember);
  const transaction = await openTransaction(kv, request, cookies.consent, handle, "consent");
  let approved = transaction.record.request;
  if (options.scope !== void 0) {
    const supported = supportedScopes ? new Set(supportedScopes) : void 0;
    const valid = /* @__PURE__ */ __name((scope) => typeof scope === "string" && isValidOAuthScopeToken(scope) && (!supported || supported.has(scope)), "valid");
    if (!Array.isArray(options.scope) || !options.scope.every(valid)) throw new AuthorizationError("invalid_scope", { description: "Approved scopes must be ones this server supports" });
    approved = {
      ...approved,
      scope: [...new Set(options.scope)]
    };
  }
  await transaction.consume();
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(transaction.cookieName));
  if (options.remember) headers.append("Set-Cookie", await rememberApproval(cookies, request, approved, options.remember));
  return {
    request: approved,
    headers
  };
}
__name(approveConsent, "approveConsent");
async function denyConsent(kv, cookies, request, handle, options = {}) {
  const transaction = await openTransaction(kv, request, cookies.consent, handle, "consent");
  await transaction.consume();
  const record = transaction.record;
  const redirectTo = authorizationErrorRedirect(record.request, "access_denied", options.description);
  const headers = new Headers({
    "Cache-Control": "no-store",
    Location: redirectTo
  });
  headers.append("Set-Cookie", clearCookie(transaction.cookieName));
  return {
    request: record.request,
    redirectTo,
    headers
  };
}
__name(denyConsent, "denyConsent");
async function isConsentRemembered(cookies, request, authRequest, remember) {
  validateRememberConsentOptions(remember);
  const approvals = await readApprovals(cookies, request, remember.secret);
  const key = await approvalKey(authRequest, remember.subject);
  const now = Math.floor(Date.now() / 1e3);
  const approval = approvals.find((entry) => entry.k === key && entry.e > now);
  if (!approval) return false;
  const approvedScopes = new Set(approval.s);
  return authRequest.scope.every((scope) => approvedScopes.has(scope));
}
__name(isConsentRemembered, "isConsentRemembered");
async function beginUpstream(kv, cookies, request, options = {}) {
  const { handle, hash } = await createTransaction(kv, {
    kind: "upstream",
    request,
    data: options.data
  });
  const headers = options.headers ?? new Headers();
  headers.append("Set-Cookie", bindingCookie(transactionCookieName(cookies.upstream, hash), hash, TRANSACTION_TTL_SECONDS));
  headers.set("Cache-Control", "no-store");
  return {
    state: handle,
    headers
  };
}
__name(beginUpstream, "beginUpstream");
async function finishUpstream(kv, cookies, request) {
  const state = new URL(request.url).searchParams.get("state");
  if (!state) throw new AuthorizationError("invalid_request", { description: "Missing state parameter" });
  const transaction = await openTransaction(kv, request, cookies.upstream, state, "upstream");
  await transaction.consume();
  const headers = new Headers({ "Cache-Control": "no-store" });
  headers.append("Set-Cookie", clearCookie(transaction.cookieName));
  return {
    request: transaction.record.request,
    data: transaction.record.data,
    headers
  };
}
__name(finishUpstream, "finishUpstream");
async function createTransaction(kv, record) {
  const handle = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const hash = await sha256Hex(handle);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({
    name: "AES-GCM",
    iv
  }, await transactionKey(handle), new TextEncoder().encode(JSON.stringify(record)));
  await kv.put(`transaction:${hash}`, `${base64url(iv)}.${base64url(new Uint8Array(sealed))}`, { expirationTtl: TRANSACTION_TTL_SECONDS });
  return {
    handle,
    hash
  };
}
__name(createTransaction, "createTransaction");
async function openTransaction(kv, request, cookieBase, handle, kind) {
  if (typeof handle !== "string" || handle.length === 0) throw new AuthorizationError("invalid_request", { description: "Missing transaction handle" });
  const hash = await sha256Hex(handle);
  const cookieName = transactionCookieName(cookieBase, hash);
  const bound = readCookie(request, cookieName);
  if (!bound) throw new AuthorizationError("invalid_request", { description: "This authorization was not started in this browser; start again" });
  if (!timingSafeEqual(hash, bound)) throw new AuthorizationError("invalid_request", { description: "This authorization belongs to a different browser session; start again" });
  const key = `transaction:${hash}`;
  const expired = new AuthorizationError("invalid_request", { description: "This authorization expired or was already used; start again" });
  const stored = await kv.get(key);
  if (!stored) throw expired;
  let record;
  try {
    const [iv, sealed] = stored.split(".");
    const plain = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: fromBase64url(iv)
    }, await transactionKey(handle), fromBase64url(sealed));
    record = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw expired;
  }
  if (record.kind !== kind) throw expired;
  return {
    record,
    cookieName,
    consume: /* @__PURE__ */ __name(() => kv.delete(key), "consume")
  };
}
__name(openTransaction, "openTransaction");
async function transactionKey(handle) {
  const material = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`oauth-transaction-key:${handle}`));
  return crypto.subtle.importKey("raw", material, "AES-GCM", false, ["encrypt", "decrypt"]);
}
__name(transactionKey, "transactionKey");
function transactionCookieName(base, hash) {
  return `${base}-${hash.slice(0, 16)}`;
}
__name(transactionCookieName, "transactionCookieName");
async function rememberApproval(cookies, request, approved, remember) {
  const maxAge = remember.maxAgeSeconds ?? DEFAULT_REMEMBER_SECONDS;
  const now = Math.floor(Date.now() / 1e3);
  const key = await approvalKey(approved, remember.subject);
  const approvals = (await readApprovals(cookies, request, remember.secret)).filter((entry) => entry.e > now && entry.k !== key);
  approvals.push({
    k: key,
    s: approved.scope,
    e: now + maxAge
  });
  let value = await signApprovals(approvals, remember.secret);
  while (value.length > MAX_APPROVALS_COOKIE_BYTES && approvals.length > 1) {
    approvals.shift();
    value = await signApprovals(approvals, remember.secret);
  }
  const cookieMaxAge = Math.max(...approvals.map((entry) => entry.e)) - now;
  return `${cookies.approvals}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${cookieMaxAge}`;
}
__name(rememberApproval, "rememberApproval");
async function readApprovals(cookies, request, secret) {
  const value = readCookie(request, cookies.approvals);
  if (!value) return [];
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return [];
  const key = await hmacKey(secret);
  let valid = false;
  try {
    valid = await crypto.subtle.verify("HMAC", key, fromBase64url(signature), new TextEncoder().encode(payload));
  } catch {
    return [];
  }
  if (!valid) return [];
  try {
    const parsed = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    return Array.isArray(parsed) ? parsed.filter(isApproval) : [];
  } catch {
    return [];
  }
}
__name(readApprovals, "readApprovals");
async function signApprovals(approvals, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify(approvals)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), new TextEncoder().encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}
__name(signApprovals, "signApprovals");
function isApproval(value) {
  if (!value || typeof value !== "object") return false;
  const entry = value;
  return typeof entry.k === "string" && typeof entry.e === "number" && Array.isArray(entry.s) && entry.s.every((scope) => typeof scope === "string");
}
__name(isApproval, "isApproval");
async function approvalKey(request, subject) {
  const material = JSON.stringify([
    request.clientId,
    request.redirectUri,
    request.resource ?? null,
    subject ?? null
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
  return base64url(new Uint8Array(digest));
}
__name(approvalKey, "approvalKey");
function hmacKey(secret) {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign", "verify"]);
}
__name(hmacKey, "hmacKey");
function bindingCookie(name, value, maxAge) {
  return `${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}
__name(bindingCookie, "bindingCookie");
function clearCookie(name) {
  return `${name}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}
__name(clearCookie, "clearCookie");
function readCookie(request, name) {
  const header = request.headers.get("Cookie");
  if (!header) return void 0;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
}
__name(readCookie, "readCookie");
async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
__name(sha256Hex, "sha256Hex");
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
__name(timingSafeEqual, "timingSafeEqual");
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64url, "base64url");
function fromBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
__name(fromBase64url, "fromBase64url");
var PROTECTED_RESOURCE_WELL_KNOWN_PREFIX = "/.well-known/oauth-protected-resource";
var NO_CACHE_HEADERS = {
  "Cache-Control": "no-store",
  Pragma: "no-cache"
};
var BASIC_AUTH_CHALLENGE = 'Basic realm="OAuth"';
if (!(typeof Cloudflare !== "undefined" && Cloudflare.compatibilityFlags?.global_fetch_strictly_public === true)) console.warn(`CIMD (Client ID Metadata Document) is disabled: add '"compatibility_flags": ["global_fetch_strictly_public"]' to your wrangler.jsonc to enable. See: https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public`);
var HandlerType = /* @__PURE__ */ (function(HandlerType$1) {
  HandlerType$1[HandlerType$1["EXPORTED_HANDLER"] = 0] = "EXPORTED_HANDLER";
  HandlerType$1[HandlerType$1["WORKER_ENTRYPOINT"] = 1] = "WORKER_ENTRYPOINT";
  return HandlerType$1;
})(HandlerType || {});
var GrantType = /* @__PURE__ */ (function(GrantType$1) {
  GrantType$1["AUTHORIZATION_CODE"] = "authorization_code";
  GrantType$1["REFRESH_TOKEN"] = "refresh_token";
  GrantType$1["TOKEN_EXCHANGE"] = "urn:ietf:params:oauth:grant-type:token-exchange";
  GrantType$1["JWT_BEARER"] = "urn:ietf:params:oauth:grant-type:jwt-bearer";
  return GrantType$1;
})({});
var DEFAULT_AUTHORIZE_PATH = "/authorize";
var DEFAULT_TOKEN_PATH = "/oauth/token";
function toPublicClientInfo(client) {
  const { authMethodExplicit: _explicit, registrationExpiresAt: _expiry, tokenEndpointAuthMethods: _methods, clientAssertionKeys: _keys, ...publicClient } = client;
  return publicClient;
}
__name(toPublicClientInfo, "toPublicClientInfo");
var CLIENT_AUTHENTICATION_PARAMETERS = /* @__PURE__ */ new Set([
  "client_id",
  "client_secret",
  "client_assertion",
  "client_assertion_type"
]);
function isClientAuthMethodAllowed(client, presentedMethod, isClientMetadataDocument) {
  if (presentedMethod === client.tokenEndpointAuthMethod) return true;
  if (isClientMetadataDocument && client.tokenEndpointAuthMethods?.includes(presentedMethod)) return true;
  const isSecretMethod = /* @__PURE__ */ __name((method) => method === "client_secret_basic" || method === "client_secret_post", "isSecretMethod");
  return !isClientMetadataDocument && client.authMethodExplicit === void 0 && isSecretMethod(client.tokenEndpointAuthMethod) && isSecretMethod(presentedMethod);
}
__name(isClientAuthMethodAllowed, "isClientAuthMethodAllowed");
var OAuthProvider = class {
  static {
    __name(this, "OAuthProvider");
  }
  #impl;
  /**
  * Creates a new OAuth provider instance
  * @param options - Configuration options for the provider
  */
  constructor(options) {
    this.#impl = new OAuthProviderImpl(options);
  }
  /**
  * Main fetch handler for the Worker
  * Routes requests to the appropriate handler based on the URL
  * @param request - The HTTP request
  * @param env - Cloudflare Worker environment variables
  * @param ctx - Cloudflare Worker execution context
  * @returns A Promise resolving to an HTTP Response
  */
  fetch(request, env, ctx) {
    return this.#impl.fetch(request, env, ctx);
  }
  /**
  * Purges expired and orphaned data from the KV namespace.
  * Can be called directly from a scheduled handler without needing a request context.
  *
  * @param env - Cloudflare Worker environment variables (must include OAUTH_KV binding)
  * @param options - Optional configuration for batch size and which purge types to enable
  * @returns Statistics about what was checked and purged
  */
  purgeExpiredData(env, options) {
    return this.#impl.createOAuthHelpers(env).purgeExpiredData(options);
  }
};
var OAuthProviderImpl = class {
  static {
    __name(this, "OAuthProviderImpl");
  }
  /**
  * Creates a new OAuth provider instance
  * @param options - Configuration options for the provider
  */
  constructor(options) {
    this.errorResponses = /* @__PURE__ */ new WeakSet();
    this.typedApiHandlers = [];
    this.typedDefaultHandler = "authorizationServer" in options ? void 0 : this.validateHandler(options.defaultHandler, "defaultHandler");
    const roleBased = "authorizationServer" in options;
    if (!roleBased && "resourceMatchOriginOnly" in options) throw new TypeError("resourceMatchOriginOnly was removed in 1.0. Configure resourceMetadata.resource; audiences are compared exactly against that canonical resource. See the migration guide.");
    let normalizedOptions;
    let configuredResourceServers;
    if (roleBased) {
      const { authorizationServer: authorizationServer$1, ...commonOptions } = options;
      this.validateAuthorizationServerIssuer(authorizationServer$1.issuer);
      this.explicitIssuer = authorizationServer$1.issuer;
      const issuerBase = authorizationServer$1.issuer.replace(/\/+$/, "");
      normalizedOptions = {
        ...commonOptions,
        authorizeEndpoint: authorizationServer$1.authorizeEndpoint ?? `${issuerBase}${DEFAULT_AUTHORIZE_PATH}`,
        tokenEndpoint: authorizationServer$1.tokenEndpoint ?? `${issuerBase}${DEFAULT_TOKEN_PATH}`,
        clientRegistrationEndpoint: authorizationServer$1.clientRegistrationEndpoint
      };
      const declared = authorizationServer$1.resources;
      if (!Array.isArray(declared) || declared.length === 0 || declared.some((value) => typeof value !== "string")) throw new TypeError("resources must list at least one canonical protected resource identifier");
      const duplicate = declared.find((resource, index) => declared.slice(0, index).some((earlier) => isExactResource(earlier, resource)));
      if (duplicate !== void 0) throw new TypeError(`resources must be unique; duplicate ${duplicate}`);
      configuredResourceServers = declared.map((resource) => ({ resourceMetadata: { resource } }));
    } else {
      this.explicitIssuer = void 0;
      normalizedOptions = options;
      configuredResourceServers = [{
        resourceMetadata: withRequiredScopes(options.resourceMetadata, options.requiredScopes),
        resolveExternalToken: options.resolveExternalToken
      }];
    }
    this.options = {
      accessTokenTTL: DEFAULT_ACCESS_TOKEN_TTL,
      refreshTokenTTL: DEFAULT_REFRESH_TOKEN_TTL,
      clientRegistrationTTL: DEFAULT_CLIENT_REGISTRATION_TTL,
      onError: /* @__PURE__ */ __name(({ status, code, description }) => console.warn(`OAuth error response: ${status} ${code} - ${description}`), "onError"),
      ...normalizedOptions
    };
    this.validateEndpoint(this.options.authorizeEndpoint, "authorizeEndpoint");
    this.validateEndpoint(this.options.tokenEndpoint, "tokenEndpoint");
    this.consentCookies = consentCookies(this.options.cookiePrefix);
    if (this.options.clientRegistrationEndpoint) this.validateEndpoint(this.options.clientRegistrationEndpoint, "clientRegistrationEndpoint");
    if (roleBased) this.validateAuthorizationServerRouteIsolation();
    this.resourceServers = configuredResourceServers.map(({ resourceMetadata, resolveExternalToken }) => {
      const metadata = this.snapshotResourceMetadata(resourceMetadata);
      this.validateResourceMetadataOptions(metadata);
      return {
        resourceMetadata: metadata,
        resolveExternalToken
      };
    });
    for (const [index, server] of this.resourceServers.entries()) if (this.resourceServers.slice(0, index).some((other) => isExactResource(other.resourceMetadata.resource, server.resourceMetadata.resource))) throw new TypeError(`resources must be unique; duplicate ${server.resourceMetadata.resource}`);
    if (!roleBased) {
      const legacyOptions = options;
      const hasSingleHandlerConfig = !!(legacyOptions.apiRoute && legacyOptions.apiHandler);
      const hasMultiHandlerConfig = !!legacyOptions.apiHandlers;
      if (hasSingleHandlerConfig && hasMultiHandlerConfig) throw new TypeError("Cannot use both apiRoute/apiHandler and apiHandlers. Use either apiRoute + apiHandler OR apiHandlers, not both.");
      if (!hasSingleHandlerConfig && !hasMultiHandlerConfig) throw new TypeError("Must provide either apiRoute + apiHandler OR apiHandlers. No API route configuration provided.");
      const resourceServer = this.resourceServers[0];
      if (hasSingleHandlerConfig) {
        const handler = this.validateHandler(legacyOptions.apiHandler, "apiHandler");
        (Array.isArray(legacyOptions.apiRoute) ? legacyOptions.apiRoute : [legacyOptions.apiRoute]).forEach((route, index) => {
          this.validateEndpoint(route, Array.isArray(legacyOptions.apiRoute) ? `apiRoute[${index}]` : "apiRoute");
          this.typedApiHandlers.push({
            route,
            handler,
            resourceServer
          });
        });
      } else for (const [route, rawHandler] of Object.entries(legacyOptions.apiHandlers)) {
        this.validateEndpoint(route, `apiHandlers key: ${route}`);
        const handler = this.validateHandler(rawHandler, `apiHandlers[${route}]`);
        this.typedApiHandlers.push({
          route,
          handler,
          resourceServer
        });
      }
      for (const { route } of this.typedApiHandlers) this.assertRouteCoveredByResource(route, resourceServer.resourceMetadata.resource);
    }
    const resources = this.resourceServers.map((server) => server.resourceMetadata.resource);
    const soleResource = resources.length === 1 ? resources[0] : void 0;
    const authorizationServer = roleBased ? options.authorizationServer : void 0;
    this.configuredDefaultAuthorizationResource = authorizationServer?.defaultResource ?? soleResource;
    this.configuredLegacyGrantResource = authorizationServer?.legacyGrantResource ?? soleResource;
    if (roleBased) {
      this.getDefaultAuthorizationResource();
      this.getLegacyGrantResource();
    }
    if (!isValidAccessTokenTTL(this.options.accessTokenTTL)) throw new TypeError(`accessTokenTTL must be an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds (Cloudflare KV's minimum expiration window).`);
    if (this.options.refreshTokenIdleTTL !== void 0 && !isValidAccessTokenTTL(this.options.refreshTokenIdleTTL)) throw new TypeError(`refreshTokenIdleTTL must be an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds (Cloudflare KV's minimum expiration window).`);
    if (this.options.allowPlainPKCE) throw new TypeError("allowPlainPKCE has been removed: MCP and OAuth 2.1 clients use S256 PKCE.");
    if (this.options.allowImplicitFlow) throw new TypeError("allowImplicitFlow has been removed: OAuth 2.1 and MCP use the authorization code flow with PKCE.");
    if (this.options.refreshTokenTTL !== void 0 && !isValidRefreshTokenTTL(this.options.refreshTokenTTL)) throw new TypeError(`refreshTokenTTL must be 0 (no refresh tokens), undefined (no expiry), or an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds (Cloudflare KV's minimum expiration window).`);
    if (this.options.clientRegistrationTTL !== void 0 && !isValidAccessTokenTTL(this.options.clientRegistrationTTL)) throw new TypeError(`clientRegistrationTTL must be undefined (no expiry) or an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds (Cloudflare KV's minimum expiration window).`);
    this.serverCapabilities = buildOAuthServerCapabilities({
      allowTokenExchangeGrant: !!this.options.allowTokenExchangeGrant,
      enterpriseManagedAuthorization: !!this.options.enterpriseManagedAuthorization,
      allowPrivateUseRedirectUris: this.options.allowPrivateUseRedirectUris === true
    });
    validateAuthorizationServerScopes(this.options.scopesSupported);
    this.validateEmaOptions(this.options.enterpriseManagedAuthorization);
    if (this.options.enterpriseManagedAuthorization) {
      this.jwksProvider = createDefaultJwksProvider({ cacheTtlSeconds: this.options.enterpriseManagedAuthorization.jwksCacheTtlSeconds });
      this.jtiStore = createKvJtiStore();
    }
    if (this.options.clientIdMetadataDocumentEnabled) this.clientAssertionVerifier = createClientAssertionVerifier();
  }
  /**
  * Validates that an endpoint is either an absolute path or a full URL
  * @param endpoint - The endpoint to validate
  * @param name - The name of the endpoint property for error messages
  * @throws TypeError if the endpoint is invalid
  */
  validateEndpoint(endpoint, name) {
    if (this.isPath(endpoint)) {
      if (!endpoint.startsWith("/")) throw new TypeError(`${name} path must be an absolute path starting with /`);
      if (this.explicitIssuer && new URL(endpoint, new URL(this.explicitIssuer).origin).hash) throw new TypeError(`${name} must not contain a fragment`);
    } else {
      let parsed;
      try {
        parsed = new URL(endpoint);
      } catch (e) {
        throw new TypeError(`${name} must be either an absolute path starting with / or a valid URL`);
      }
      if (this.explicitIssuer && (!hasAcceptedCanonicalScheme(parsed) || parsed.username || parsed.password || parsed.hash)) throw new TypeError(`${name} must be an absolute HTTPS URL without userinfo or a fragment (http is accepted only on a loopback host)`);
    }
  }
  /** Validate the explicit issuer used to host-gate the role-based AS. */
  validateAuthorizationServerIssuer(issuer) {
    let parsed;
    try {
      parsed = new URL(issuer);
    } catch {
      throw new TypeError("authorizationServer.issuer must be a canonical absolute HTTPS URL");
    }
    if (!validateResourceUri(issuer) || !hasAcceptedCanonicalScheme(parsed) || parsed.username || parsed.password || parsed.search || parsed.hash || foldResourceSchemeAndHost(issuer) !== issuer || parsed.href !== issuer && parsed.origin !== issuer) throw new TypeError("authorizationServer.issuer must be a canonical absolute HTTPS URL (http is accepted only on a loopback host)");
  }
  /**
  * Reject an endpoint another would claim, so it could never be reached. fetch() tries metadata,
  * then token, then registration; the application routes the authorization endpoint. Each check
  * asks the predicate fetch() dispatches on, so it agrees with routing (metadata ignores the
  * query, for one).
  */
  validateAuthorizationServerRouteIsolation() {
    const issuerUrl = new URL(this.explicitIssuer);
    const tokenUrl = new URL(this.getFullEndpointUrl(this.options.tokenEndpoint, issuerUrl));
    if (this.isAuthorizationServerMetadataRequest(tokenUrl)) throw new TypeError("tokenEndpoint must not collide with the authorization server metadata endpoint");
    const authorizeUrl = new URL(this.getFullEndpointUrl(this.options.authorizeEndpoint, issuerUrl));
    if (this.isAuthorizationServerMetadataRequest(authorizeUrl)) throw new TypeError("authorizeEndpoint must not collide with the authorization server metadata endpoint");
    if (this.isTokenEndpoint(authorizeUrl)) throw new TypeError("authorizeEndpoint must not collide with tokenEndpoint");
    if (!this.options.clientRegistrationEndpoint) return;
    if (this.isClientRegistrationEndpoint(authorizeUrl)) throw new TypeError("authorizeEndpoint must not collide with clientRegistrationEndpoint");
    const registrationUrl = new URL(this.getFullEndpointUrl(this.options.clientRegistrationEndpoint, issuerUrl));
    if (this.isTokenEndpoint(registrationUrl)) throw new TypeError("clientRegistrationEndpoint must not collide with tokenEndpoint");
    if (this.isAuthorizationServerMetadataRequest(registrationUrl)) throw new TypeError("clientRegistrationEndpoint must not collide with the authorization server metadata endpoint");
  }
  /**
  * A protected route must be the canonical resource path or a path-boundary descendant of
  * it. Anything else can never validate a token, because every token is bound to the
  * canonical resource, so it would be a permanently 401 zone.
  */
  assertRouteCoveredByResource(route, resource) {
    const resourceUrl = new URL(resource);
    let routePath;
    if (this.isPath(route)) routePath = route.split("?")[0];
    else {
      const routeUrl = new URL(route);
      if (routeUrl.origin !== resourceUrl.origin) throw new TypeError(`API route ${route} is not covered by resourceMetadata.resource ${resource}. An absolute protected route must be on the resource's origin.`);
      for (const [name, value] of resourceUrl.searchParams) {
        const routeValues = routeUrl.searchParams.getAll(name);
        if (routeValues.length > 0 && !routeValues.includes(value)) throw new TypeError(`API route ${route} is not covered by resourceMetadata.resource ${resource}. An absolute protected route must carry the resource's query parameters.`);
      }
      routePath = routeUrl.pathname;
    }
    if (isPathDescendant(routePath, resourceUrl.pathname)) return;
    throw new TypeError(`API route ${route} is not covered by resourceMetadata.resource ${resource}. Protected routes must be the canonical resource path or a descendant of it; use ${resourceUrl.origin} as the resource to cover every path on that origin.`);
  }
  /** Resolve a configured policy value to the registry's canonical spelling. */
  resolveConfiguredResourceDefault(resource, name) {
    if (resource === void 0) return void 0;
    const configured = this.findConfiguredResource(resource);
    if (!configured) throw new TypeError(`${name} must name one of the configured protected resources`);
    return configured;
  }
  getDefaultAuthorizationResource() {
    const sole = this.resourceServers.length === 1 ? this.resourceServers[0].resourceMetadata.resource : void 0;
    return this.resolveConfiguredResourceDefault(this.configuredDefaultAuthorizationResource ?? sole, "defaultResource");
  }
  getLegacyGrantResource() {
    const sole = this.resourceServers.length === 1 ? this.resourceServers[0].resourceMetadata.resource : void 0;
    return this.resolveConfiguredResourceDefault(this.configuredLegacyGrantResource ?? sole, "legacyGrantResource");
  }
  /**
  * The audience a stored access token is treated as bound to.
  *
  * A token issued before resource binding has no stored audience. It keeps
  * working at the server-selected migration resource (the sole resource, or
  * `legacyGrantResource` in a multi-resource deployment) until it expires;
  * refresh binds its grant and returns a bound replacement. The client never
  * chooses this destination. Without a migration resource the token is
  * treated as unbound and rejected.
  *
  * The destination is deployment policy, not an issuance-time claim: changing
  * `legacyGrantResource` re-targets every surviving unbound token and grant.
  * Keep it fixed for the length of the migration window.
  */
  resolveStoredTokenAudience(audience) {
    return audience === void 0 ? this.getLegacyGrantResource() : audience;
  }
  /**
  * Validates that a handler is either an ExportedHandler or a class extending WorkerEntrypoint
  * @param handler - The handler to validate
  * @param name - The name of the handler property for error messages
  * @returns The type of the handler (EXPORTED_HANDLER or WORKER_ENTRYPOINT)
  * @throws TypeError if the handler is invalid
  */
  validateHandler(handler, name) {
    if (typeof handler === "object" && handler !== null && typeof handler.fetch === "function") return {
      type: HandlerType.EXPORTED_HANDLER,
      handler
    };
    if (typeof handler === "function" && handler.prototype instanceof WorkerEntrypoint) return {
      type: HandlerType.WORKER_ENTRYPOINT,
      handler
    };
    throw new TypeError(`${name} must be either an ExportedHandler object with a fetch method or a class extending WorkerEntrypoint`);
  }
  /** Snapshot caller-owned metadata so later mutation cannot change routing or policy. */
  snapshotResourceMetadata(metadata) {
    return {
      ...metadata,
      ...metadata?.authorization_servers ? { authorization_servers: [...metadata.authorization_servers] } : {},
      ...metadata?.scopes_supported ? { scopes_supported: [...metadata.scopes_supported] } : {},
      ...metadata?.bearer_methods_supported ? { bearer_methods_supported: [...metadata.bearer_methods_supported] } : {}
    };
  }
  /** Validate configured RFC 9728 protected resource metadata. */
  validateResourceMetadataOptions(options) {
    if (!options || !validateResourceUri(options.resource) || !hasAcceptedCanonicalScheme(new URL(options.resource))) throw new TypeError("resourceMetadata.resource is required and must be an absolute HTTPS URI without a fragment (http is accepted only on a loopback host)");
    if (foldResourceSchemeAndHost(options.resource) !== options.resource) throw new TypeError("resourceMetadata.resource must use a lowercase scheme and lowercase host");
    const parsedResource = new URL(options.resource);
    if (parsedResource.username || parsedResource.password || parsedResource.href !== options.resource && parsedResource.origin !== options.resource) throw new TypeError("resourceMetadata.resource must use canonical URL serialization without userinfo, a default port, or dot segments");
    if (parsedResource.pathname === PROTECTED_RESOURCE_WELL_KNOWN_PREFIX || parsedResource.pathname.startsWith(`${PROTECTED_RESOURCE_WELL_KNOWN_PREFIX}/`)) throw new TypeError(`resourceMetadata.resource must not be inside the ${PROTECTED_RESOURCE_WELL_KNOWN_PREFIX} namespace`);
    if (options.authorization_servers !== void 0) {
      if (options.authorization_servers.length === 0) throw new TypeError("resourceMetadata.authorization_servers must contain at least one issuer");
      for (const issuer of options.authorization_servers) {
        let parsed;
        try {
          parsed = new URL(issuer);
        } catch {
          throw new TypeError("resourceMetadata.authorization_servers must contain valid HTTPS issuer URLs");
        }
        if (!validateResourceUri(issuer) || !hasAcceptedCanonicalScheme(parsed) || parsed.username || parsed.password || foldResourceSchemeAndHost(issuer) !== issuer || parsed.href !== issuer && parsed.origin !== issuer || issuer.includes("?") || issuer.includes("#")) throw new TypeError("resourceMetadata.authorization_servers must contain valid HTTPS issuer URLs (http is accepted only on a loopback host)");
      }
    }
    if (options.scopes_supported?.some((scope) => !isValidOAuthScopeToken(scope))) throw new TypeError("requiredScopes (or the deprecated resourceMetadata.scopes_supported) must contain valid OAuth scope tokens");
    if (options.bearer_methods_supported?.some((method) => method !== "header")) throw new TypeError("resourceMetadata.bearer_methods_supported only supports 'header'");
  }
  /**
  * Validates MCP Enterprise-Managed Authorization configuration at construction time.
  *
  * Presence of `enterpriseManagedAuthorization` on options enables the feature —
  * there is no separate `enabled` flag (which would silently disable EMA when
  * forgotten). Configuration is checked structurally; runtime concerns
  * (JWKS reachability etc.) are checked when assertions arrive.
  */
  validateEmaOptions(options) {
    if (!options) return;
    if (typeof options.trustedIssuers !== "function") throw new TypeError("enterpriseManagedAuthorization.trustedIssuers must be a resolver function: (input) => EmaTrustedIssuer | null");
    if (typeof options.mapClaims !== "function") throw new TypeError("enterpriseManagedAuthorization.mapClaims must be a function");
    if (options.jwksCacheTtlSeconds !== void 0 && options.jwksCacheTtlSeconds <= 0) throw new TypeError("enterpriseManagedAuthorization.jwksCacheTtlSeconds must be greater than 0");
    if (options.clockSkewSeconds !== void 0 && options.clockSkewSeconds < 0) throw new TypeError("enterpriseManagedAuthorization.clockSkewSeconds must be non-negative");
    if (options.maxAssertionLifetimeSeconds !== void 0 && options.maxAssertionLifetimeSeconds <= 0) throw new TypeError("enterpriseManagedAuthorization.maxAssertionLifetimeSeconds must be greater than 0");
  }
  /**
  * Main fetch handler for the Worker
  * Routes requests to the appropriate handler based on the URL
  * @param request - The HTTP request
  * @param env - Cloudflare Worker environment variables
  * @param ctx - Cloudflare Worker execution context
  * @returns A Promise resolving to an HTTP Response
  */
  async fetch(request, env, ctx) {
    return this.fetchForRoles(request, env, ctx, "combined");
  }
  async fetchAuthorizationServer(request, env, ctx) {
    return this.fetchForRoles(request, env, ctx, "authorization-server");
  }
  async fetchForRoles(request, env, ctx, role) {
    const url = new URL(request.url);
    const servesProtectedResources = role === "combined";
    const metadataResourceServer = servesProtectedResources ? this.findResourceServerForMetadataUrl(url) : void 0;
    const apiRoute = servesProtectedResources ? this.findApiRouteForUrl(url) : void 0;
    if (request.method === "OPTIONS") {
      if (apiRoute !== void 0 || this.isAuthorizationServerMetadataRequest(url) || servesProtectedResources && this.isProtectedResourceMetadataPath(url) || this.isTokenEndpoint(url) || this.options.clientRegistrationEndpoint && this.isClientRegistrationEndpoint(url)) return withCorsHeaders(new Response(null, {
        status: 204,
        headers: { "Content-Length": "0" }
      }), request);
    }
    if (this.isAuthorizationServerMetadataRequest(url)) {
      if (request.method !== "GET" && request.method !== "HEAD") return withCorsHeaders(new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" }
      }), request);
      return withCorsHeaders(withoutBodyForHead(request, await this.handleMetadataDiscovery(url)), request);
    }
    if (servesProtectedResources && this.isProtectedResourceMetadataPath(url)) {
      if (!metadataResourceServer) return withCorsHeaders(new Response(null, { status: 404 }), request);
      if (request.method !== "GET" && request.method !== "HEAD") return withCorsHeaders(new Response(null, {
        status: 405,
        headers: { Allow: "GET, HEAD, OPTIONS" }
      }), request);
      return withCorsHeaders(withoutBodyForHead(request, this.handleProtectedResourceMetadata(url, metadataResourceServer)), request);
    }
    if (this.isTokenEndpoint(url)) {
      const parsed = await this.parseTokenEndpointRequest(request, env);
      if (parsed instanceof Response) return withCorsHeaders(parsed, request);
      let response;
      if (parsed.isRevocationRequest) response = await this.revokeToken(parsed.body, parsed.clientInfo, env);
      else response = await this.handleTokenRequest(parsed.body, parsed.clientInfo, parsed.clientAuthMethod, env, url, request);
      if (response.ok && !this.errorResponses.has(response)) await this.renewClientRegistrationIfDue(env, parsed.clientInfo, Math.floor(Date.now() / 1e3));
      return withCorsHeaders(response, request);
    }
    if (this.options.clientRegistrationEndpoint && this.isClientRegistrationEndpoint(url)) return withCorsHeaders(await this.handleClientRegistration(request, env), request);
    if (apiRoute) return withCorsHeaders(await this.handleApiRequest(request, env, ctx, apiRoute), request);
    const defaultHandler = this.typedDefaultHandler;
    if (!defaultHandler) return new Response(null, { status: 404 });
    if (!env.OAUTH_PROVIDER) env.OAUTH_PROVIDER = this.createOAuthHelpers(env);
    if (defaultHandler.type === HandlerType.EXPORTED_HANDLER) return defaultHandler.handler.fetch(request, env, ctx);
    return new defaultHandler.handler(ctx, env).fetch(request);
  }
  /**
  * Decodes a token and returns token data with decrypted props
  * @param token - The granted token
  * @param env - Cloudflare Worker environment variables
  * @returns Promise resolving to token data with decrypted props, or null if token is invalid
  */
  async unwrapToken(token, env) {
    const parts = token.split(":");
    if (!(parts.length === 3)) return null;
    const [userId, grantId] = parts;
    const id = await generateTokenId(token);
    const tokenData = await env.OAUTH_KV.get(`token:${userId}:${grantId}:${id}`, { type: "json" });
    if (!tokenData) return null;
    const now = Math.floor(Date.now() / 1e3);
    if (tokenData.expiresAt < now) return null;
    const decryptedProps = await decryptProps(await unwrapKeyWithToken(token, tokenData.wrappedEncryptionKey), tokenData.grant.encryptedProps);
    const { grant } = tokenData;
    return {
      id: tokenData.id,
      grantId: tokenData.grantId,
      userId: tokenData.userId,
      createdAt: tokenData.createdAt,
      expiresAt: tokenData.expiresAt,
      audience: tokenData.audience,
      scope: tokenData.scope || grant.scope,
      grant: {
        clientId: grant.clientId,
        scope: grant.scope,
        props: decryptedProps
      }
    };
  }
  async validateAccessToken(token, resource, env) {
    const configuredResource = this.findConfiguredResource(resource);
    if (!configuredResource) throw new TypeError("resource must name one registered protected resource");
    const summary = await this.unwrapToken(token, env);
    if (!summary || !isExactResource(this.resolveStoredTokenAudience(summary.audience), configuredResource)) return null;
    return {
      props: summary.grant.props,
      audience: configuredResource,
      expiresAt: summary.expiresAt,
      scope: summary.scope,
      userId: summary.userId,
      clientId: summary.grant.clientId
    };
  }
  /**
  * Determines if an endpoint configuration is a path or a full URL
  * @param endpoint - The endpoint configuration
  * @returns True if the endpoint is a path (starts with /), false if it's a full URL
  */
  isPath(endpoint) {
    return endpoint.startsWith("/");
  }
  /**
  * Matches a URL against an endpoint pattern that can be a full URL or just a path
  * @param url - The URL to check
  * @param endpoint - The endpoint pattern (full URL or path)
  * @returns True if the URL matches the endpoint pattern
  */
  matchEndpoint(url, endpoint, allowAdditionalQuery = false) {
    if (!this.explicitIssuer) {
      if (this.isPath(endpoint)) return url.pathname === endpoint;
      const legacyEndpoint = new URL(endpoint);
      return url.hostname === legacyEndpoint.hostname && url.pathname === legacyEndpoint.pathname;
    }
    const endpointUrl = new URL(this.getFullEndpointUrl(endpoint, url));
    if (url.origin !== endpointUrl.origin || url.pathname !== endpointUrl.pathname) return false;
    const unmatchedActualQuery = [...url.searchParams.entries()];
    const configuredQueryNames = /* @__PURE__ */ new Set();
    for (const [name, value] of endpointUrl.searchParams) {
      configuredQueryNames.add(name);
      const match = unmatchedActualQuery.findIndex(([actualName, actualValue]) => {
        return actualName === name && actualValue === value;
      });
      if (match === -1) return false;
      unmatchedActualQuery.splice(match, 1);
    }
    if (!allowAdditionalQuery) return unmatchedActualQuery.length === 0;
    return unmatchedActualQuery.every(([name]) => !configuredQueryNames.has(name));
  }
  /**
  * Checks if a URL matches the configured token endpoint
  * @param url - The URL to check
  * @returns True if the URL matches the token endpoint
  */
  isTokenEndpoint(url) {
    return this.matchEndpoint(url, this.options.tokenEndpoint, true);
  }
  isAuthorizationEndpointRequest(url) {
    return this.matchEndpoint(url, this.options.authorizeEndpoint, true);
  }
  /**
  * Checks if a URL matches the configured client registration endpoint
  * @param url - The URL to check
  * @returns True if the URL matches the client registration endpoint
  */
  isClientRegistrationEndpoint(url) {
    if (!this.options.clientRegistrationEndpoint) return false;
    return this.matchEndpoint(url, this.options.clientRegistrationEndpoint, true);
  }
  /**
  * Checks if a URL is a request for OAuth Protected Resource Metadata (RFC 9728).
  * Only the well-known URL constructed from the configured canonical resource
  * may return its document; aliases would violate RFC 9728 §3.3.
  */
  findResourceServerForMetadataUrl(url) {
    return this.resourceServers.find((server) => {
      const expected = new URL(this.getConfiguredResourceMetadataUrl(server.resourceMetadata.resource));
      return url.origin === expected.origin && url.pathname === expected.pathname && requestCarriesResourceQuery(url, expected);
    });
  }
  /** Exact RFC 8414 discovery location for the configured issuer. */
  getAuthorizationServerMetadataUrl(requestUrl) {
    if (!this.explicitIssuer) return `${requestUrl.origin}/.well-known/oauth-authorization-server`;
    const issuer = new URL(this.explicitIssuer);
    const issuerPath = issuer.pathname === "/" ? "" : issuer.pathname.replace(/\/+$/, "");
    return `${issuer.origin}/.well-known/oauth-authorization-server${issuerPath}`;
  }
  isAuthorizationServerMetadataRequest(url) {
    const expected = new URL(this.getAuthorizationServerMetadataUrl(url));
    return url.origin === expected.origin && url.pathname === expected.pathname;
  }
  /** Whether this instance is the role-based authorization server with a fixed issuer. */
  get hasExplicitIssuer() {
    return this.explicitIssuer !== void 0;
  }
  /** Whether a URL is in the RFC 9728 protected-resource metadata namespace. */
  isProtectedResourceMetadataPath(url) {
    return url.pathname === PROTECTED_RESOURCE_WELL_KNOWN_PREFIX || url.pathname.startsWith(PROTECTED_RESOURCE_WELL_KNOWN_PREFIX + "/");
  }
  createInvalidClientResponse(description, basicAuthenticationAttempted, internal, request) {
    return this.createErrorResponse("invalid_client", {
      description,
      statusCode: 401,
      ...basicAuthenticationAttempted ? { headers: { "WWW-Authenticate": BASIC_AUTH_CHALLENGE } } : {}
    }, internal, request);
  }
  /**
  * Parses and validates a token endpoint request (used for both token exchange and revocation)
  * @param request - The HTTP request to parse
  * @returns Promise with parsed body and client info, or error response
  */
  async parseTokenEndpointRequest(request, env) {
    if (request.method !== "POST") return this.createErrorResponse("invalid_request", {
      description: "Method not allowed",
      statusCode: 405,
      headers: { Allow: "POST, OPTIONS" }
    }, {
      category: "token-endpoint-request",
      reason: "method_not_allowed"
    });
    const contentType = request.headers.get("Content-Type") || "";
    let body = {};
    if (contentType.split(";")[0].trim().toLowerCase() !== "application/x-www-form-urlencoded") return this.createErrorResponse("invalid_request", {
      description: "Content-Type must be application/x-www-form-urlencoded",
      statusCode: 400
    }, {
      category: "token-endpoint-request",
      reason: "unsupported_content_type"
    });
    let formData;
    try {
      formData = await request.formData();
    } catch {
      return this.createErrorResponse("invalid_request", {
        description: "Request body must be valid application/x-www-form-urlencoded data",
        statusCode: 400
      }, {
        category: "token-endpoint-request",
        reason: "malformed_request_body"
      });
    }
    const processedKeys = /* @__PURE__ */ new Set();
    for (const key of formData.keys()) {
      if (processedKeys.has(key)) continue;
      processedKeys.add(key);
      const allValues = CLIENT_AUTHENTICATION_PARAMETERS.has(key) ? formData.getAll(key).filter((entry) => entry !== "") : formData.getAll(key);
      if (allValues.length === 0) continue;
      if (key !== "resource" && allValues.length > 1) return this.createErrorResponse("invalid_request", {
        description: `Request parameter "${key}" must not be repeated`,
        statusCode: 400
      }, {
        category: "token-endpoint-request",
        reason: "repeated_parameter",
        detail: { parameter: key }
      });
      body[key] = allValues.length > 1 ? allValues : allValues[0];
    }
    const basicAuthorization = parseBasicAuthorizationHeader(request.headers.get("Authorization"));
    const basicAuthenticationAttempted = basicAuthorization.kind !== "not-basic";
    const sent = /* @__PURE__ */ __name((name) => body[name] !== void 0, "sent");
    const clientAssertionAttempted = sent("client_assertion") || sent("client_assertion_type");
    let clientId = "";
    let clientSecret = "";
    if (basicAuthenticationAttempted) {
      if (sent("client_id") || sent("client_secret") || clientAssertionAttempted) return this.createErrorResponse("invalid_request", {
        description: "Client must not use multiple authentication methods",
        statusCode: 400
      }, {
        category: "client-authentication",
        reason: "multiple_authentication_methods"
      });
      if (basicAuthorization.kind === "malformed") return this.createInvalidClientResponse("Client authentication failed: invalid Basic credentials", basicAuthenticationAttempted, {
        category: "client-authentication",
        reason: "malformed_basic_credentials"
      });
      clientId = basicAuthorization.clientId;
      clientSecret = basicAuthorization.clientSecret;
    } else if (clientAssertionAttempted) {
      if (sent("client_secret")) return this.createErrorResponse("invalid_request", {
        description: "Client must not use multiple authentication methods",
        statusCode: 400
      }, {
        category: "client-authentication",
        reason: "multiple_authentication_methods"
      });
      if (!sent("client_assertion") || !sent("client_assertion_type")) return this.createErrorResponse("invalid_request", {
        description: "client_assertion and client_assertion_type must be sent together",
        statusCode: 400
      }, {
        category: "client-authentication",
        reason: "client_assertion_incomplete"
      });
      clientId = body.client_id || readClientAssertionIssuer(body.client_assertion) || "";
    } else {
      clientId = body.client_id;
      clientSecret = body.client_secret || "";
    }
    if (!clientId) return this.createInvalidClientResponse("Client ID is required", basicAuthenticationAttempted, {
      category: "client-authentication",
      reason: "client_id_missing"
    });
    let clientInfo;
    try {
      clientInfo = await this.getClient(env, clientId);
    } catch (error) {
      if (error instanceof CimdFetchError) return this.createInvalidClientResponse("Client not found", basicAuthenticationAttempted, {
        category: "client-id-metadata-document",
        reason: error.reason,
        detail: {
          metadataUrl: error.metadataUrl,
          message: error.detail
        }
      }, request);
      throw error;
    }
    if (!clientInfo) return this.createInvalidClientResponse("Client not found", basicAuthenticationAttempted, {
      category: "client-authentication",
      reason: "client_not_found"
    });
    const presentedAuthMethod = basicAuthenticationAttempted ? "client_secret_basic" : clientAssertionAttempted ? "private_key_jwt" : sent("client_secret") ? "client_secret_post" : "none";
    const registeredAuthMethod = clientInfo.tokenEndpointAuthMethod;
    if (!isClientAuthMethodAllowed(clientInfo, presentedAuthMethod, !!this.options.clientIdMetadataDocumentEnabled && isClientIdMetadataDocumentUrl(clientInfo.clientId))) return this.createInvalidClientResponse("Client authentication failed", basicAuthenticationAttempted, {
      category: "client-authentication",
      reason: "token_endpoint_auth_method_mismatch",
      detail: {
        clientId: clientInfo.clientId,
        registeredMethod: registeredAuthMethod,
        presentedMethod: presentedAuthMethod
      }
    });
    if (presentedAuthMethod === "private_key_jwt") {
      const failure = await this.verifyClientAssertion(body, clientInfo, env, request);
      if (failure) return failure;
    } else if (presentedAuthMethod !== "none") {
      if (!clientSecret) return this.createInvalidClientResponse("Client authentication failed: missing client_secret", basicAuthenticationAttempted, {
        category: "client-authentication",
        reason: "client_secret_missing"
      });
      if (!clientInfo.clientSecret) return this.createInvalidClientResponse("Client authentication failed: client has no registered secret", basicAuthenticationAttempted, {
        category: "client-authentication",
        reason: "client_secret_not_registered"
      });
      if (await hashSecret(clientSecret) !== clientInfo.clientSecret) return this.createInvalidClientResponse("Client authentication failed: invalid client_secret", basicAuthenticationAttempted, {
        category: "client-authentication",
        reason: "client_secret_mismatch"
      });
    }
    const isRevocationRequest = !body.grant_type && !!body.token;
    return {
      body,
      clientInfo,
      clientAuthMethod: presentedAuthMethod,
      isRevocationRequest
    };
  }
  /**
  * Authenticates a `private_key_jwt` request (RFC 7523 §2.2). The method check has already
  * confirmed that the client registered the method, which only a CIMD client with usable keys can.
  * @returns An `invalid_client` response, or `undefined` once the assertion verified and was consumed
  */
  async verifyClientAssertion(body, clientInfo, env, request) {
    const keys = clientInfo.clientAssertionKeys;
    const verifier = this.clientAssertionVerifier;
    if (!keys || !verifier) throw new Error("private_key_jwt client resolved without keys or a verifier");
    if (body.client_assertion_type !== JWT_BEARER_CLIENT_ASSERTION_TYPE) return this.createInvalidClientResponse("Client authentication failed", false, {
      category: "client-authentication",
      reason: "client_assertion_type_unsupported",
      detail: {
        clientId: clientInfo.clientId,
        clientAssertionType: String(body.client_assertion_type)
      }
    });
    const requestUrl = new URL(request.url);
    const verified = await verifier.verify({
      assertion: body.client_assertion,
      clientId: clientInfo.clientId,
      keys,
      issuer: this.getAuthorizationServerIssuer(requestUrl),
      tokenEndpoint: this.getFullEndpointUrl(this.options.tokenEndpoint, requestUrl),
      env
    });
    if (verified.ok) return void 0;
    return this.createInvalidClientResponse("Client authentication failed", false, {
      category: "client-authentication",
      reason: "client_assertion_invalid",
      detail: {
        clientId: clientInfo.clientId,
        ...verified.error
      }
    }, request);
  }
  /**
  * Checks if a URL matches a specific API route
  * @param url - The URL to check
  * @param route - The API route to check against
  * @returns True if the URL matches the API route
  */
  matchApiRoute(url, route) {
    const pathMatches = /* @__PURE__ */ __name((configuredPath, rootMatchesDescendants) => {
      if (configuredPath === "/") return rootMatchesDescendants || url.pathname === "/";
      const normalized = configuredPath.endsWith("/") ? configuredPath.slice(0, -1) : configuredPath;
      return url.pathname === normalized || url.pathname.startsWith(normalized + "/");
    }, "pathMatches");
    if (this.isPath(route)) return pathMatches(route, false);
    else {
      const apiUrl = new URL(route);
      return url.origin === apiUrl.origin && pathMatches(apiUrl.pathname, true) && requestCarriesResourceQuery(url, apiUrl);
    }
  }
  /**
  * Finds the appropriate API handler for a URL
  * @param url - The URL to find a handler for
  * @returns The TypedHandler for the URL, or undefined if no handler matches
  */
  findApiRouteForUrl(url) {
    return this.typedApiHandlers.filter(({ route }) => this.matchApiRoute(url, route)).sort((left, right) => new URL(right.route, url.origin).pathname.length - new URL(left.route, url.origin).pathname.length)[0];
  }
  /**
  * Gets the full URL for an endpoint, using the provided request URL's
  * origin for endpoints specified as just paths
  * @param endpoint - The endpoint configuration (path or full URL)
  * @param requestUrl - The URL of the incoming request
  * @returns The full URL for the endpoint
  */
  getFullEndpointUrl(endpoint, requestUrl) {
    if (this.isPath(endpoint)) return `${this.explicitIssuer ? new URL(this.explicitIssuer).origin : requestUrl.origin}${endpoint}`;
    else return endpoint;
  }
  /**
  * Gets the authorization server issuer using the same derivation as RFC 8414 metadata.
  */
  getAuthorizationServerIssuer(requestUrl) {
    if (this.explicitIssuer) return this.explicitIssuer;
    const tokenEndpoint = this.getFullEndpointUrl(this.options.tokenEndpoint, requestUrl);
    return new URL(tokenEndpoint).origin;
  }
  /**
  * Handles the OAuth metadata discovery endpoint
  * Implements RFC 8414 for OAuth Server Metadata
  * @param requestUrl - The URL of the incoming request
  * @returns Response with OAuth server metadata
  */
  async handleMetadataDiscovery(requestUrl) {
    const tokenEndpoint = this.getFullEndpointUrl(this.options.tokenEndpoint, requestUrl);
    const authorizeEndpoint = this.getFullEndpointUrl(this.options.authorizeEndpoint, requestUrl);
    let registrationEndpoint = void 0;
    if (this.options.clientRegistrationEndpoint) registrationEndpoint = this.getFullEndpointUrl(this.options.clientRegistrationEndpoint, requestUrl);
    const responseTypesSupported = this.serverCapabilities.responseTypes;
    const grantTypesSupported = this.serverCapabilities.grantTypes;
    const authorizationGrantProfilesSupported = this.options.enterpriseManagedAuthorization ? [EMA_ID_JAG_GRANT_PROFILE] : [];
    const cimdSupported = !!this.options.clientIdMetadataDocumentEnabled && this.hasGlobalFetchStrictlyPublic();
    const metadata = {
      issuer: this.getAuthorizationServerIssuer(requestUrl),
      authorization_endpoint: authorizeEndpoint,
      token_endpoint: tokenEndpoint,
      ...this.resourceServers.length > 0 ? { protected_resources: this.resourceServers.map((server) => server.resourceMetadata.resource) } : {},
      registration_endpoint: registrationEndpoint,
      scopes_supported: this.options.scopesSupported,
      response_types_supported: responseTypesSupported,
      response_modes_supported: ["query"],
      grant_types_supported: grantTypesSupported,
      ...authorizationGrantProfilesSupported.length > 0 ? { authorization_grant_profiles_supported: authorizationGrantProfilesSupported } : {},
      token_endpoint_auth_methods_supported: [...this.serverCapabilities.tokenEndpointAuthMethods, ...cimdSupported ? ["private_key_jwt"] : []],
      ...cimdSupported ? { token_endpoint_auth_signing_alg_values_supported: [...CLIENT_ASSERTION_ALGORITHMS] } : {},
      revocation_endpoint: tokenEndpoint,
      code_challenge_methods_supported: this.serverCapabilities.codeChallengeMethods,
      authorization_response_iss_parameter_supported: true,
      client_id_metadata_document_supported: cimdSupported
    };
    return new Response(JSON.stringify(metadata), { headers: { "Content-Type": "application/json" } });
  }
  /** Scopes that are baseline requirements of the protected resource itself. */
  getProtectedResourceScopes(resourceServer) {
    return this.normalizeProtectedResourceScopes(resourceServer.resourceMetadata.scopes_supported ?? []);
  }
  /** Deduplicate resource-facing scopes and remove authorization-server-only capabilities. */
  normalizeProtectedResourceScopes(scopes) {
    return baselineResourceScopes(scopes);
  }
  /**
  * Handles the OAuth Protected Resource Metadata endpoint
  * Implements RFC 9728 for OAuth Protected Resource Metadata
  * @param requestUrl - The URL of the incoming request
  * @returns Response with protected resource metadata
  */
  handleProtectedResourceMetadata(requestUrl, resourceServer) {
    const rm = resourceServer.resourceMetadata;
    const authorizationServer = this.getAuthorizationServerIssuer(requestUrl);
    const resourceScopes = this.getProtectedResourceScopes(resourceServer);
    const metadata = {
      resource: rm.resource,
      authorization_servers: rm.authorization_servers ?? [authorizationServer],
      ...resourceScopes.length > 0 ? { scopes_supported: resourceScopes } : {},
      bearer_methods_supported: rm.bearer_methods_supported ?? ["header"]
    };
    if (rm.resource_name) metadata.resource_name = rm.resource_name;
    return new Response(JSON.stringify(metadata), { headers: { "Content-Type": "application/json" } });
  }
  /**
  * Handles client authentication and token issuance via the token endpoint
  * Supports authorization_code and refresh_token grant types
  * @param body - The parsed request body
  * @param clientInfo - The authenticated client information
  * @param env - Cloudflare Worker environment variables
  * @returns Response with token data or error
  */
  async handleTokenRequest(body, clientInfo, clientAuthMethod, env, requestUrl, request) {
    try {
      const grantType = body.grant_type;
      if (!(grantType === GrantType.AUTHORIZATION_CODE || grantType === GrantType.REFRESH_TOKEN || grantType === GrantType.TOKEN_EXCHANGE && !!this.options.allowTokenExchangeGrant || grantType === GrantType.JWT_BEARER && !!this.options.enterpriseManagedAuthorization)) return this.createErrorResponse("unsupported_grant_type", { description: "Grant type not supported" }, {
        category: "token-endpoint-request",
        reason: "grant_type_not_supported"
      });
      if (grantType !== GrantType.JWT_BEARER && Array.isArray(clientInfo.grantTypes)) {
        const registered = clientInfo.grantTypes;
        if (!(registered.includes(grantType) || grantType === GrantType.REFRESH_TOKEN && registered.includes(GrantType.AUTHORIZATION_CODE))) return this.createErrorResponse("unauthorized_client", { description: "The client is not registered for this grant type" }, {
          category: "token-endpoint-request",
          reason: "grant_type_not_registered"
        });
      }
      if (grantType !== GrantType.REFRESH_TOKEN) this.validateTokenRequestResourceIndicator(body.resource);
      if (grantType === GrantType.AUTHORIZATION_CODE) return await this.handleAuthorizationCodeGrant(body, clientInfo, env);
      else if (grantType === GrantType.REFRESH_TOKEN) return await this.handleRefreshTokenGrant(body, clientInfo, env);
      else if (grantType === GrantType.TOKEN_EXCHANGE && this.options.allowTokenExchangeGrant) return await this.handleTokenExchangeGrant(body, clientInfo, env);
      else if (grantType === GrantType.JWT_BEARER) return await this.handleJwtBearerGrant(body, clientInfo, clientAuthMethod, env, requestUrl, request);
      throw new Error("Unreachable supported grant type");
    } catch (error) {
      const response = this.createOAuthErrorResponse(error);
      if (response) return response;
      throw error;
    }
  }
  /**
  * Build a structured OAuth token-endpoint response from an OAuth error.
  *
  * The supported form is throwing this package's exported `OAuthError` from
  * token issuance or `tokenExchangeCallback`. Anything else is re-thrown so
  * unexpected failures still surface as 500s.
  */
  /**
  * Run `tokenExchangeCallback`. An `invalid_grant` it throws means the grant can never work again
  * (RFC 6749 §5.2: invalid, expired, or revoked; transient failures are `temporarily_unavailable`),
  * so the grant it ran for is revoked, with its tokens, before the error answers. A failed
  * revocation is logged and the callback's error still answers the request.
  */
  async callTokenExchangeCallback(options, env) {
    try {
      return await Promise.resolve(this.options.tokenExchangeCallback({
        ...options,
        env
      }));
    } catch (error) {
      if (error instanceof OAuthError && error.code === "invalid_grant") try {
        await this.createOAuthHelpers(env).revokeGrant(options.grantId, options.userId);
      } catch (revokeError) {
        console.warn(`Failed to revoke grant ${options.grantId} after tokenExchangeCallback answered invalid_grant:`, revokeError);
      }
      throw error;
    }
  }
  createOAuthErrorResponse(error) {
    if (!(error instanceof OAuthError)) return void 0;
    return this.createErrorResponse(error.code, error.options, error.options.internal ?? {
      category: "token-exchange-callback",
      reason: "callback_error",
      detail: error
    });
  }
  /**
  * Build a structured protected-resource response from an external-token error.
  *
  * Only this package's exported `ExternalTokenError` is converted. Standard
  * bearer failures receive an RFC 6750 / RFC 9728 challenge unless the caller
  * supplied one. Other errors retain the pre-existing behavior and are re-thrown.
  */
  createExternalTokenErrorResponse(error, resourceMetadataUrl, resourceServer) {
    if (!(error instanceof ExternalTokenError)) return void 0;
    const headers = error.headers ?? {};
    const hasChallenge = Object.keys(headers).some((name) => name.toLowerCase() === "www-authenticate");
    const isBearerError = error.code === "invalid_token" && error.statusCode === 401 || error.code === "insufficient_scope" && error.statusCode === 403;
    let challengeHeaders;
    if (isBearerError && !hasChallenge) {
      const requiredScopes = [...new Set(error.requiredScopes ?? [])];
      if (requiredScopes.some((scope) => !isValidOAuthScopeToken(scope))) throw new TypeError("ExternalTokenError requiredScopes must contain valid OAuth scope tokens");
      challengeHeaders = {
        ...headers,
        "WWW-Authenticate": this.buildWwwAuthenticateHeader(resourceMetadataUrl, error.code, void 0, requiredScopes, resourceServer)
      };
    }
    return this.createErrorResponse(error.code, {
      description: error.description,
      statusCode: error.statusCode,
      headers: challengeHeaders ?? headers
    }, {
      category: "protected-resource",
      reason: "resolver_rejected",
      detail: error
    });
  }
  /**
  * Handles the authorization code grant type
  * Exchanges an authorization code for access and refresh tokens
  * @param body - The parsed request body
  * @param clientInfo - The authenticated client information
  * @param env - Cloudflare Worker environment variables
  * @returns Response with token data or error
  */
  async handleAuthorizationCodeGrant(body, clientInfo, env) {
    const code = body.code;
    const redirectUri = body.redirect_uri;
    const codeVerifier = body.code_verifier;
    if (!code) return this.createErrorResponse("invalid_request", { description: "Authorization code is required" }, {
      category: "authorization-code-grant",
      reason: "code_missing"
    });
    const codeParts = code.split(":");
    if (codeParts.length !== 3) return this.createErrorResponse("invalid_grant", { description: "Invalid authorization code format" }, {
      category: "authorization-code-grant",
      reason: "code_malformed"
    });
    const [userId, grantId, _] = codeParts;
    const grantKey = `grant:${userId}:${grantId}`;
    const grantData = await env.OAUTH_KV.get(grantKey, { type: "json" });
    if (!grantData) return this.createErrorResponse("invalid_grant", { description: "Grant not found or authorization code expired" }, {
      category: "authorization-code-grant",
      reason: "grant_not_found"
    });
    const codeHash = await hashSecret(code);
    if (!grantData.authCodeId || codeHash !== grantData.authCodeId) return this.createErrorResponse("invalid_grant", { description: "Invalid authorization code" }, {
      category: "authorization-code-grant",
      reason: "code_mismatch"
    });
    if (grantData.clientId !== clientInfo.clientId) return this.createErrorResponse("invalid_grant", { description: "Client ID mismatch" }, {
      category: "authorization-code-grant",
      reason: "client_mismatch"
    });
    if (!grantData.authCodeWrappedKey) {
      try {
        await this.createOAuthHelpers(env).revokeGrant(grantId, userId);
      } catch {
      }
      return this.createErrorResponse("invalid_grant", { description: "Authorization code already used" }, {
        category: "authorization-code-grant",
        reason: "code_replayed"
      });
    }
    try {
      if (grantData.codeChallenge) validatePkceCodeChallengeMethod(this.serverCapabilities, grantData.codeChallengeMethod);
      else normalizePkceCodeChallengeMethod(grantData.codeChallengeMethod);
    } catch (error) {
      return this.createErrorResponse("invalid_grant", { description: error instanceof Error ? error.message : "Invalid PKCE code_challenge_method" }, {
        category: "authorization-code-grant",
        reason: "pkce_method_invalid",
        detail: error
      });
    }
    const isPkceEnabled = !!grantData.codeChallenge;
    if (!redirectUri && !isPkceEnabled) return this.createErrorResponse("invalid_request", { description: "redirect_uri is required when not using PKCE" }, {
      category: "authorization-code-grant",
      reason: "redirect_uri_missing"
    });
    if (redirectUri && !isValidRedirectUri(redirectUri, clientInfo.redirectUris)) return this.createErrorResponse("invalid_grant", { description: "Invalid redirect URI" }, {
      category: "authorization-code-grant",
      reason: "redirect_uri_invalid"
    });
    if (redirectUri && grantData.redirectUri !== void 0 && redirectUri !== grantData.redirectUri) return this.createErrorResponse("invalid_grant", { description: "redirect_uri does not match the authorization request" }, {
      category: "authorization-code-grant",
      reason: "redirect_uri_mismatch"
    });
    if (!isPkceEnabled && codeVerifier) return this.createErrorResponse("invalid_request", { description: "code_verifier provided for a flow that did not use PKCE" }, {
      category: "authorization-code-grant",
      reason: "unexpected_code_verifier"
    });
    if (isPkceEnabled) {
      if (!codeVerifier) return this.createErrorResponse("invalid_request", { description: "code_verifier is required for PKCE" }, {
        category: "authorization-code-grant",
        reason: "code_verifier_missing"
      });
      const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
      if (base64UrlEncode(String.fromCharCode(...new Uint8Array(hashBuffer))) !== grantData.codeChallenge) return this.createErrorResponse("invalid_grant", { description: "Invalid PKCE code_verifier" }, {
        category: "authorization-code-grant",
        reason: "code_verifier_mismatch"
      });
    }
    const resourceResolution = this.resolveTokenResource(body.resource, grantData);
    const audience = resourceResolution.audience;
    let accessTokenTTL = this.options.accessTokenTTL;
    let refreshTokenTTL = this.options.refreshTokenTTL;
    const encryptionKey = await unwrapKeyWithToken(code, grantData.authCodeWrappedKey);
    let grantEncryptionKey = encryptionKey;
    let accessTokenEncryptionKey = encryptionKey;
    let encryptedAccessTokenProps = grantData.encryptedProps;
    let tokenScopes = this.downscope(body.scope, grantData.scope);
    if (grantsNoneOfTheRequestedScopes(body.scope, tokenScopes)) return this.createErrorResponse("invalid_scope", { description: "None of the requested scopes were granted" }, {
      category: "authorization-code-grant",
      reason: "scope_not_granted"
    });
    if (this.options.tokenExchangeCallback) {
      const decryptedProps = await decryptProps(encryptionKey, grantData.encryptedProps);
      let grantProps = decryptedProps;
      let accessTokenProps = decryptedProps;
      const callbackOptions = {
        grantType: GrantType.AUTHORIZATION_CODE,
        clientId: clientInfo.clientId,
        subjectClientId: grantData.clientId,
        userId,
        grantId,
        scope: grantData.scope,
        requestedScope: tokenScopes,
        resource: audience,
        props: decryptedProps
      };
      const callbackResult = await this.callTokenExchangeCallback(callbackOptions, env);
      if (callbackResult) {
        if (callbackResult.newProps) {
          grantProps = callbackResult.newProps;
          if (!callbackResult.accessTokenProps) accessTokenProps = callbackResult.newProps;
        }
        if (callbackResult.accessTokenProps) accessTokenProps = callbackResult.accessTokenProps;
        if (callbackResult.accessTokenTTL !== void 0) accessTokenTTL = callbackResult.accessTokenTTL;
        if (callbackResult.refreshTokenTTL !== void 0) {
          if (!isValidRefreshTokenTTL(callbackResult.refreshTokenTTL)) return this.createErrorResponse("invalid_request", { description: `refreshTokenTTL must be 0 (no refresh token) or an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds` }, {
            category: "authorization-code-grant",
            reason: "refresh_token_ttl_invalid"
          });
          refreshTokenTTL = callbackResult.refreshTokenTTL;
        }
        if (callbackResult.accessTokenScope) tokenScopes = this.downscope(callbackResult.accessTokenScope, grantData.scope);
      }
      const grantResult = await encryptProps(grantProps);
      grantData.encryptedProps = grantResult.encryptedData;
      grantEncryptionKey = grantResult.key;
      if (accessTokenProps !== grantProps) {
        const tokenResult = await encryptProps(accessTokenProps);
        encryptedAccessTokenProps = tokenResult.encryptedData;
        accessTokenEncryptionKey = tokenResult.key;
      } else {
        encryptedAccessTokenProps = grantData.encryptedProps;
        accessTokenEncryptionKey = grantEncryptionKey;
      }
    }
    if (!isValidAccessTokenTTL(accessTokenTTL)) return this.createErrorResponse("invalid_request", { description: "Requested token lifetime must be at least 60 seconds" }, {
      category: "authorization-code-grant",
      reason: "requested_ttl_too_short"
    });
    const now = Math.floor(Date.now() / 1e3);
    const useRefreshToken = refreshTokenTTL !== 0;
    delete grantData.codeChallenge;
    delete grantData.codeChallengeMethod;
    delete grantData.authCodeWrappedKey;
    let refreshToken;
    if (useRefreshToken) {
      refreshToken = `${userId}:${grantId}:${generateRandomString(TOKEN_LENGTH)}`;
      const refreshTokenId = await generateTokenId(refreshToken);
      const refreshTokenWrappedKey = await wrapKeyWithToken(refreshToken, grantEncryptionKey);
      const expiresAt = refreshTokenTTL !== void 0 ? now + refreshTokenTTL : void 0;
      grantData.refreshTokenId = refreshTokenId;
      grantData.refreshTokenWrappedKey = refreshTokenWrappedKey;
      grantData.previousRefreshTokenId = void 0;
      grantData.previousRefreshTokenWrappedKey = void 0;
      grantData.expiresAt = expiresAt;
    } else grantData.expiresAt = now + accessTokenTTL;
    if (resourceResolution.grantResourceBackfill) grantData.resource = resourceResolution.grantResourceBackfill;
    await this.saveGrantWithTTL(env, grantKey, grantData, now);
    const tokenResponse = {
      access_token: await this.createAccessToken({
        userId,
        grantId,
        clientId: grantData.clientId,
        scope: tokenScopes,
        encryptedProps: encryptedAccessTokenProps,
        encryptionKey: accessTokenEncryptionKey,
        expiresIn: accessTokenTTL,
        audience,
        env
      }),
      token_type: "bearer",
      expires_in: accessTokenTTL,
      scope: tokenScopes.join(" "),
      resource: audience
    };
    if (refreshToken) tokenResponse.refresh_token = refreshToken;
    return new Response(JSON.stringify(tokenResponse), { headers: {
      "Content-Type": "application/json",
      ...NO_CACHE_HEADERS
    } });
  }
  /**
  * Handles the refresh token grant type
  * Issues a new access token using a refresh token
  * @param body - The parsed request body
  * @param clientInfo - The authenticated client information
  * @param env - Cloudflare Worker environment variables
  * @returns Response with token data or error
  */
  async handleRefreshTokenGrant(body, clientInfo, env) {
    const refreshToken = body.refresh_token;
    if (!refreshToken) return this.createErrorResponse("invalid_request", { description: "Refresh token is required" }, {
      category: "refresh-token-grant",
      reason: "refresh_token_missing"
    });
    const tokenParts = refreshToken.split(":");
    if (tokenParts.length !== 3) return this.createErrorResponse("invalid_grant", { description: "Invalid token format" }, {
      category: "refresh-token-grant",
      reason: "refresh_token_malformed"
    });
    const [userId, grantId, _] = tokenParts;
    const providedTokenHash = await generateTokenId(refreshToken);
    const grantKey = `grant:${userId}:${grantId}`;
    const grantData = await env.OAUTH_KV.get(grantKey, { type: "json" });
    if (!grantData) return this.createErrorResponse("invalid_grant", { description: "Grant not found" }, {
      category: "refresh-token-grant",
      reason: "grant_not_found"
    });
    const isCurrentToken = grantData.refreshTokenId === providedTokenHash;
    const isPreviousToken = grantData.previousRefreshTokenId === providedTokenHash;
    if (!isCurrentToken && !isPreviousToken) return this.createErrorResponse("invalid_grant", { description: "Invalid refresh token" }, {
      category: "refresh-token-grant",
      reason: "refresh_token_mismatch"
    });
    if (grantData.clientId !== clientInfo.clientId) return this.createErrorResponse("invalid_grant", { description: "Client ID mismatch" }, {
      category: "refresh-token-grant",
      reason: "client_mismatch"
    });
    if (grantData.expiresAt !== void 0) {
      const now$1 = Math.floor(Date.now() / 1e3);
      if (grantData.expiresAt - now$1 < KV_MIN_EXPIRATION_TTL_SECONDS) return this.createErrorResponse("invalid_grant", { description: "Refresh token has expired" }, {
        category: "refresh-token-grant",
        reason: "refresh_token_expired"
      });
    }
    const resourceResolution = this.resolveTokenResource(body.resource, grantData);
    const audience = resourceResolution.audience;
    const newAccessToken = `${userId}:${grantId}:${generateRandomString(TOKEN_LENGTH)}`;
    const accessTokenId = await generateTokenId(newAccessToken);
    let accessTokenTTL = this.options.accessTokenTTL;
    let refreshTokenIdleTTL = this.options.refreshTokenIdleTTL;
    let wrappedKeyToUse;
    if (isCurrentToken) wrappedKeyToUse = grantData.refreshTokenWrappedKey;
    else wrappedKeyToUse = grantData.previousRefreshTokenWrappedKey;
    const encryptionKey = await unwrapKeyWithToken(refreshToken, wrappedKeyToUse);
    let grantEncryptionKey = encryptionKey;
    let accessTokenEncryptionKey = encryptionKey;
    let encryptedAccessTokenProps = grantData.encryptedProps;
    let tokenScopes = this.downscope(body.scope, grantData.scope);
    if (grantsNoneOfTheRequestedScopes(body.scope, tokenScopes)) return this.createErrorResponse("invalid_scope", { description: "None of the requested scopes were granted" }, {
      category: "refresh-token-grant",
      reason: "scope_not_granted"
    });
    let grantPropsChanged = false;
    if (this.options.tokenExchangeCallback) {
      const decryptedProps = await decryptProps(encryptionKey, grantData.encryptedProps);
      let grantProps = decryptedProps;
      let accessTokenProps = decryptedProps;
      const callbackOptions = {
        grantType: GrantType.REFRESH_TOKEN,
        clientId: clientInfo.clientId,
        subjectClientId: grantData.clientId,
        userId,
        grantId,
        scope: grantData.scope,
        requestedScope: tokenScopes,
        resource: audience,
        props: decryptedProps
      };
      const callbackResult = await this.callTokenExchangeCallback(callbackOptions, env);
      if (callbackResult) {
        if (callbackResult.newProps) {
          grantProps = callbackResult.newProps;
          grantPropsChanged = true;
          if (!callbackResult.accessTokenProps) accessTokenProps = callbackResult.newProps;
        }
        if (callbackResult.accessTokenProps) accessTokenProps = callbackResult.accessTokenProps;
        if (callbackResult.accessTokenTTL !== void 0) accessTokenTTL = callbackResult.accessTokenTTL;
        if (callbackResult.refreshTokenIdleTTL !== void 0) {
          if (!isValidAccessTokenTTL(callbackResult.refreshTokenIdleTTL)) return this.createErrorResponse("invalid_request", { description: `refreshTokenIdleTTL must be an integer of at least ${KV_MIN_EXPIRATION_TTL_SECONDS} seconds` }, {
            category: "refresh-token-grant",
            reason: "refresh_token_idle_ttl_invalid"
          });
          refreshTokenIdleTTL = callbackResult.refreshTokenIdleTTL;
        }
        if (callbackResult.accessTokenScope) tokenScopes = this.downscope(callbackResult.accessTokenScope, grantData.scope);
      }
      if (grantPropsChanged) {
        const grantResult = await encryptProps(grantProps);
        grantData.encryptedProps = grantResult.encryptedData;
        if (grantResult.key !== encryptionKey) {
          grantEncryptionKey = grantResult.key;
          wrappedKeyToUse = await wrapKeyWithToken(refreshToken, grantEncryptionKey);
        } else grantEncryptionKey = grantResult.key;
      }
      if (accessTokenProps !== grantProps) {
        const tokenResult = await encryptProps(accessTokenProps);
        encryptedAccessTokenProps = tokenResult.encryptedData;
        accessTokenEncryptionKey = tokenResult.key;
      } else {
        encryptedAccessTokenProps = grantData.encryptedProps;
        accessTokenEncryptionKey = grantEncryptionKey;
      }
    }
    const now = Math.floor(Date.now() / 1e3);
    if (grantData.expiresAt !== void 0 && grantData.expiresAt - now < KV_MIN_EXPIRATION_TTL_SECONDS) return this.createErrorResponse("invalid_grant", { description: "Refresh token has expired" }, {
      category: "refresh-token-grant",
      reason: "refresh_token_expired"
    });
    if (refreshTokenIdleTTL !== void 0) grantData.expiresAt = now + refreshTokenIdleTTL;
    if (grantData.expiresAt !== void 0) {
      const remainingRefreshTokenLifetime = grantData.expiresAt - now;
      if (remainingRefreshTokenLifetime > 0) accessTokenTTL = Math.min(accessTokenTTL, remainingRefreshTokenLifetime);
    }
    if (!isValidAccessTokenTTL(accessTokenTTL)) return this.createErrorResponse("invalid_request", { description: "Requested token lifetime must be at least 60 seconds" }, {
      category: "refresh-token-grant",
      reason: "requested_ttl_too_short"
    });
    const accessTokenExpiresAt = now + accessTokenTTL;
    const accessTokenWrappedKey = await wrapKeyWithToken(newAccessToken, accessTokenEncryptionKey);
    const newRefreshToken = `${userId}:${grantId}:${generateRandomString(TOKEN_LENGTH)}`;
    const newRefreshTokenId = await generateTokenId(newRefreshToken);
    const newRefreshTokenWrappedKey = await wrapKeyWithToken(newRefreshToken, grantEncryptionKey);
    grantData.previousRefreshTokenId = providedTokenHash;
    grantData.previousRefreshTokenWrappedKey = wrappedKeyToUse;
    grantData.refreshTokenId = newRefreshTokenId;
    grantData.refreshTokenWrappedKey = newRefreshTokenWrappedKey;
    if (resourceResolution.grantResourceBackfill) grantData.resource = resourceResolution.grantResourceBackfill;
    await this.saveGrantWithTTL(env, grantKey, grantData, now);
    const accessTokenData = {
      id: accessTokenId,
      grantId,
      userId,
      createdAt: now,
      expiresAt: accessTokenExpiresAt,
      audience,
      scope: tokenScopes,
      wrappedEncryptionKey: accessTokenWrappedKey,
      grant: {
        clientId: grantData.clientId,
        scope: grantData.scope,
        encryptedProps: encryptedAccessTokenProps
      }
    };
    try {
      await env.OAUTH_KV.put(`token:${userId}:${grantId}:${accessTokenId}`, JSON.stringify(accessTokenData), { expirationTtl: accessTokenTTL });
    } catch (error) {
      this.throwRetryableTokenStorageErrorIfKvRateLimited(error);
      throw error;
    }
    const tokenResponse = {
      access_token: newAccessToken,
      token_type: "bearer",
      expires_in: accessTokenTTL,
      refresh_token: newRefreshToken,
      scope: tokenScopes.join(" "),
      resource: audience
    };
    return new Response(JSON.stringify(tokenResponse), { headers: {
      "Content-Type": "application/json",
      ...NO_CACHE_HEADERS
    } });
  }
  /**
  * Core token exchange logic (RFC 8693)
  * Performs the actual token exchange operation
  * This method is not private because `OAuthHelpers` needs to call it. Note that since
  * `OAuthProviderImpl` is not exposed outside this module, this is still effectively
  * module-private.
  * @param subjectToken - The subject token to exchange
  * @param requestedScopes - Optional requested scopes, limited to the subject token's scopes
  * @param requestedResource - Optional resource/audience; when present, it must match the configured canonical resource
  * @param expiresIn - Optional TTL override in seconds
  * @param clientInfo - The client making the exchange request
  * @param env - Cloudflare Worker environment variables
  * @returns Promise resolving to token response
  * @throws OAuthError with OAuth error code and description
  */
  async exchangeToken(subjectToken, requestedScopes, requestedResource, expiresIn, clientInfo, env) {
    const tokenSummary = await this.unwrapToken(subjectToken, env);
    if (!tokenSummary) throw new OAuthError("invalid_request", {
      description: "Invalid or expired subject token",
      internal: {
        category: "token-exchange-grant",
        reason: "subject_token_invalid"
      }
    });
    const grantKey = `grant:${tokenSummary.userId}:${tokenSummary.grantId}`;
    const grantData = await env.OAUTH_KV.get(grantKey, { type: "json" });
    if (!grantData) throw new OAuthError("invalid_request", {
      description: "Grant not found",
      internal: {
        category: "token-exchange-grant",
        reason: "grant_not_found"
      }
    });
    const crossClientExchange = grantData.clientId !== clientInfo.clientId;
    const crossClientRejection = /* @__PURE__ */ __name(() => new OAuthError("invalid_request", {
      description: "The subject token was issued to a different client",
      internal: {
        category: "token-exchange-grant",
        reason: "cross_client_subject_token"
      }
    }), "crossClientRejection");
    if (crossClientExchange && !this.options.tokenExchangeCallback) throw crossClientRejection();
    let tokenScopes = this.downscope(requestedScopes, tokenSummary.scope);
    if (grantsNoneOfTheRequestedScopes(requestedScopes, tokenScopes)) throw new OAuthError("invalid_scope", {
      description: "None of the requested scopes were granted",
      internal: {
        category: "token-exchange-grant",
        reason: "scope_not_granted"
      }
    });
    const newAudience = this.resolveTokenExchangeResource(requestedResource, tokenSummary.audience);
    const now = Math.floor(Date.now() / 1e3);
    const subjectTokenRemainingLifetime = tokenSummary.expiresAt - now;
    if (subjectTokenRemainingLifetime < KV_MIN_EXPIRATION_TTL_SECONDS) throw new OAuthError("invalid_request", {
      description: "Subject token is too close to expiry to exchange",
      internal: {
        category: "token-exchange-grant",
        reason: "subject_token_near_expiry"
      }
    });
    let accessTokenTTL = this.options.accessTokenTTL ?? DEFAULT_ACCESS_TOKEN_TTL;
    if (expiresIn !== void 0) {
      if (expiresIn <= 0) throw new OAuthError("invalid_request", {
        description: "Invalid expires_in parameter",
        internal: {
          category: "token-exchange-grant",
          reason: "expires_in_invalid"
        }
      });
      accessTokenTTL = Math.min(expiresIn, subjectTokenRemainingLifetime);
    } else accessTokenTTL = Math.min(accessTokenTTL, subjectTokenRemainingLifetime);
    const subjectTokenData = await env.OAUTH_KV.get(`token:${tokenSummary.userId}:${tokenSummary.grantId}:${tokenSummary.id}`, { type: "json" });
    if (!subjectTokenData) throw new OAuthError("invalid_request", {
      description: "Subject token data not found",
      internal: {
        category: "token-exchange-grant",
        reason: "subject_token_data_missing"
      }
    });
    const encryptionKey = await unwrapKeyWithToken(subjectToken, subjectTokenData.wrappedEncryptionKey);
    let accessTokenEncryptionKey = encryptionKey;
    let encryptedAccessTokenProps = subjectTokenData.grant.encryptedProps;
    if (this.options.tokenExchangeCallback) {
      const decryptedProps = await decryptProps(encryptionKey, subjectTokenData.grant.encryptedProps);
      const callbackOptions = {
        grantType: GrantType.TOKEN_EXCHANGE,
        clientId: clientInfo.clientId,
        subjectClientId: grantData.clientId,
        userId: tokenSummary.userId,
        grantId: tokenSummary.grantId,
        scope: tokenSummary.grant.scope,
        requestedScope: tokenScopes,
        resource: newAudience,
        props: decryptedProps
      };
      const callbackResult = await this.callTokenExchangeCallback(callbackOptions, env);
      if (crossClientExchange && callbackResult?.allowCrossClientExchange !== true) throw crossClientRejection();
      if (callbackResult) {
        let accessTokenProps = decryptedProps;
        if (callbackResult.newProps) {
          if (!callbackResult.accessTokenProps) accessTokenProps = callbackResult.newProps;
        }
        if (callbackResult.accessTokenProps) accessTokenProps = callbackResult.accessTokenProps;
        if (callbackResult.accessTokenTTL !== void 0) accessTokenTTL = Math.min(callbackResult.accessTokenTTL, subjectTokenRemainingLifetime);
        if (accessTokenProps !== decryptedProps) {
          const tokenResult = await encryptProps(accessTokenProps);
          encryptedAccessTokenProps = tokenResult.encryptedData;
          accessTokenEncryptionKey = tokenResult.key;
        }
        if (callbackResult.accessTokenScope) tokenScopes = this.downscope(callbackResult.accessTokenScope, tokenSummary.scope);
      }
    }
    if (!isValidAccessTokenTTL(accessTokenTTL)) throw new OAuthError("invalid_request", {
      description: "Requested token lifetime must be at least 60 seconds",
      internal: {
        category: "token-exchange-grant",
        reason: "requested_ttl_too_short"
      }
    });
    return {
      access_token: await this.createAccessToken({
        userId: tokenSummary.userId,
        grantId: tokenSummary.grantId,
        clientId: clientInfo.clientId,
        scope: tokenScopes,
        encryptedProps: encryptedAccessTokenProps,
        encryptionKey: accessTokenEncryptionKey,
        expiresIn: accessTokenTTL,
        audience: newAudience,
        env
      }),
      issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
      token_type: "bearer",
      expires_in: accessTokenTTL,
      scope: tokenScopes.join(" "),
      resource: newAudience
    };
  }
  /**
  * Handles OAuth 2.0 token exchange requests (RFC 8693)
  * Exchanges an existing access token for a new one with modified characteristics
  * @param body - The parsed request body
  * @param clientInfo - The authenticated client information
  * @param env - Cloudflare Worker environment variables
  * @returns Response with new token data or error
  */
  async handleTokenExchangeGrant(body, clientInfo, env) {
    const subjectToken = body.subject_token;
    const subjectTokenType = body.subject_token_type;
    const requestedTokenType = body.requested_token_type || "urn:ietf:params:oauth:token-type:access_token";
    const requestedScope = body.scope;
    const requestedResource = body.resource;
    if (!subjectToken) return this.createErrorResponse("invalid_request", { description: "subject_token is required" }, {
      category: "token-exchange-grant",
      reason: "subject_token_missing"
    });
    if (!subjectTokenType) return this.createErrorResponse("invalid_request", { description: "subject_token_type is required" }, {
      category: "token-exchange-grant",
      reason: "subject_token_type_missing"
    });
    if (subjectTokenType !== "urn:ietf:params:oauth:token-type:access_token") return this.createErrorResponse("invalid_request", { description: "Only access_token subject_token_type is supported" }, {
      category: "token-exchange-grant",
      reason: "subject_token_type_unsupported"
    });
    if (requestedTokenType !== "urn:ietf:params:oauth:token-type:access_token") return this.createErrorResponse("invalid_request", { description: "Only access_token requested_token_type is supported" }, {
      category: "token-exchange-grant",
      reason: "requested_token_type_unsupported"
    });
    let requestedScopes;
    if (requestedScope) if (typeof requestedScope === "string") requestedScopes = requestedScope.split(" ").filter(Boolean);
    else if (Array.isArray(requestedScope)) requestedScopes = requestedScope;
    else return this.createErrorResponse("invalid_request", { description: "Invalid scope parameter format" }, {
      category: "token-exchange-grant",
      reason: "scope_malformed"
    });
    let expiresIn;
    if (body.expires_in !== void 0) {
      const requestedTTL = parseInt(body.expires_in, 10);
      if (isNaN(requestedTTL) || requestedTTL <= 0) return this.createErrorResponse("invalid_request", { description: "Invalid expires_in parameter" }, {
        category: "token-exchange-grant",
        reason: "expires_in_invalid"
      });
      expiresIn = requestedTTL;
    }
    try {
      const tokenResponse = await this.exchangeToken(subjectToken, requestedScopes, requestedResource, expiresIn, clientInfo, env);
      return new Response(JSON.stringify(tokenResponse), { headers: {
        "Content-Type": "application/json",
        ...NO_CACHE_HEADERS
      } });
    } catch (error) {
      const response = this.createOAuthErrorResponse(error);
      if (response) return response;
      throw error;
    }
  }
  /**
  * Handles the MCP Enterprise-Managed Authorization JWT-bearer grant.
  *
  * Acts as a thin shell around `runEmaPipeline`: gate non-EMA traffic, run
  * the pipeline, translate the typed `EmaValidationError` Result back to a
  * standard OAuth wire response. All validation logic lives in pure
  * functions in `src/ema/`.
  */
  async handleJwtBearerGrant(body, clientInfo, clientAuthMethod, env, requestUrl, request) {
    const enterpriseOptions = this.options.enterpriseManagedAuthorization;
    if (!enterpriseOptions) return this.createErrorResponse("unsupported_grant_type", { description: "Grant type not supported" }, {
      category: "enterprise-managed-authorization",
      reason: "grant_disabled"
    });
    if (clientAuthMethod === "none" && !enterpriseOptions.allowPublicClients) return this.createErrorResponse("invalid_client", {
      description: "Enterprise-managed authorization requires client authentication",
      statusCode: 401
    }, {
      category: "enterprise-managed-authorization",
      reason: "client_authentication_required"
    });
    const result = await this.runEmaPipeline({
      body,
      clientInfo,
      env,
      requestUrl,
      request,
      enterpriseOptions
    });
    if (!result.ok) {
      const wire = emaErrorToWire(result.error);
      return this.createErrorResponse(wire.code, { description: wire.message }, {
        category: "enterprise-managed-authorization",
        reason: result.error.reason,
        detail: result.error
      });
    }
    return new Response(JSON.stringify(result.value), { headers: {
      "Content-Type": "application/json",
      ...NO_CACHE_HEADERS
    } });
  }
  /**
  * Runs the full EMA token-request pipeline as a chain of pure validators
  * and adapter calls. Each step short-circuits on the first failure.
  *
  * Sequence:
  *   parse → validate header → trust issuer → fetch JWKS → select key →
  *   verify signature → validate claims → record jti → parse scope →
  *   run mapper → validate mapper result → compute TTL → mint token.
  */
  async runEmaPipeline(args) {
    const { body, clientInfo, env, requestUrl, request, enterpriseOptions } = args;
    const { jwksProvider, jtiStore } = this;
    const configuredResource = this.resolveNewTokenResource(body.resource);
    if (!jwksProvider || !jtiStore) throw new Error("EMA pipeline invoked without configured adapters");
    const now = Math.floor(Date.now() / 1e3);
    const parsed = parseIdJag(body.assertion, EMA_MAX_JWT_BYTES);
    if (!parsed.ok) return parsed;
    const header = validateIdJagHeader(parsed.value.header, EMA_ID_JAG_JWT_TYPE, EMA_SUPPORTED_JWT_ALGORITHMS);
    if (!header.ok) return header;
    const alg = header.value.alg;
    const trustedIssuer = await resolveTrustedIssuer({
      iss: parsed.value.rawClaims.iss,
      alg,
      resolver: enterpriseOptions.trustedIssuers,
      env,
      request,
      clientInfo
    });
    if (!trustedIssuer.ok) return trustedIssuer;
    const verified = await this.verifyAssertionSignature({
      parsed: parsed.value,
      header: header.value,
      trustedIssuer: trustedIssuer.value,
      jwksProvider,
      now
    });
    if (!verified.ok) return verified;
    const claims = validateIdJagClaims({
      rawClaims: parsed.value.rawClaims,
      trustedIssuer: trustedIssuer.value,
      expectedAudience: trustedIssuer.value.audience ?? this.getAuthorizationServerIssuer(requestUrl),
      clientId: clientInfo.clientId,
      configuredResource,
      now,
      clockSkewSeconds: enterpriseOptions.clockSkewSeconds ?? EMA_DEFAULT_CLOCK_SKEW_SECONDS,
      maxAssertionLifetimeSeconds: enterpriseOptions.maxAssertionLifetimeSeconds ?? EMA_DEFAULT_MAX_ASSERTION_LIFETIME_SECONDS
    });
    if (!claims.ok) return claims;
    const markNow = Math.floor(Date.now() / 1e3);
    const replay = await jtiStore.markUsed({
      issuer: claims.value.claims.iss,
      jti: claims.value.claims.jti,
      exp: claims.value.claims.exp,
      now: markNow,
      env
    });
    if (!replay.ok) return replay;
    const requestedScope = parseEmaScopeParam(body.scope, claims.value.assertionScopes);
    if (!requestedScope.ok) return requestedScope;
    let mapperOutput;
    try {
      mapperOutput = await enterpriseOptions.mapClaims({
        claims: claims.value.claims,
        clientInfo,
        resource: configuredResource,
        requestedScope: requestedScope.value,
        request: args.request,
        env
      });
    } catch {
      return err({ reason: "mapper_threw" });
    }
    const mapped = validateEmaMapperResult(mapperOutput);
    if (!mapped.ok) return mapped;
    const issueNow = Math.floor(Date.now() / 1e3);
    const ttl = computeEmaAccessTokenTTL({
      configuredDefaultSeconds: this.options.accessTokenTTL ?? DEFAULT_ACCESS_TOKEN_TTL,
      assertionExp: claims.value.claims.exp,
      mapperTtl: mapped.value.accessTokenTTL,
      now: issueNow,
      minTtlSeconds: KV_MIN_EXPIRATION_TTL_SECONDS
    });
    if (!ttl.ok) return ttl;
    return ok(await this.issueEmaAccessToken({
      clientId: clientInfo.clientId,
      userId: mapped.value.userId,
      mapperScope: mapped.value.scope,
      mapperProps: mapped.value.props,
      mapperMetadata: mapped.value.metadata,
      assertionScopes: claims.value.assertionScopes,
      resource: configuredResource,
      accessTokenTTLSeconds: ttl.value,
      env,
      now: issueNow
    }));
  }
  /**
  * Verifies the ID-JAG signature against the trusted issuer's JWKS,
  * force-refreshing once on a `kid` miss to accommodate IdP key rotation.
  * Uses the in-memory cached JWKS fetcher with anti-DoS cool-down.
  */
  async verifyAssertionSignature(args) {
    const alg = args.header.alg;
    const { jwksProvider } = args;
    const initialJwks = await jwksProvider.fetch(args.trustedIssuer, {
      forceRefresh: false,
      now: args.now
    });
    if (!initialJwks.ok) return initialJwks;
    let jwk = selectJwk(initialJwks.value, alg, args.header.kid);
    if (!jwk.ok && args.header.kid) {
      const refreshed = await jwksProvider.fetch(args.trustedIssuer, {
        forceRefresh: true,
        now: args.now
      });
      if (!refreshed.ok) return refreshed;
      jwk = selectJwk(refreshed.value, alg, args.header.kid);
    }
    if (!jwk.ok) return jwk;
    if (!await verifyIdJagSignature({
      alg,
      jwk: jwk.value,
      signingInput: args.parsed.signingInput,
      signature: args.parsed.signature
    })) return err({ reason: "signature_failed" });
    return ok(void 0);
  }
  /**
  * Mints the access token for an authorized EMA request.
  *
  * Uses the same grant + access-token machinery as the authorization-code
  * grant: encrypt the props, persist the grant under `grant:userId:grantId`,
  * and create an opaque access token bound to the resource as audience.
  */
  async issueEmaAccessToken(args) {
    const tokenScopes = args.assertionScopes.length > 0 ? this.downscope(args.mapperScope, args.assertionScopes) : args.mapperScope;
    const grantId = generateRandomString(16);
    const { encryptedData, key: encryptionKey } = await encryptProps(args.mapperProps);
    const grant = {
      id: grantId,
      clientId: args.clientId,
      userId: args.userId,
      scope: tokenScopes,
      metadata: args.mapperMetadata ?? null,
      encryptedProps: encryptedData,
      createdAt: args.now,
      expiresAt: args.now + args.accessTokenTTLSeconds,
      resource: args.resource
    };
    await this.saveGrantWithTTL(args.env, `grant:${args.userId}:${grantId}`, grant, args.now);
    return {
      access_token: await this.createAccessToken({
        userId: args.userId,
        grantId,
        clientId: args.clientId,
        scope: tokenScopes,
        encryptedProps: encryptedData,
        encryptionKey,
        expiresIn: args.accessTokenTTLSeconds,
        audience: args.resource,
        env: args.env
      }),
      token_type: "bearer",
      expires_in: args.accessTokenTTLSeconds,
      scope: tokenScopes.join(" "),
      resource: args.resource
    };
  }
  /**
  * Handles an RFC 7009 revocation request from an authenticated client.
  * - Access tokens: Revokes only the specific token
  * - Refresh tokens: Revokes the entire grant (access + refresh tokens)
  * Per RFC 7009 §2.1, the server MUST verify the token was issued to the client making the request.
  * @param body - The parsed request body containing token parameter
  * @param clientInfo - The authenticated client information
  * @param env - Cloudflare Worker environment variables
  * @returns Response confirming revocation or error
  */
  async revokeToken(body, clientInfo, env) {
    const token = body.token;
    const tokenTypeHint = body.token_type_hint;
    if (!token) return this.createErrorResponse("invalid_request", { description: "Token parameter is required" }, {
      category: "token-revocation",
      reason: "token_missing"
    });
    const tokenParts = token.split(":");
    if (tokenParts.length !== 3) return new Response("", { status: 200 });
    const [userId, grantId, _] = tokenParts;
    const tokenId = await generateTokenId(token);
    if (tokenTypeHint === "refresh_token") {
      if (await this.revokeRefreshIfOwned(tokenId, userId, grantId, clientInfo, env)) return new Response("", { status: 200 });
      if (await this.revokeAccessIfOwned(tokenId, userId, grantId, clientInfo, env)) return new Response("", { status: 200 });
    } else {
      if (await this.revokeAccessIfOwned(tokenId, userId, grantId, clientInfo, env)) return new Response("", { status: 200 });
      if (await this.revokeRefreshIfOwned(tokenId, userId, grantId, clientInfo, env)) return new Response("", { status: 200 });
    }
    return new Response("", { status: 200 });
  }
  /** Revoke an access token if it exists and belongs to the requesting client. */
  async revokeAccessIfOwned(tokenId, userId, grantId, clientInfo, env) {
    const tokenData = await env.OAUTH_KV.get(`token:${userId}:${grantId}:${tokenId}`, { type: "json" });
    if (!tokenData) return false;
    const tokenClientId = tokenData.grant?.clientId;
    if (tokenClientId !== void 0) {
      if (tokenClientId !== clientInfo.clientId) return false;
    } else if ((await env.OAUTH_KV.get(`grant:${userId}:${grantId}`, { type: "json" }))?.clientId !== clientInfo.clientId) return false;
    await this.revokeSpecificAccessToken(tokenId, userId, grantId, env);
    return true;
  }
  /** Revoke a refresh token (and its grant) if it exists and belongs to the requesting client. */
  async revokeRefreshIfOwned(tokenId, userId, grantId, clientInfo, env) {
    const grantData = await env.OAUTH_KV.get(`grant:${userId}:${grantId}`, { type: "json" });
    if (!grantData) return false;
    if (!(grantData.refreshTokenId === tokenId || grantData.previousRefreshTokenId === tokenId)) return false;
    if (grantData.clientId !== clientInfo.clientId) return false;
    await this.createOAuthHelpers(env).revokeGrant(grantId, userId);
    return true;
  }
  /**
  * Revokes a specific access token without affecting the refresh token
  * @param tokenId - The hashed token ID
  * @param userId - The user ID extracted from the token
  * @param grantId - The grant ID extracted from the token
  * @param env - Cloudflare Worker environment variables
  */
  async revokeSpecificAccessToken(tokenId, userId, grantId, env) {
    const tokenKey = `token:${userId}:${grantId}:${tokenId}`;
    await env.OAUTH_KV.delete(tokenKey);
  }
  /**
  * Handles the dynamic client registration endpoint (RFC 7591)
  * @param request - The HTTP request
  * @param env - Cloudflare Worker environment variables
  * @returns Response with client registration data or error
  */
  async handleClientRegistration(request, env) {
    if (!this.options.clientRegistrationEndpoint) return this.createErrorResponse("not_implemented", {
      description: "Client registration is not enabled",
      statusCode: 501
    }, {
      category: "client-registration",
      reason: "registration_disabled"
    });
    if (request.method !== "POST") return this.createErrorResponse("invalid_request", {
      description: "Method not allowed",
      statusCode: 405,
      headers: { Allow: "POST, OPTIONS" }
    }, {
      category: "client-registration",
      reason: "method_not_allowed"
    });
    if (parseInt(request.headers.get("Content-Length") || "0", 10) > 1048576) return this.createErrorResponse("invalid_request", {
      description: "Request payload too large, must be under 1 MiB",
      statusCode: 413
    }, {
      category: "client-registration",
      reason: "declared_payload_too_large"
    });
    const callbackRequest = request.clone();
    let parsedJson;
    try {
      const text = await readTextWithLimit(request, 1048576);
      if (text === void 0) {
        callbackRequest.body?.cancel().catch(() => void 0);
        return this.createErrorResponse("invalid_request", {
          description: "Request payload too large, must be under 1 MiB",
          statusCode: 413
        }, {
          category: "client-registration",
          reason: "payload_too_large"
        });
      }
      parsedJson = JSON.parse(text);
    } catch {
      return this.createErrorResponse("invalid_request", {
        description: "Invalid JSON payload",
        statusCode: 400
      }, {
        category: "client-registration",
        reason: "json_malformed"
      });
    }
    let clientMetadata;
    let metadata;
    try {
      clientMetadata = requireJsonObject(parsedJson);
      const capabilities = this.options.disallowPublicClientRegistration ? {
        ...this.serverCapabilities,
        tokenEndpointAuthMethods: this.serverCapabilities.tokenEndpointAuthMethods.filter((method) => method !== "none")
      } : this.serverCapabilities;
      metadata = resolveDynamicClientRegistrationMetadata(clientMetadata, capabilities);
    } catch (error) {
      if (this.options.disallowPublicClientRegistration && wouldRegisterPublicClient(clientMetadata, this.serverCapabilities)) return this.createErrorResponse("invalid_client_metadata", { description: "Public client registration is not allowed" }, {
        category: "client-registration",
        reason: "public_client_forbidden"
      });
      return this.createErrorResponse("invalid_client_metadata", { description: error instanceof Error ? error.message : "Invalid client metadata" }, {
        category: "client-registration",
        reason: "metadata_invalid",
        detail: error
      });
    }
    const authMethod = metadata.tokenEndpointAuthMethod;
    const isPublicClient = authMethod === "none";
    const clientId = generateRandomString(16);
    let clientSecret;
    let hashedSecret;
    if (!isPublicClient) {
      clientSecret = generateRandomString(32);
      hashedSecret = await hashSecret(clientSecret);
    }
    const clientInfo = {
      clientId,
      redirectUris: metadata.redirectUris,
      clientName: metadata.clientName,
      logoUri: metadata.logoUri,
      clientUri: metadata.clientUri,
      policyUri: metadata.policyUri,
      tosUri: metadata.tosUri,
      jwksUri: metadata.jwksUri,
      i18n: metadata.i18n,
      contacts: metadata.contacts,
      grantTypes: metadata.grantTypes,
      responseTypes: metadata.responseTypes,
      registrationDate: Math.floor(Date.now() / 1e3),
      tokenEndpointAuthMethod: authMethod,
      ...metadata.authMethodExplicit ? { authMethodExplicit: true } : {},
      ...!isPublicClient && hashedSecret ? { clientSecret: hashedSecret } : {}
    };
    if (this.options.clientRegistrationCallback) {
      let callbackResult;
      try {
        callbackResult = await Promise.resolve(this.options.clientRegistrationCallback({
          clientMetadata,
          request: callbackRequest
        }));
      } catch (error) {
        return this.createErrorResponse("server_error", {
          description: "Client registration callback failed",
          statusCode: 500
        }, {
          category: "client-registration",
          reason: "callback_failed",
          detail: error
        });
      }
      if (callbackResult !== void 0) return this.createErrorResponse(callbackResult.code || "invalid_client_metadata", {
        description: callbackResult.description || "Client registration denied",
        statusCode: callbackResult.status ?? 400
      }, {
        category: "client-registration",
        reason: "callback_denied",
        detail: callbackResult
      });
    }
    await this.putRegisteredClient(env, clientInfo, clientInfo.registrationDate);
    const response = {
      client_id: clientInfo.clientId,
      redirect_uris: clientInfo.redirectUris,
      client_name: clientInfo.clientName,
      logo_uri: clientInfo.logoUri,
      client_uri: clientInfo.clientUri,
      policy_uri: clientInfo.policyUri,
      tos_uri: clientInfo.tosUri,
      jwks_uri: clientInfo.jwksUri,
      contacts: clientInfo.contacts,
      grant_types: clientInfo.grantTypes,
      response_types: clientInfo.responseTypes,
      token_endpoint_auth_method: clientInfo.tokenEndpointAuthMethod,
      client_id_issued_at: clientInfo.registrationDate
    };
    if (clientInfo.i18n) {
      for (const [key, value] of Object.entries(clientInfo.i18n)) if (!(key in response)) response[key] = value;
    }
    if (clientSecret) {
      response.client_secret = clientSecret;
      response.client_secret_expires_at = this.options.clientRegistrationTTL !== void 0 && clientInfo.registrationDate ? clientInfo.registrationDate + this.options.clientRegistrationTTL : 0;
      response.client_secret_issued_at = clientInfo.registrationDate;
    }
    return new Response(JSON.stringify(response), {
      status: 201,
      headers: {
        "Content-Type": "application/json",
        ...NO_CACHE_HEADERS
      }
    });
  }
  /**
  * Handles API requests by validating the access token and calling the API handler
  * @param request - The HTTP request
  * @param env - Cloudflare Worker environment variables
  * @param ctx - Cloudflare Worker execution context
  * @returns Response from the API handler or error
  */
  async handleApiRequest(request, env, ctx, apiRoute) {
    const url = new URL(request.url);
    const { resourceServer } = apiRoute;
    const configuredResource = resourceServer.resourceMetadata.resource;
    const externalTokenResolver = resourceServer.resolveExternalToken;
    const resourceMetadataUrl = this.getResourceMetadataUrlForRequest(url, resourceServer);
    const challenge = /* @__PURE__ */ __name((error, description, scopes = []) => this.buildWwwAuthenticateHeader(resourceMetadataUrl, error, description, scopes, resourceServer), "challenge");
    const authHeader = request.headers.get("Authorization");
    const bearerMatch = authHeader ? /^Bearer[\t ]+([^\s,]+)$/i.exec(authHeader) : null;
    if (!bearerMatch) return new Response(null, {
      status: 401,
      headers: {
        ...NO_CACHE_HEADERS,
        "WWW-Authenticate": challenge()
      }
    });
    const accessToken = bearerMatch[1];
    const parts = accessToken.split(":");
    const isPossiblyInternalFormat = parts.length === 3;
    let tokenData = null;
    let userId = "";
    let grantId = "";
    if (isPossiblyInternalFormat) {
      [userId, grantId] = parts;
      const id = await generateTokenId(accessToken);
      tokenData = await env.OAUTH_KV.get(`token:${userId}:${grantId}:${id}`, { type: "json" });
    }
    if (!tokenData && (!externalTokenResolver || isIssuedTokenFormat(accessToken))) return this.createErrorResponse("invalid_token", {
      description: "Invalid access token",
      statusCode: 401,
      headers: { "WWW-Authenticate": challenge("invalid_token") }
    }, {
      category: "protected-resource",
      reason: "token_not_found"
    });
    if (tokenData) {
      const tokenAudience = this.resolveStoredTokenAudience(tokenData.audience);
      if (!isExactResource(tokenAudience, configuredResource)) return this.createErrorResponse("invalid_token", {
        description: "Access token is not bound to the configured resource",
        statusCode: 401,
        headers: { "WWW-Authenticate": challenge("invalid_token") }
      }, {
        category: "protected-resource",
        reason: "token_audience_unbound"
      });
      const now = Math.floor(Date.now() / 1e3);
      if (tokenData.expiresAt < now) return this.createErrorResponse("invalid_token", {
        description: "Access token expired",
        statusCode: 401,
        headers: { "WWW-Authenticate": challenge("invalid_token") }
      }, {
        category: "protected-resource",
        reason: "token_expired"
      });
      if (tokenAudience) {
        const requestUrl = new URL(request.url);
        const resourceServer$1 = `${requestUrl.protocol}//${requestUrl.host}${requestUrl.pathname}${requestUrl.search}`;
        if (!(Array.isArray(tokenAudience) ? tokenAudience : [tokenAudience]).some((aud) => audienceMatches(resourceServer$1, aud))) return this.createErrorResponse("invalid_token", {
          description: "Token audience does not match resource server",
          statusCode: 401,
          headers: { "WWW-Authenticate": challenge("invalid_token", "Invalid audience") }
        }, {
          category: "protected-resource",
          reason: "audience_mismatch"
        });
      }
      ctx.props = await decryptProps(await unwrapKeyWithToken(accessToken, tokenData.wrappedEncryptionKey), tokenData.grant.encryptedProps);
      ctx.auth = {
        token: accessToken,
        audience: configuredResource,
        expiresAt: tokenData.expiresAt,
        scope: [...tokenData.scope || tokenData.grant.scope],
        userId: tokenData.userId,
        clientId: tokenData.grant.clientId
      };
    } else if (externalTokenResolver) {
      let ext;
      try {
        ext = await externalTokenResolver({
          token: accessToken,
          request,
          env
        });
      } catch (error) {
        const response = this.createExternalTokenErrorResponse(error, resourceMetadataUrl, resourceServer);
        if (response) return response;
        throw error;
      }
      if (!ext) return this.createErrorResponse("invalid_token", {
        description: "Invalid access token",
        statusCode: 401,
        headers: { "WWW-Authenticate": challenge("invalid_token") }
      }, {
        category: "protected-resource",
        reason: "external_token_rejected"
      });
      if (typeof ext.audience !== "string" || !isExactResource(ext.audience, configuredResource)) return this.createErrorResponse("invalid_token", {
        description: "External access token is not bound to the configured resource",
        statusCode: 401,
        headers: { "WWW-Authenticate": challenge("invalid_token") }
      }, {
        category: "protected-resource",
        reason: "external_audience_unbound"
      });
      if (ext.audience) {
        const requestUrl = new URL(request.url);
        const resourceServer$1 = `${requestUrl.protocol}//${requestUrl.host}${requestUrl.pathname}${requestUrl.search}`;
        if (!(Array.isArray(ext.audience) ? ext.audience : [ext.audience]).some((aud) => audienceMatches(resourceServer$1, aud))) return this.createErrorResponse("invalid_token", {
          description: "Token audience does not match resource server",
          statusCode: 401,
          headers: { "WWW-Authenticate": challenge("invalid_token", "Invalid audience") }
        }, {
          category: "protected-resource",
          reason: "external_audience_mismatch"
        });
      }
      ctx.props = ext.props;
      ctx.auth = {
        token: accessToken,
        audience: configuredResource,
        scope: []
      };
    }
    if (!env.OAUTH_PROVIDER) env.OAUTH_PROVIDER = this.createOAuthHelpers(env);
    const apiHandler = apiRoute.handler;
    if (apiHandler.type === HandlerType.EXPORTED_HANDLER) return apiHandler.handler.fetch(request, env, ctx);
    else return new apiHandler.handler(ctx, env).fetch(request);
  }
  /**
  * Creates the helper methods object for OAuth operations
  * This is passed to the handler functions to allow them to interact with the OAuth system
  * @param env - Cloudflare Worker environment variables
  * @returns An instance of OAuthHelpers
  */
  createOAuthHelpers(env) {
    return new OAuthHelpersImpl(env, this);
  }
  /**
  * Saves a grant to KV with appropriate TTL based on expiration
  * @param env - The environment bindings
  * @param grantKey - The KV key for the grant
  * @param grantData - The grant data to save
  * @param now - Current timestamp in seconds
  */
  async saveGrantWithTTL(env, grantKey, grantData, now) {
    const minExpiration = now + KV_MIN_EXPIRATION_TTL_SECONDS + KV_EXPIRATION_CLAMP_MARGIN_SECONDS;
    const kvOptions = grantData.expiresAt !== void 0 ? { expiration: Math.max(grantData.expiresAt, minExpiration) } : {};
    try {
      await env.OAUTH_KV.put(grantKey, JSON.stringify(grantData), grantPutOptions(grantData, kvOptions));
    } catch (error) {
      this.throwRetryableTokenStorageErrorIfKvRateLimited(error);
      throw error;
    }
  }
  throwRetryableTokenStorageErrorIfKvRateLimited(error) {
    if (!this.isKvRateLimitError(error)) return;
    throw new OAuthError("temporarily_unavailable", {
      description: "Token issuance is temporarily unavailable; retry shortly",
      statusCode: 429,
      headers: { "Retry-After": "30" },
      internal: {
        category: "token-issuance",
        reason: "kv_rate_limited",
        detail: error
      }
    });
  }
  isKvRateLimitError(error) {
    if (!(error instanceof Error)) return false;
    return /KV .*failed: 429 Too Many Requests/i.test(error.message) || /429 Too Many Requests/i.test(error.message);
  }
  /**
  * Fetches client information from KV storage or via CIMD (Client ID Metadata Document)
  * This method is not private because `OAuthHelpers` needs to call it. Note that since
  * `OAuthProviderImpl` is not exposed outside this module, this is still effectively
  * module-private.
  *
  * Supports CIMD: If clientId is an HTTPS URL with a non-root path, the metadata
  * document will be fetched from that URL instead of looking up in KV storage.
  *
  * @param env - Cloudflare Worker environment variables
  * @param clientId - The client ID to look up (can be a regular ID or an HTTPS URL for CIMD)
  * @returns The client information, or null if the client does not exist. Null means
  * definitive absence; failures to determine the answer throw instead (KV errors
  * propagate, and a CIMD metadata fetch failure throws `CimdFetchError`), so an
  * upstream outage is distinguishable from an unregistered client.
  */
  /**
  * Write a client record that is subject to `clientRegistrationTTL`. The record carries
  * the expiry it was written with, so a later token request can tell a registration the
  * provider may renew from a permanent one without listing KV. With the TTL unset the
  * record is written to last, and any stamp from an earlier configuration is dropped.
  */
  async putRegisteredClient(env, client, now) {
    const ttl = this.options.clientRegistrationTTL;
    const { registrationExpiresAt: _previous, ...record } = client;
    if (ttl === void 0) {
      await env.OAUTH_KV.put(`client:${client.clientId}`, JSON.stringify(record));
      return;
    }
    await env.OAUTH_KV.put(`client:${client.clientId}`, JSON.stringify({
      ...record,
      registrationExpiresAt: now + ttl
    }), { expirationTtl: ttl });
  }
  /**
  * Renew a dynamically registered client whose registration has passed half of
  * `clientRegistrationTTL`, so a client still exchanging tokens does not vanish from
  * under its live grants. Without this, a grant that outlives its registration fails
  * every refresh with `invalid_client` although nothing was revoked. Only records
  * stamped with `registrationExpiresAt` qualify: CIMD clients are never stored,
  * `createClient()` records never expire, and a record from before the stamp existed
  * cannot be told from a permanent one, so it keeps its original schedule and
  * re-registers once. The half-life rule bounds this to one write per client per half
  * TTL. Best effort: the token response it follows has already been produced.
  *
  * KV has no compare-and-set, so a `deleteClient()` that lands between the read below and
  * the write is undone by it, as it would be by a concurrent `updateClient()`. The window
  * is one KV round trip, once per client per half TTL; closing it needs the serialised
  * storage of #237.
  */
  async renewClientRegistrationIfDue(env, client, now) {
    const ttl = this.options.clientRegistrationTTL;
    if (ttl === void 0 || client.registrationExpiresAt === void 0) return;
    if (client.registrationExpiresAt - now > ttl / 2) return;
    try {
      const current = await env.OAUTH_KV.get(`client:${client.clientId}`, { type: "json" });
      if (current) await this.putRegisteredClient(env, current, now);
    } catch (error) {
      console.warn(`Failed to renew client registration ${client.clientId}:`, error);
    }
  }
  async getClient(env, clientId) {
    if (isClientIdMetadataDocumentUrl(clientId)) {
      if (!this.options.clientIdMetadataDocumentEnabled) {
        const clientKey$1 = `client:${clientId}`;
        return env.OAUTH_KV.get(clientKey$1, { type: "json" });
      }
      if (!this.hasGlobalFetchStrictlyPublic()) throw new Error(`CIMD is enabled but 'global_fetch_strictly_public' compatibility flag is not set.`);
      try {
        return await fetchClientIdMetadataDocument(clientId, this.serverCapabilities);
      } catch (error) {
        console.warn(`CIMD fetch failed for ${clientId}:`, error instanceof Error ? error.message : error);
        throw new CimdFetchError(clientId, error);
      }
    }
    const clientKey = `client:${clientId}`;
    return env.OAUTH_KV.get(clientKey, { type: "json" });
  }
  /** Resolve a value to the registry's canonical spelling, requiring one value. */
  /**
  * Resolve a stored grant or token resource. A 0.x record may hold an array; it resolves
  * when exactly one configured resource appears in it, so multi-audience grants for two
  * resources this server still hosts are ambiguous and fail closed.
  */
  findStoredConfiguredResource(value) {
    if (!Array.isArray(value)) return this.findConfiguredResource(value);
    const matches = /* @__PURE__ */ new Set();
    for (const entry of value) {
      const configured = this.findConfiguredResource(entry);
      if (configured) matches.add(configured);
    }
    return matches.size === 1 ? [...matches][0] : void 0;
  }
  findConfiguredResource(value) {
    const distinct = Array.isArray(value) ? [...new Set(value)] : [value];
    const singular = distinct.length === 1 ? distinct[0] : void 0;
    if (typeof singular !== "string" || !validateResourceUri(singular)) return void 0;
    return this.resourceServers.map((server) => server.resourceMetadata.resource).find((configured) => isExactResource(singular, configured));
  }
  /**
  * Resolve a client-supplied RFC 8707 resource indicator to a configured resource.
  *
  * An exact match wins. Otherwise a request may name the URL it uses at the resource
  * when that URL differs from a configured resource only by query parameters the
  * configured resource does not constrain, such as `https://mcp.example.com/mcp?mode=x`
  * for `https://mcp.example.com/mcp`. The resource server already treats that URL as
  * covered by the resource (its 401 points at the resource's metadata, and the
  * resource's tokens are accepted there), and RFC 8707 §2.2 lets the authorization
  * server map a requested value to a more general resource. The audience stays the
  * configured resource, so the token is no broader. See {@link findCoveringResource}.
  * Only client requests use this; stored audiences and configuration stay exact.
  */
  findRequestedResource(value) {
    const exact = this.findConfiguredResource(value);
    if (exact) return exact;
    const distinct = Array.isArray(value) ? [...new Set(value)] : [value];
    const singular = distinct.length === 1 ? distinct[0] : void 0;
    if (typeof singular !== "string" || !validateResourceUri(singular)) return void 0;
    return findCoveringResource(singular, this.resourceServers.map((server) => server.resourceMetadata.resource));
  }
  /** Select the audience for a new interactive authorization. */
  resolveAuthorizationRequestResource(requestedResource) {
    if (requestedResource === void 0) {
      const defaultResource = this.getDefaultAuthorizationResource();
      if (defaultResource) return defaultResource;
      throw new AuthorizationError("invalid_target", { description: "The resource parameter is required when the authorization server has multiple resources" });
    }
    const configured = this.findRequestedResource(requestedResource);
    if (!configured) throw new AuthorizationError("invalid_target", { description: "The resource parameter must name exactly one configured protected resource" });
    return configured;
  }
  /** Whether an existing grant belongs to the replacement bucket for a resource. */
  shouldReplaceGrantForResource(grantResource, resource) {
    if (grantResource === void 0) return this.getLegacyGrantResource() === resource;
    return isExactResource(grantResource, resource);
  }
  /** Select the audience for a new non-interactive grant such as EMA. */
  resolveNewTokenResource(requestedResource) {
    try {
      return this.resolveAuthorizationRequestResource(requestedResource);
    } catch (error) {
      if (error instanceof AuthorizationError) throw new OAuthError("invalid_target", {
        description: error.description,
        internal: {
          category: "resource-indicator",
          reason: "resource_invalid",
          detail: error
        }
      });
      throw error;
    }
  }
  /** Validate explicit resource syntax and configured-resource policy. */
  validateTokenRequestResourceIndicator(requestedResource) {
    if (requestedResource === void 0) return;
    if (!this.findRequestedResource(requestedResource)) throw new OAuthError("invalid_target", {
      description: "The resource parameter must name exactly one configured protected resource",
      internal: {
        category: "resource-indicator",
        reason: "resource_not_configured"
      }
    });
  }
  /** Resolve token exchange strictly within the subject token's audience ceiling. */
  resolveTokenExchangeResource(requestedResource, subjectResource) {
    const subjectAudience = this.findStoredConfiguredResource(this.resolveStoredTokenAudience(subjectResource));
    if (!subjectAudience) throw new OAuthError("invalid_target", {
      description: "Subject token is not bound to a configured resource",
      internal: {
        category: "resource-indicator",
        reason: "subject_token_audience_unbound"
      }
    });
    const resourceWasProvided = requestedResource !== void 0;
    const requestedAudience = resourceWasProvided ? this.findRequestedResource(requestedResource) : void 0;
    if (resourceWasProvided && (!requestedAudience || requestedAudience !== subjectAudience)) throw new OAuthError("invalid_target", {
      description: "The requested resource must exactly match the subject token audience",
      internal: {
        category: "resource-indicator",
        reason: "resource_subject_token_mismatch"
      }
    });
    return subjectAudience;
  }
  /**
  * Resolves an access-token audience from a token request and its authorization grant.
  * The configured canonical resource is inherited when omitted and cannot be overridden.
  *
  * The grant is checked before the request. A grant bound to a resource the server no longer
  * hosts fails with `invalid_grant` even when the request names that resource, as a client
  * repeating its grant's resource on refresh does: the grant is the defect, and `invalid_grant`
  * makes conformant clients discard their tokens and re-authorize, where `invalid_target`
  * would make them fail.
  */
  resolveTokenResource(requestedResource, grant) {
    const grantedResource = grant.resource;
    const resourceWasProvided = requestedResource !== void 0;
    const canonicalRequestedResource = resourceWasProvided ? this.findRequestedResource(requestedResource) : void 0;
    const binding = this.resolveGrantBinding(grantedResource);
    if (resourceWasProvided && !canonicalRequestedResource) throw new OAuthError("invalid_target", {
      description: "The resource parameter must name exactly one configured protected resource",
      internal: {
        category: "resource-indicator",
        reason: "resource_not_configured"
      }
    });
    if (resourceWasProvided && canonicalRequestedResource !== binding.resource) throw binding.legacy ? new OAuthError("invalid_target", {
      description: "The requested resource does not match the server legacy-grant migration policy",
      internal: {
        category: "resource-indicator",
        reason: "legacy_grant_resource_mismatch"
      }
    }) : new OAuthError("invalid_target", {
      description: "The requested resource does not match the authorization grant",
      internal: {
        category: "resource-indicator",
        reason: "resource_grant_mismatch"
      }
    });
    return {
      audience: binding.resource,
      ...grantedResource === binding.resource ? {} : { grantResourceBackfill: binding.resource }
    };
  }
  /**
  * The configured resource a stored grant belongs to: the one it is bound to, or for a grant
  * stored with no resource, the legacy-grant migration resource. Throws `invalid_grant` when
  * there is none, since only re-authorization can repair the grant.
  */
  resolveGrantBinding(grantedResource) {
    if (grantedResource !== void 0) {
      const resource$1 = this.findStoredConfiguredResource(grantedResource);
      if (!resource$1) throw new OAuthError("invalid_grant", {
        description: "The authorization grant is bound to a resource this server no longer serves. Authorize again.",
        internal: {
          category: "resource-indicator",
          reason: "grant_audience_unbound"
        }
      });
      return {
        resource: resource$1,
        legacy: false
      };
    }
    const resource = this.getLegacyGrantResource();
    if (!resource) throw new OAuthError("invalid_grant", {
      description: "This legacy authorization grant has no resource binding and must be reauthorized",
      internal: {
        category: "resource-indicator",
        reason: "legacy_grant_unbound"
      }
    });
    return {
      resource,
      legacy: true
    };
  }
  /**
  * Creates and stores an access token
  * @param params - Options for creating the access token
  * @returns The access token string
  */
  async createAccessToken(params) {
    const { userId, grantId, clientId, scope, encryptedProps, encryptionKey, expiresIn, audience, env } = params;
    if (!isValidAccessTokenTTL(expiresIn)) throw new OAuthError("invalid_request", {
      description: "Requested token lifetime must be at least 60 seconds",
      internal: {
        category: "token-issuance",
        reason: "requested_ttl_too_short"
      }
    });
    const accessToken = `${userId}:${grantId}:${generateRandomString(TOKEN_LENGTH)}`;
    const now = Math.floor(Date.now() / 1e3);
    const accessTokenId = await generateTokenId(accessToken);
    const accessTokenData = {
      id: accessTokenId,
      grantId,
      userId,
      createdAt: now,
      expiresAt: now + expiresIn,
      audience,
      scope,
      wrappedEncryptionKey: await wrapKeyWithToken(accessToken, encryptionKey),
      grant: {
        clientId,
        scope,
        encryptedProps
      }
    };
    try {
      await env.OAUTH_KV.put(`token:${userId}:${grantId}:${accessTokenId}`, JSON.stringify(accessTokenData), { expirationTtl: expiresIn });
    } catch (error) {
      this.throwRetryableTokenStorageErrorIfKvRateLimited(error);
      throw error;
    }
    return accessToken;
  }
  /**
  * Restricts requested scopes to the scopes available for the current flow.
  * If no scope is requested, all available scopes are returned.
  * @param requestedScope - The scope parameter from the request (string or array)
  * @param allowedScopes - The maximum scopes available for the current flow
  * @returns The requested scopes that are included in the allowed scopes
  */
  downscope(requestedScope, allowedScopes) {
    if (!requestedScope) return allowedScopes;
    return (typeof requestedScope === "string" ? requestedScope.split(" ").filter(Boolean) : requestedScope).filter((scope) => allowedScopes.includes(scope));
  }
  /**
  * Checks if the global_fetch_strictly_public compatibility flag is enabled.
  * This flag is required for CIMD to prevent SSRF attacks.
  * See: https://developers.cloudflare.com/workers/configuration/compatibility-flags/#global-fetch-strictly-public
  */
  hasGlobalFetchStrictlyPublic() {
    return !!(typeof Cloudflare !== "undefined" && Cloudflare.compatibilityFlags ? Cloudflare.compatibilityFlags : null)?.global_fetch_strictly_public;
  }
  /**
  * Builds a WWW-Authenticate header value with resource_metadata per RFC 9728 §5.1
  */
  buildWwwAuthenticateHeader(resourceMetadataUrl, error, errorDescription, requiredScopes = [], resourceServer = this.resourceServers[0]) {
    let header = 'Bearer realm="OAuth"';
    if (resourceMetadataUrl) header += `, resource_metadata="${resourceMetadataUrl}"`;
    if (error) header += `, error="${error}"`;
    const challengeScopes = requiredScopes.length > 0 ? this.normalizeProtectedResourceScopes(requiredScopes) : this.getProtectedResourceScopes(resourceServer);
    if (challengeScopes.length > 0) header += `, scope="${challengeScopes.join(" ")}"`;
    if (errorDescription) header += `, error_description="${errorDescription}"`;
    return header;
  }
  /** Build the RFC 9728 well-known URL for the configured canonical resource. */
  getConfiguredResourceMetadataUrl(resource) {
    const authorityStart = resource.indexOf("://") + 3;
    const suffixOffset = resource.slice(authorityStart).search(/[/?]/);
    const suffixStart = suffixOffset === -1 ? resource.length : authorityStart + suffixOffset;
    let suffix = resource.slice(suffixStart);
    if (suffix === "/") suffix = "";
    if (suffix.startsWith("/?")) suffix = suffix.slice(1);
    return resource.slice(0, suffixStart) + PROTECTED_RESOURCE_WELL_KNOWN_PREFIX + suffix;
  }
  /**
  * RFC 9728 §3.3 requires metadata fetched from a challenge to identify the
  * original protected-resource URL. Descendant and alias routes can still use
  * a base audience, but must not advertise a document for a different URL.
  */
  getResourceMetadataUrlForRequest(requestUrl, resourceServer) {
    const configuredResource = resourceServer.resourceMetadata.resource;
    if (isExactResource(requestUrl.href, configuredResource)) return this.getConfiguredResourceMetadataUrl(configuredResource);
    const resourceUrl = new URL(configuredResource);
    if (requestUrl.origin === resourceUrl.origin && requestCarriesResourceQuery(requestUrl, resourceUrl) && isPathDescendant(requestUrl.pathname, resourceUrl.pathname)) return this.getConfiguredResourceMetadataUrl(configuredResource);
  }
  /**
  * Helper function to create OAuth error responses.
  *
  * `internal` (optional) carries a tagged, server-side-only reason. It is
  * forwarded to the deployer's `onError` hook but never placed on the wire,
  * so the public response stays RFC-compliant and free of information leak
  * while the deployer can still observe which check failed.
  */
  createErrorResponse(code, options, internal, request) {
    const { description } = options;
    const responseStatus = options.statusCode ?? 400;
    const responseHeaders = {
      ...NO_CACHE_HEADERS,
      ...options.headers ?? {}
    };
    const customErrorResponse = this.options.onError?.({
      code,
      description,
      status: responseStatus,
      headers: responseHeaders,
      internal,
      ...request ? { request } : {}
    });
    const body = JSON.stringify({
      error: code,
      error_description: description
    });
    const response = customErrorResponse ?? new Response(body, {
      status: responseStatus,
      headers: {
        "Content-Type": "application/json",
        ...responseHeaders
      }
    });
    this.errorResponses.add(response);
    return response;
  }
};
var ExternalTokenError = class extends Error {
  static {
    __name(this, "ExternalTokenError");
  }
  /**
  * Creates an intentional external-token validation error.
  * @param code - Standard OAuth error code to return
  * @param options - Public response details
  */
  constructor(code, options) {
    super(options.description);
    this.name = "ExternalTokenError";
    this.code = code;
    this.description = options.description;
    this.statusCode = options.statusCode;
    this.headers = options.headers;
    this.requiredScopes = options.requiredScopes;
  }
};
var CimdFetchError = class extends Error {
  static {
    __name(this, "CimdFetchError");
  }
  /**
  * Creates an error for a failed CIMD fetch or validation.
  * @param metadataUrl - The CIMD URL that could not be resolved
  * @param cause - The underlying fetch or validation failure
  */
  constructor(metadataUrl, cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`CIMD fetch failed for ${metadataUrl}: ${detail}`);
    this.reason = "metadata_resolution_failed";
    this.name = "CimdFetchError";
    this.metadataUrl = metadataUrl;
    this.detail = detail;
  }
};
var DEFAULT_ACCESS_TOKEN_TTL = 3600;
var DEFAULT_REFRESH_TOKEN_TTL = 720 * 60 * 60;
var DEFAULT_CLIENT_REGISTRATION_TTL = 2160 * 60 * 60;
var KV_MIN_EXPIRATION_TTL_SECONDS = 60;
function wouldRegisterPublicClient(clientMetadata, server) {
  if (!clientMetadata) return false;
  try {
    return resolveDynamicClientRegistrationMetadata(clientMetadata, server).tokenEndpointAuthMethod === "none";
  } catch {
    return false;
  }
}
__name(wouldRegisterPublicClient, "wouldRegisterPublicClient");
function withRequiredScopes(metadata, requiredScopes) {
  if (!metadata || typeof metadata !== "object") return metadata;
  const { scopes_supported: deprecated, ...rest } = metadata;
  const scopes = resolveRequiredScopes(requiredScopes, deprecated);
  return scopes === void 0 ? rest : {
    ...rest,
    scopes_supported: scopes
  };
}
__name(withRequiredScopes, "withRequiredScopes");
function isValidRefreshTokenTTL(ttl) {
  return ttl === 0 || isValidAccessTokenTTL(ttl);
}
__name(isValidRefreshTokenTTL, "isValidRefreshTokenTTL");
function parsePurgeCursor(cursor) {
  if (cursor === void 0) return { phase: "grants" };
  const separator = cursor.indexOf(":");
  const phase = cursor.slice(0, separator);
  if (separator < 0 || phase !== "grants" && phase !== "tokens") throw new TypeError("Invalid purgeExpiredData cursor");
  const kvCursor = cursor.slice(separator + 1);
  return kvCursor ? {
    phase,
    kvCursor
  } : { phase };
}
__name(parsePurgeCursor, "parsePurgeCursor");
function grantsNoneOfTheRequestedScopes(requested, granted) {
  return (typeof requested === "string" ? requested.split(" ").filter(Boolean) : requested ?? []).length > 0 && granted.length === 0;
}
__name(grantsNoneOfTheRequestedScopes, "grantsNoneOfTheRequestedScopes");
async function readTextWithLimit(request, maxBytes) {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let total = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      reader.cancel().catch(() => void 0);
      return;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
__name(readTextWithLimit, "readTextWithLimit");
function isValidAccessTokenTTL(value) {
  return Number.isInteger(value) && value >= KV_MIN_EXPIRATION_TTL_SECONDS;
}
__name(isValidAccessTokenTTL, "isValidAccessTokenTTL");
var KV_EXPIRATION_CLAMP_MARGIN_SECONDS = 5;
var DEFAULT_PURGE_BATCH_SIZE = 50;
var MAX_KV_LIST_LIMIT = 1e3;
var DEFAULT_REVOKE_EXISTING_GRANTS_BATCH_SIZE = 50;
var MAX_KV_METADATA_BYTES = 1024;
function grantKeyMetadata(grant) {
  const metadata = { clientId: grant.clientId };
  if (grant.resource !== void 0) metadata.resource = grant.resource;
  if (grant.redirectUri !== void 0) metadata.redirectUri = grant.redirectUri;
  return new TextEncoder().encode(JSON.stringify(metadata)).byteLength <= MAX_KV_METADATA_BYTES ? metadata : void 0;
}
__name(grantKeyMetadata, "grantKeyMetadata");
function grantPutOptions(grant, expiry = {}) {
  const metadata = grantKeyMetadata(grant);
  return metadata ? {
    ...expiry,
    metadata
  } : expiry;
}
__name(grantPutOptions, "grantPutOptions");
function parseGrantKey(name) {
  const rest = name.slice(6);
  const separator = rest.lastIndexOf(":");
  if (!name.startsWith("grant:") || separator <= 0 || separator === rest.length - 1) return void 0;
  return {
    userId: rest.slice(0, separator),
    grantId: rest.slice(separator + 1)
  };
}
__name(parseGrantKey, "parseGrantKey");
function isGrantKeyMetadata(value) {
  if (typeof value !== "object" || value === null) return false;
  const { clientId, resource, redirectUri } = value;
  return typeof clientId === "string" && (resource === void 0 || typeof resource === "string" || Array.isArray(resource)) && (redirectUri === void 0 || typeof redirectUri === "string");
}
__name(isGrantKeyMetadata, "isGrantKeyMetadata");
var TOKEN_LENGTH = 32;
var ISSUED_GRANT_ID_PATTERN = /^[A-Za-z0-9_-]{16}$/;
var ISSUED_TOKEN_SECRET_PATTERN = /* @__PURE__ */ new RegExp(`^[A-Za-z0-9_-]{${TOKEN_LENGTH}}$`);
function audienceMatches(resourceServerUrl, audienceValue) {
  try {
    const resource = new URL(resourceServerUrl);
    const audience = new URL(audienceValue);
    if (resource.origin !== audience.origin) return false;
    if (!requestCarriesResourceQuery(resource, audience)) return false;
    if (audience.pathname === "/" || audience.pathname === "") return true;
    const descendantPrefix = audience.pathname.endsWith("/") ? audience.pathname : audience.pathname + "/";
    return resource.pathname === audience.pathname || resource.pathname.startsWith(descendantPrefix);
  } catch {
    return false;
  }
}
__name(audienceMatches, "audienceMatches");
function isExactResource(value, configuredResource) {
  if (Array.isArray(value)) return value.some((entry) => typeof entry === "string" && resourceMatches(entry, configuredResource));
  return typeof value === "string" && resourceMatches(value, configuredResource);
}
__name(isExactResource, "isExactResource");
function withoutBodyForHead(request, response) {
  if (request.method !== "HEAD") return response;
  return new Response(null, {
    status: response.status,
    headers: response.headers
  });
}
__name(withoutBodyForHead, "withoutBodyForHead");
function isPathDescendant(candidate, base) {
  if (base === "" || base === "/") return true;
  if (base.endsWith("/")) return candidate.startsWith(base);
  return candidate === base || candidate.startsWith(`${base}/`);
}
__name(isPathDescendant, "isPathDescendant");
async function hashSecret(secret) {
  return generateTokenId(secret);
}
__name(hashSecret, "hashSecret");
function parseBasicAuthorizationHeader(header) {
  if (!header) return { kind: "not-basic" };
  const schemeEnd = header.search(/[ \t]/);
  if ((schemeEnd === -1 ? header : header.slice(0, schemeEnd)).toLowerCase() !== "basic") return { kind: "not-basic" };
  if (schemeEnd === -1) return { kind: "malformed" };
  const encodedCredentials = header.slice(schemeEnd).trim();
  if (!encodedCredentials || /[ \t]/.test(encodedCredentials)) return { kind: "malformed" };
  try {
    const credentials = atob(encodedCredentials);
    const separatorIndex = credentials.indexOf(":");
    if (separatorIndex === -1) return { kind: "malformed" };
    return {
      kind: "credentials",
      clientId: decodeFormUrlEncodedComponent(credentials.slice(0, separatorIndex)),
      clientSecret: decodeFormUrlEncodedComponent(credentials.slice(separatorIndex + 1))
    };
  } catch {
    return { kind: "malformed" };
  }
}
__name(parseBasicAuthorizationHeader, "parseBasicAuthorizationHeader");
function decodeFormUrlEncodedComponent(value) {
  return decodeURIComponent(value.replace(/\+/g, " "));
}
__name(decodeFormUrlEncodedComponent, "decodeFormUrlEncodedComponent");
function isIssuedTokenFormat(token) {
  const parts = token.split(":");
  if (parts.length < 3) return false;
  const secret = parts[parts.length - 1];
  const grantId = parts[parts.length - 2];
  return parts.slice(0, -2).join(":").length > 0 && ISSUED_GRANT_ID_PATTERN.test(grantId) && ISSUED_TOKEN_SECRET_PATTERN.test(secret);
}
__name(isIssuedTokenFormat, "isIssuedTokenFormat");
function generateRandomString(length) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let result = "";
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  for (let i = 0; i < length; i++) result += characters.charAt(values[i] % 64);
  return result;
}
__name(generateRandomString, "generateRandomString");
async function generateTokenId(token) {
  const data = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(generateTokenId, "generateTokenId");
function isLoopbackUri(uri) {
  try {
    return isLoopbackHostname(new URL(uri).hostname);
  } catch {
    return false;
  }
}
__name(isLoopbackUri, "isLoopbackUri");
function isValidRedirectUri(requestUri, registeredUris) {
  return registeredUris.some((registered) => {
    if (isLoopbackUri(requestUri) && isLoopbackUri(registered)) try {
      const reqUrl = new URL(requestUri);
      const regUrl = new URL(registered);
      return reqUrl.protocol === regUrl.protocol && reqUrl.hostname === regUrl.hostname && reqUrl.pathname === regUrl.pathname && reqUrl.search === regUrl.search;
    } catch {
      return false;
    }
    return requestUri === registered;
  });
}
__name(isValidRedirectUri, "isValidRedirectUri");
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
__name(base64UrlEncode, "base64UrlEncode");
function arrayBufferToBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}
__name(base64ToArrayBuffer, "base64ToArrayBuffer");
async function encryptProps(data) {
  const key = await crypto.subtle.generateKey({
    name: "AES-GCM",
    length: 256
  }, true, ["encrypt", "decrypt"]);
  const iv = new Uint8Array(12);
  const jsonData = JSON.stringify(data);
  const encodedData = new TextEncoder().encode(jsonData);
  return {
    encryptedData: arrayBufferToBase64(await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv
    }, key, encodedData)),
    key
  };
}
__name(encryptProps, "encryptProps");
async function decryptProps(key, encryptedData) {
  const encryptedBuffer = base64ToArrayBuffer(encryptedData);
  const iv = new Uint8Array(12);
  const decryptedBuffer = await crypto.subtle.decrypt({
    name: "AES-GCM",
    iv
  }, key, encryptedBuffer);
  const jsonData = new TextDecoder().decode(decryptedBuffer);
  return JSON.parse(jsonData);
}
__name(decryptProps, "decryptProps");
var WRAPPING_KEY_HMAC_KEY = new Uint8Array([
  34,
  126,
  38,
  134,
  141,
  241,
  225,
  109,
  128,
  112,
  234,
  23,
  151,
  91,
  71,
  166,
  130,
  24,
  250,
  135,
  40,
  174,
  222,
  133,
  181,
  29,
  74,
  217,
  150,
  202,
  202,
  67
]);
async function deriveKeyFromToken(tokenStr) {
  const encoder = new TextEncoder();
  const hmacKey$1 = await crypto.subtle.importKey("raw", WRAPPING_KEY_HMAC_KEY, {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign"]);
  const hmacResult = await crypto.subtle.sign("HMAC", hmacKey$1, encoder.encode(tokenStr));
  return await crypto.subtle.importKey("raw", hmacResult, { name: "AES-KW" }, false, ["wrapKey", "unwrapKey"]);
}
__name(deriveKeyFromToken, "deriveKeyFromToken");
async function wrapKeyWithToken(tokenStr, keyToWrap) {
  const wrappingKey = await deriveKeyFromToken(tokenStr);
  return arrayBufferToBase64(await crypto.subtle.wrapKey("raw", keyToWrap, wrappingKey, { name: "AES-KW" }));
}
__name(wrapKeyWithToken, "wrapKeyWithToken");
async function unwrapKeyWithToken(tokenStr, wrappedKeyBase64) {
  const wrappingKey = await deriveKeyFromToken(tokenStr);
  const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64);
  return await crypto.subtle.unwrapKey("raw", wrappedKeyBuffer, wrappingKey, { name: "AES-KW" }, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}
__name(unwrapKeyWithToken, "unwrapKeyWithToken");
var OAuthHelpersImpl = class {
  static {
    __name(this, "OAuthHelpersImpl");
  }
  /**
  * Creates a new OAuthHelpers instance
  * @param env - Cloudflare Worker environment variables
  * @param provider - Reference to the parent provider instance
  */
  constructor(env, provider) {
    this.env = env;
    this.provider = provider;
  }
  /**
  * Parses an OAuth authorization request from the HTTP request
  * @param request - The HTTP request containing OAuth parameters
  * @returns The parsed authorization request parameters
  * @throws AuthorizationError for expected authorization-request validation failures
  * @throws CimdFetchError when the client ID is a CIMD URL whose document cannot be resolved
  */
  async parseAuthRequest(request) {
    const url = new URL(request.url);
    if (this.provider.hasExplicitIssuer && !this.provider.isAuthorizationEndpointRequest(url)) throw new AuthorizationError("invalid_request", { description: "Authorization request was sent to an unconfigured endpoint" });
    const responseType = url.searchParams.get("response_type") || "";
    const clientId = url.searchParams.get("client_id") || "";
    const redirectUri = url.searchParams.get("redirect_uri") || "";
    const scope = (url.searchParams.get("scope") || "").split(" ").filter(Boolean);
    const state = url.searchParams.get("state") || "";
    const codeChallenge = url.searchParams.get("code_challenge") || void 0;
    const codeChallengeMethod = url.searchParams.get("code_challenge_method") || void 0;
    const issuer = this.provider.getAuthorizationServerIssuer(url);
    const resourceParams = url.searchParams.getAll("resource");
    const resourceParam = resourceParams.length > 0 ? resourceParams.length === 1 ? resourceParams[0] : resourceParams : void 0;
    if (!clientId) throw new AuthorizationError("invalid_request", { description: "client_id is required" });
    const clientInfo = await this.lookupClient(clientId);
    if (!clientInfo) throw new AuthorizationError("invalid_request", { description: "Invalid client_id" });
    try {
      validateRedirectUri(redirectUri, this.provider.serverCapabilities);
    } catch {
      throw new AuthorizationError("invalid_request", { description: "Invalid redirect URI" });
    }
    if (!redirectUri || !isValidRedirectUri(redirectUri, clientInfo.redirectUris)) throw new AuthorizationError("invalid_request", { description: "Invalid redirect URI" });
    const withRedirect = /* @__PURE__ */ __name((error) => {
      throw withAuthorizationRedirect(error, redirectUri, state || void 0, issuer);
    }, "withRedirect");
    let resource;
    try {
      resource = this.provider.resolveAuthorizationRequestResource(resourceParam);
    } catch (error) {
      if (error instanceof AuthorizationError) withRedirect(error);
      throw error;
    }
    try {
      validateAuthorizationResponseType(this.provider.serverCapabilities, responseType, clientInfo.responseTypes);
      validateAuthorizationPkce(this.provider.serverCapabilities, {
        responseType,
        codeChallenge,
        codeChallengeMethod
      }, clientInfo);
    } catch (error) {
      if (error instanceof AuthorizationError) withRedirect(error);
      throw error;
    }
    return {
      responseType,
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod,
      resource,
      issuer
    };
  }
  /**
  * Looks up a client by its client ID
  * @param clientId - The client ID to look up
  * @returns A Promise resolving to the client info, or null if the client does not
  * exist. Null means definitive absence; failures to determine the answer throw
  * instead (KV errors propagate, and a CIMD metadata fetch failure throws
  * `CimdFetchError`), so an upstream outage cannot masquerade as an unregistered
  * client.
  * @throws CimdFetchError when the client ID is a CIMD URL and fetching or
  * validating the metadata document fails.
  */
  async lookupClient(clientId) {
    const client = await this.provider.getClient(this.env, clientId);
    return client ? toPublicClientInfo(client) : null;
  }
  /**
  * Completes an authorization request by creating a grant and an authorization code.
  * @param options - Options specifying the grant details
  * @returns A Promise resolving to an object containing the redirect URL
  * @throws Error when the request's response type is not permitted
  * @throws CimdFetchError when the client ID is a CIMD URL whose document cannot be resolved
  */
  async completeAuthorization(options) {
    const { clientId, redirectUri } = options.request;
    if (!clientId || !redirectUri) throw new Error("Client ID and Redirect URI are required in the authorization request.");
    if (typeof options.userId !== "string" || options.userId.length === 0 || options.userId.includes(":")) throw new TypeError('userId must be a non-empty string without ":"');
    const clientInfo = await this.lookupClient(clientId);
    if (!clientInfo || !isValidRedirectUri(redirectUri, clientInfo.redirectUris)) throw new Error("Invalid redirect URI. The redirect URI provided does not match any registered URI for this client.");
    try {
      validateRedirectUri(redirectUri, this.provider.serverCapabilities);
    } catch {
      throw new AuthorizationError("invalid_request", { description: "Invalid redirect URI" });
    }
    validateAuthorizationResponseType(this.provider.serverCapabilities, options.request.responseType, clientInfo.responseTypes);
    const effectiveResource = this.provider.resolveAuthorizationRequestResource(options.request.resource);
    validateAuthorizationPkce(this.provider.serverCapabilities, options.request, clientInfo);
    let grantsToRevoke = [];
    if (options.revokeExistingGrants !== false) {
      const isCimdClient = isClientIdMetadataDocumentUrl(clientId);
      const readConcurrency = DEFAULT_REVOKE_EXISTING_GRANTS_BATCH_SIZE;
      grantsToRevoke = await this.findGrantIds(options.userId, (grant$1) => grant$1.clientId === clientId && (!isCimdClient || grant$1.redirectUri === options.request.redirectUri) && this.provider.shouldReplaceGrantForResource(grant$1.resource, effectiveResource), readConcurrency);
    }
    const grantId = generateRandomString(16);
    const { encryptedData, key: encryptionKey } = await encryptProps(options.props);
    const now = Math.floor(Date.now() / 1e3);
    const authCodeSecret = generateRandomString(32);
    const authCode = `${options.userId}:${grantId}:${authCodeSecret}`;
    const authCodeId = await hashSecret(authCode);
    const authCodeWrappedKey = await wrapKeyWithToken(authCode, encryptionKey);
    const grant = {
      id: grantId,
      clientId: options.request.clientId,
      userId: options.userId,
      scope: options.scope,
      metadata: options.metadata,
      encryptedProps: encryptedData,
      createdAt: now,
      authCodeId,
      authCodeWrappedKey,
      codeChallenge: options.request.codeChallenge,
      codeChallengeMethod: options.request.codeChallengeMethod,
      resource: effectiveResource,
      redirectUri: options.request.redirectUri
    };
    const grantKey = `grant:${options.userId}:${grantId}`;
    await this.env.OAUTH_KV.put(grantKey, JSON.stringify(grant), grantPutOptions(grant, { expirationTtl: 600 }));
    const redirectUrl = new URL(options.request.redirectUri);
    redirectUrl.searchParams.set("code", authCode);
    if (options.request.state) redirectUrl.searchParams.set("state", options.request.state);
    if (options.request.issuer) redirectUrl.searchParams.set("iss", options.request.issuer);
    try {
      await Promise.allSettled(grantsToRevoke.map((oldGrantId) => this.revokeGrant(oldGrantId, options.userId)));
    } catch {
    }
    return { redirectTo: redirectUrl.toString() };
  }
  /**
  * IDs of the user's grants that satisfy `matches`, judged from KV key metadata
  * wherever a grant carries it. Only grants written without metadata, by a version
  * before 1.0 or because theirs would not fit, are read, `readConcurrency` at a time.
  *
  * This runs on the interactive authorization path, where the pre-metadata cost of one
  * `get()` per grant broke re-authorization for a user with more grants than a Worker
  * has subrequests. The cost is now one `list()` per thousand grants plus one `get()`
  * per legacy grant, and every refresh rewrites its grant with metadata, so the legacy
  * share shrinks on its own.
  */
  async findGrantIds(userId, matches, readConcurrency) {
    const grantIds = [];
    for await (const grants of this.findGrants(userId, matches, readConcurrency)) grantIds.push(...grants.map((grant) => grant.grantId));
    return grantIds;
  }
  /**
  * Finds grants matching `matches`, for one user or, with `userId` undefined, for every user.
  * Metadata-carrying keys are matched without a read; legacy grants are read,
  * `readConcurrency` at a time. Matches are yielded as they are found (each page's metadata
  * matches, then each batch of reads), so a caller can act on them before the scan goes on.
  */
  async *findGrants(userId, matches, readConcurrency) {
    const prefix = userId === void 0 ? "grant:" : `grant:${userId}:`;
    let cursor;
    do {
      const page2 = await this.env.OAUTH_KV.list({
        prefix,
        limit: MAX_KV_LIST_LIMIT,
        cursor
      });
      const toRead = [];
      const found = [];
      for (const key of page2.keys) {
        const owner = parseGrantKey(key.name);
        if (!owner || userId !== void 0 && owner.userId !== userId) continue;
        if (isGrantKeyMetadata(key.metadata)) {
          if (matches(key.metadata)) found.push(owner);
        } else toRead.push({
          name: key.name,
          ...owner
        });
      }
      if (found.length > 0) yield found;
      for (let start = 0; start < toRead.length; start += readConcurrency) {
        const batch = toRead.slice(start, start + readConcurrency);
        const grants = await Promise.all(batch.map(({ name }) => this.env.OAUTH_KV.get(name, { type: "json" })));
        const read = batch.filter((_, index) => {
          const grant = grants[index];
          return grant !== null && matches(grant);
        });
        if (read.length > 0) yield read.map(({ userId: userId$1, grantId }) => ({
          userId: userId$1,
          grantId
        }));
      }
      cursor = page2.list_complete ? void 0 : page2.cursor;
    } while (cursor);
  }
  /**
  * Creates a new OAuth client
  * @param clientInfo - Partial client information to create the client with
  * @returns A Promise resolving to the created client info
  */
  async createClient(clientInfo) {
    const clientId = generateRandomString(16);
    const authMethodWasExplicit = clientInfo.tokenEndpointAuthMethod !== void 0;
    const tokenEndpointAuthMethod = clientInfo.tokenEndpointAuthMethod || "client_secret_basic";
    const isPublicClient = tokenEndpointAuthMethod === "none";
    const newClient = {
      clientId,
      redirectUris: clientInfo.redirectUris || [],
      clientName: clientInfo.clientName,
      logoUri: clientInfo.logoUri,
      clientUri: clientInfo.clientUri,
      policyUri: clientInfo.policyUri,
      tosUri: clientInfo.tosUri,
      jwksUri: clientInfo.jwksUri,
      i18n: clientInfo.i18n,
      contacts: clientInfo.contacts,
      grantTypes: clientInfo.grantTypes || [
        GrantType.AUTHORIZATION_CODE,
        GrantType.REFRESH_TOKEN,
        ...this.provider.options.allowTokenExchangeGrant ? [GrantType.TOKEN_EXCHANGE] : []
      ],
      responseTypes: clientInfo.responseTypes || ["code"],
      registrationDate: Math.floor(Date.now() / 1e3),
      tokenEndpointAuthMethod,
      ...authMethodWasExplicit ? { authMethodExplicit: true } : {}
    };
    validateRegisteredRedirectUris(newClient.redirectUris, this.provider.serverCapabilities);
    validateClientCapabilities(this.provider.serverCapabilities, {
      grantTypes: newClient.grantTypes,
      responseTypes: newClient.responseTypes,
      tokenEndpointAuthMethod
    });
    let clientSecret;
    if (!isPublicClient) {
      clientSecret = generateRandomString(32);
      newClient.clientSecret = await hashSecret(clientSecret);
    }
    await this.env.OAUTH_KV.put(`client:${clientId}`, JSON.stringify(newClient));
    const clientResponse = toPublicClientInfo(newClient);
    if (!isPublicClient && clientSecret) clientResponse.clientSecret = clientSecret;
    return clientResponse;
  }
  /**
  * Lists all registered OAuth clients with pagination support
  * @param options - Optional pagination parameters (limit and cursor)
  * @returns A Promise resolving to the list result with items and optional cursor
  */
  async listClients(options) {
    const listOptions = { prefix: "client:" };
    if (options?.limit !== void 0) listOptions.limit = options.limit;
    if (options?.cursor !== void 0) listOptions.cursor = options.cursor;
    const response = await this.env.OAUTH_KV.list(listOptions);
    const clients = [];
    const promises = response.keys.map(async (key) => {
      const clientId = key.name.substring(7);
      const client = await this.provider.getClient(this.env, clientId);
      if (client) clients.push(toPublicClientInfo(client));
    });
    await Promise.all(promises);
    return {
      items: clients,
      cursor: response.list_complete ? void 0 : response.cursor
    };
  }
  /**
  * Updates an existing OAuth client
  * @param clientId - The ID of the client to update
  * @param updates - Partial client information with fields to update
  * @returns A Promise resolving to the updated client info, or null if not found
  */
  async updateClient(clientId, updates) {
    if (this.provider.options.clientIdMetadataDocumentEnabled && isClientIdMetadataDocumentUrl(clientId)) throw new TypeError("Client ID Metadata Document clients are updated by changing their document");
    const client = await this.provider.getClient(this.env, clientId);
    if (!client) return null;
    if (updates.redirectUris !== void 0) {
      if (!Array.isArray(updates.redirectUris) || updates.redirectUris.length === 0) throw new Error("redirectUris must not be empty");
      validateRegisteredRedirectUris(updates.redirectUris, this.provider.serverCapabilities);
    }
    const authMethodWasExplicit = updates.tokenEndpointAuthMethod !== void 0;
    const authMethod = updates.tokenEndpointAuthMethod || client.tokenEndpointAuthMethod || "client_secret_basic";
    const isPublicClient = authMethod === "none";
    let secretToStore = client.clientSecret;
    let originalSecret = void 0;
    if (isPublicClient) secretToStore = void 0;
    else if (updates.clientSecret) {
      originalSecret = updates.clientSecret;
      secretToStore = await hashSecret(updates.clientSecret);
    }
    const updatedClient = {
      ...client,
      ...updates,
      clientId: client.clientId,
      tokenEndpointAuthMethod: authMethod,
      authMethodExplicit: authMethodWasExplicit ? true : client.authMethodExplicit
    };
    if (updates.grantTypes !== void 0 || updates.responseTypes !== void 0 || updates.tokenEndpointAuthMethod !== void 0) validateClientCapabilities(this.provider.serverCapabilities, {
      grantTypes: updatedClient.grantTypes ?? [GrantType.AUTHORIZATION_CODE, GrantType.REFRESH_TOKEN],
      responseTypes: updatedClient.responseTypes ?? ["code"],
      tokenEndpointAuthMethod: authMethod
    });
    if (!isPublicClient && secretToStore) updatedClient.clientSecret = secretToStore;
    else delete updatedClient.clientSecret;
    if (client.registrationExpiresAt === void 0) await this.env.OAUTH_KV.put(`client:${updatedClient.clientId}`, JSON.stringify(updatedClient));
    else await this.provider.putRegisteredClient(this.env, updatedClient, Math.floor(Date.now() / 1e3));
    const response = toPublicClientInfo(updatedClient);
    if (!isPublicClient && originalSecret) response.clientSecret = originalSecret;
    return response;
  }
  /**
  * Deletes an OAuth client and revokes all associated grants across all users.
  * @param clientId - The ID of the client to delete
  * @returns A Promise resolving when the deletion is confirmed.
  */
  async deleteClient(clientId) {
    await this.env.OAUTH_KV.delete(`client:${clientId}`);
    const grants = this.findGrants(void 0, (grant) => grant.clientId === clientId, DEFAULT_REVOKE_EXISTING_GRANTS_BATCH_SIZE);
    for await (const found of grants) for (const { userId, grantId } of found) await this.revokeGrant(grantId, userId);
  }
  /**
  * Lists all authorization grants for a specific user with pagination support
  * Returns a summary of each grant without sensitive information
  * @param userId - The ID of the user whose grants to list
  * @param options - Optional pagination parameters (limit and cursor)
  * @returns A Promise resolving to the list result with grant summaries and optional cursor
  */
  async listUserGrants(userId, options) {
    const listOptions = { prefix: `grant:${userId}:` };
    if (options?.limit !== void 0) listOptions.limit = options.limit;
    if (options?.cursor !== void 0) listOptions.cursor = options.cursor;
    const isOwn = /* @__PURE__ */ __name((key) => !key.name.slice(listOptions.prefix.length).includes(":"), "isOwn");
    let response = await this.env.OAUTH_KV.list(listOptions);
    let ownKeys = response.keys.filter(isOwn);
    while (ownKeys.length === 0 && !response.list_complete) {
      response = await this.env.OAUTH_KV.list({
        ...listOptions,
        cursor: response.cursor
      });
      ownKeys = response.keys.filter(isOwn);
    }
    const grantSummaries = [];
    const promises = ownKeys.map(async (key) => {
      const grantData = await this.env.OAUTH_KV.get(key.name, { type: "json" });
      if (grantData) {
        const summary = {
          id: grantData.id,
          clientId: grantData.clientId,
          userId: grantData.userId,
          scope: grantData.scope,
          metadata: grantData.metadata,
          createdAt: grantData.createdAt,
          expiresAt: grantData.expiresAt,
          redirectUri: grantData.redirectUri,
          resource: grantData.resource
        };
        grantSummaries.push(summary);
      }
    });
    await Promise.all(promises);
    return {
      items: grantSummaries,
      cursor: response.list_complete ? void 0 : response.cursor
    };
  }
  /**
  * Revokes an authorization grant and all its associated access tokens
  * @param grantId - The ID of the grant to revoke
  * @param userId - The ID of the user who owns the grant
  * @returns A Promise resolving when the revocation is confirmed.
  */
  /** {@inheritDoc OAuthHelpers.describeConsent} */
  async describeConsent(authRequest) {
    const client = await this.lookupClient(authRequest.clientId);
    const isCimd = !!this.provider.options.clientIdMetadataDocumentEnabled && isClientIdMetadataDocumentUrl(authRequest.clientId);
    return describeConsent(client, authRequest, isCimd);
  }
  /** {@inheritDoc OAuthHelpers.isConsentRemembered} */
  isConsentRemembered(request, authRequest, remember) {
    return isConsentRemembered(this.provider.consentCookies, request, authRequest, remember);
  }
  /** {@inheritDoc OAuthHelpers.beginConsent} */
  beginConsent(authRequest) {
    return beginConsent(this.env.OAUTH_KV, this.provider.consentCookies, authRequest);
  }
  /** {@inheritDoc OAuthHelpers.approveConsent} */
  approveConsent(request, handle, options) {
    return approveConsent(this.env.OAUTH_KV, this.provider.consentCookies, this.provider.options.scopesSupported, request, handle, options);
  }
  /** {@inheritDoc OAuthHelpers.denyConsent} */
  denyConsent(request, handle, options) {
    return denyConsent(this.env.OAUTH_KV, this.provider.consentCookies, request, handle, options);
  }
  /** {@inheritDoc OAuthHelpers.beginUpstream} */
  beginUpstream(authRequest, options) {
    return beginUpstream(this.env.OAUTH_KV, this.provider.consentCookies, authRequest, options);
  }
  /** {@inheritDoc OAuthHelpers.finishUpstream} */
  finishUpstream(request) {
    return finishUpstream(this.env.OAUTH_KV, this.provider.consentCookies, request);
  }
  async revokeGrant(grantId, userId) {
    const grantKey = `grant:${userId}:${grantId}`;
    const tokenPrefix = `token:${userId}:${grantId}:`;
    let cursor;
    let allTokensDeleted = false;
    while (!allTokensDeleted) {
      const listOptions = { prefix: tokenPrefix };
      if (cursor) listOptions.cursor = cursor;
      const result = await this.env.OAUTH_KV.list(listOptions);
      if (result.keys.length > 0) await Promise.all(result.keys.map((key) => {
        return this.env.OAUTH_KV.delete(key.name);
      }));
      if (result.list_complete) allTokensDeleted = true;
      else cursor = result.cursor;
    }
    await this.env.OAUTH_KV.delete(grantKey);
  }
  /**
  * Decodes a token and returns token data with decrypted props
  * @param token - The token
  * @returns Promise resolving to token data with decrypted props, or null if token is invalid
  */
  async unwrapToken(token) {
    return await this.provider.unwrapToken(token, this.env);
  }
  /**
  * Exchanges an existing access token for a new one with modified characteristics
  * Implements OAuth 2.0 Token Exchange (RFC 8693)
  * @param options - Options for token exchange including subject token and optional modifications
  * @returns Promise resolving to token response with new access token
  * @throws CimdFetchError when the grant's client ID is a CIMD URL whose document cannot be resolved
  */
  async exchangeToken(options) {
    const tokenSummary = await this.unwrapToken(options.subjectToken);
    if (!tokenSummary) throw new Error("Invalid or expired subject token");
    const clientInfo = await this.lookupClient(tokenSummary.grant.clientId);
    if (!clientInfo) throw new Error("Client not found");
    return await this.provider.exchangeToken(options.subjectToken, options.scope, options.aud, options.expiresIn, clientInfo, this.env);
  }
  async purgeExpiredData(options) {
    const batchSize = options?.batchSize ?? DEFAULT_PURGE_BATCH_SIZE;
    const purgeOrphanedGrants = options?.purgeOrphanedGrants !== false;
    const purgeExpiredGrants = options?.purgeExpiredGrants !== false;
    const purgeOrphanedTokens = options?.purgeOrphanedTokens !== false;
    const start = parsePurgeCursor(options?.cursor);
    const now = Math.floor(Date.now() / 1e3);
    const result = {
      grantsChecked: 0,
      grantsPurged: 0,
      tokensChecked: 0,
      tokensPurged: 0,
      done: false
    };
    if (start.phase === "grants" && (purgeOrphanedGrants || purgeExpiredGrants)) {
      const knownGoodClients = /* @__PURE__ */ new Set();
      const knownMissingClients = /* @__PURE__ */ new Set();
      let grantCursor = start.kvCursor;
      let grantsDone = false;
      while (!grantsDone && result.grantsChecked < batchSize) {
        const listOptions = {
          prefix: "grant:",
          limit: Math.min(1e3, batchSize - result.grantsChecked)
        };
        if (grantCursor) listOptions.cursor = grantCursor;
        const page2 = await this.env.OAUTH_KV.list(listOptions);
        for (const key of page2.keys) {
          if (result.grantsChecked >= batchSize) break;
          result.grantsChecked++;
          const grantData = await this.env.OAUTH_KV.get(key.name, { type: "json" });
          if (!grantData) continue;
          let shouldPurge = false;
          if (purgeExpiredGrants && grantData.expiresAt !== void 0 && now >= grantData.expiresAt) shouldPurge = true;
          if (!shouldPurge && purgeOrphanedGrants && !isClientIdMetadataDocumentUrl(grantData.clientId)) {
            if (knownMissingClients.has(grantData.clientId)) shouldPurge = true;
            else if (!knownGoodClients.has(grantData.clientId)) if (await this.env.OAUTH_KV.get(`client:${grantData.clientId}`, { type: "json" })) knownGoodClients.add(grantData.clientId);
            else {
              knownMissingClients.add(grantData.clientId);
              shouldPurge = true;
            }
          }
          if (shouldPurge) {
            await this.revokeGrant(grantData.id, grantData.userId);
            result.grantsPurged++;
          }
        }
        if (page2.list_complete) grantsDone = true;
        else grantCursor = page2.cursor;
      }
      if (!grantsDone) return {
        ...result,
        cursor: `grants:${grantCursor ?? ""}`
      };
    }
    if (purgeOrphanedTokens) {
      const knownGoodGrants = /* @__PURE__ */ new Set();
      const knownMissingGrants = /* @__PURE__ */ new Set();
      let tokenCursor = start.phase === "tokens" ? start.kvCursor : void 0;
      let tokensDone = false;
      while (!tokensDone && result.tokensChecked < batchSize) {
        const listOptions = {
          prefix: "token:",
          limit: Math.min(1e3, batchSize - result.tokensChecked)
        };
        if (tokenCursor) listOptions.cursor = tokenCursor;
        const page2 = await this.env.OAUTH_KV.list(listOptions);
        for (const key of page2.keys) {
          if (result.tokensChecked >= batchSize) break;
          result.tokensChecked++;
          const tokenData = await this.env.OAUTH_KV.get(key.name, { type: "json" });
          if (!tokenData) continue;
          const grantKey = `grant:${tokenData.userId}:${tokenData.grantId}`;
          if (knownMissingGrants.has(grantKey)) {
            await this.env.OAUTH_KV.delete(key.name);
            result.tokensPurged++;
          } else if (!knownGoodGrants.has(grantKey)) if (await this.env.OAUTH_KV.get(grantKey)) knownGoodGrants.add(grantKey);
          else {
            knownMissingGrants.add(grantKey);
            await this.env.OAUTH_KV.delete(key.name);
            result.tokensPurged++;
          }
        }
        if (page2.list_complete) tokensDone = true;
        else tokenCursor = page2.cursor;
      }
      if (!tokensDone) return {
        ...result,
        cursor: `tokens:${tokenCursor ?? ""}`
      };
    }
    result.done = true;
    return result;
  }
};

// auth.js
var GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
var GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
var GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
var esc = /* @__PURE__ */ __name((v) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`), "esc");
function page(title, body, status = 200, headers = new Headers()) {
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; img-src https: data:; form-action 'self' https://accounts.google.com; frame-ancestors 'none'");
  headers.set("x-frame-options", "DENY");
  return new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} \xB7 \uB370\uC774\uD130\uD31D\uCF58</title>
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
__name(page, "page");
var googleIcon = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5z"/></svg>`;
function errorPage(message, status = 400) {
  return page("\uBB38\uC81C\uAC00 \uC0DD\uACBC\uC5B4\uC694", `<h1>\uB85C\uADF8\uC778\uC744 \uC774\uC5B4 \uAC08 \uC218 \uC5C6\uC5B4\uC694</h1><p>${esc(message)}</p><p class="small">\uC5F0\uACB0\uD558\uB824\uB358 \uC571\uC5D0\uC11C \uB2E4\uC2DC \uC2DC\uC791\uD574 \uC8FC\uC138\uC694.</p>`, status);
}
__name(errorPage, "errorPage");
function handleAuthError(err2) {
  if (err2 instanceof AuthorizationError && err2.redirectTo) return Response.redirect(err2.redirectTo, 302);
  if (err2 instanceof AuthorizationError) return errorPage(err2.description || "\uC694\uCCAD\uC774 \uC62C\uBC14\uB974\uC9C0 \uC54A\uAC70\uB098 \uC2DC\uAC04\uC774 \uC9C0\uB0AC\uC5B4\uC694.");
  if (err2 instanceof CimdFetchError) return errorPage("\uC5F0\uACB0\uD558\uB824\uB294 \uC571\uC758 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC5B4\uC694.");
  throw err2;
}
__name(handleAuthError, "handleAuthError");
async function s256(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(s256, "s256");
function randomString(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(randomString, "randomString");
function consentBody(d, handle) {
  const scopes = (d.scope || []).map((s) => `<input type="hidden" name="scope" value="${esc(s)}">`).join("");
  const origin = d.clientDomain ? `\uAC8C\uC2DC\uC790: <strong>${esc(d.clientDomain)}</strong>` : `<span class="small">\uC571 \uC774\uB984\uC740 \uC571\uC774 \uC2A4\uC2A4\uB85C \uB4F1\uB85D\uD55C \uAC12\uC774\uB77C \uD655\uC778\uB418\uC9C0 \uC54A\uC558\uC5B4\uC694.</span>`;
  return `<h1><strong>${esc(d.clientName)}</strong> \uC571\uC774<br>\uB370\uC774\uD130\uD31D\uCF58 \uB370\uC774\uD130 MCP\uB97C \uC4F0\uB824\uACE0 \uD574\uC694</h1>
<div class="box">${origin}<br>\uAD8C\uD55C\uC744 \uBC1B\uC744 \uACF3: <strong>${esc(d.redirectHost)}</strong><br>\uAD8C\uD55C: \uB370\uC774\uD130 MCP \uB3C4\uAD6C \uD638\uCD9C (\uC77D\uAE30 \uC804\uC6A9)</div>
${d.redirectIsLoopback ? '<div class="warn">\uC774 \uCEF4\uD4E8\uD130\uC5D0\uC11C \uC2E4\uD589 \uC911\uC778 \uC571\uC73C\uB85C \uAD8C\uD55C\uC774 \uC804\uB2EC\uB3FC\uC694. \uBC29\uAE08 \uC9C1\uC811 \uC5F0\uACB0\uC744 \uC2DC\uC791\uD588\uC744 \uB54C\uB9CC \uACC4\uC18D\uD558\uC138\uC694.</div>' : ""}
<form method="post" action="/authorize">
<input type="hidden" name="handle" value="${esc(handle)}">${scopes}
<button class="btn" name="decision" value="approve">${googleIcon} Google\uB85C \uACC4\uC18D\uD558\uAE30</button>
<button class="ghost" name="decision" value="deny">\uCDE8\uC18C</button>
</form>
<p class="small">\uCC98\uC74C\uC774\uBA74 Google \uB85C\uADF8\uC778\uACFC \uD568\uAED8 \uB370\uC774\uD130\uD31D\uCF58 \uACC4\uC815\uC774 \uB9CC\uB4E4\uC5B4\uC838\uC694. \uC774\uBA54\uC77C\xB7\uC774\uB984\uB9CC \uBC1B\uACE0 \uB2E4\uB978 Google \uB370\uC774\uD130\uC5D0\uB294 \uC811\uADFC\uD558\uC9C0 \uC54A\uC544\uC694. \uACC4\uC18D\uD558\uBA74 <a href="https://datapopcorn.ai/privacy" target="_blank" rel="noopener">\uAC1C\uC778\uC815\uBCF4\uCC98\uB9AC\uBC29\uCE68</a>\uC5D0 \uB3D9\uC758\uD558\uAC8C \uB429\uB2C8\uB2E4.</p>`;
}
__name(consentBody, "consentBody");
async function upsertUser(env, info) {
  const key = `dp-user:${info.sub}`;
  const prev = await env.OAUTH_KV.get(key, "json");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const user = {
    sub: info.sub,
    email: info.email,
    name: info.name || "",
    createdAt: prev?.createdAt || now,
    lastLoginAt: now,
    logins: (prev?.logins || 0) + 1,
    blocked: prev?.blocked || false
  };
  await env.OAUTH_KV.put(key, JSON.stringify(user));
  return user;
}
__name(upsertUser, "upsertUser");
async function handleAuthRoutes(request, env) {
  const url = new URL(request.url);
  const oauth = env.OAUTH_PROVIDER;
  if (url.pathname === "/authorize" && request.method === "GET") {
    try {
      const authRequest = await oauth.parseAuthRequest(request);
      const details = await oauth.describeConsent(authRequest);
      const consent = await oauth.beginConsent(authRequest);
      return page("\uC5F0\uACB0 \uD5C8\uC6A9", consentBody(details, consent.handle), 200, consent.headers);
    } catch (err2) {
      return handleAuthError(err2);
    }
  }
  if (url.pathname === "/authorize" && request.method === "POST") {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return errorPage("\uB85C\uADF8\uC778 \uC124\uC815\uC774 \uC544\uC9C1 \uB05D\uB098\uC9C0 \uC54A\uC558\uC5B4\uC694.", 503);
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
    } catch (err2) {
      return handleAuthError(err2);
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
          code_verifier: data.verifier
        })
      });
      if (!tok.ok) return errorPage("Google \uB85C\uADF8\uC778\uC744 \uD655\uC778\uD558\uC9C0 \uBABB\uD588\uC5B4\uC694.", 502);
      const { access_token } = await tok.json();
      const ui = await fetch(GOOGLE_USERINFO, { headers: { authorization: `Bearer ${access_token}` } });
      if (!ui.ok) return errorPage("Google \uACC4\uC815 \uC815\uBCF4\uB97C \uBC1B\uC9C0 \uBABB\uD588\uC5B4\uC694.", 502);
      const info = await ui.json();
      if (!info.sub || !info.email || info.email_verified !== true) return errorPage("\uC774\uBA54\uC77C \uC778\uC99D\uC774 \uB05D\uB09C Google \uACC4\uC815\uB9CC \uC4F8 \uC218 \uC788\uC5B4\uC694.", 403);
      const user = await upsertUser(env, info);
      if (user.blocked) return errorPage("\uC774 \uACC4\uC815\uC740 \uC0AC\uC6A9\uC774 \uC911\uC9C0\uB410\uC5B4\uC694. contact@datapopcorn.ai\uB85C \uBB38\uC758\uD574 \uC8FC\uC138\uC694.", 403);
      const { redirectTo } = await oauth.completeAuthorization({
        request: original,
        userId: `google_${info.sub}`,
        metadata: { email: info.email },
        scope: original.scope,
        props: { userId: `google_${info.sub}`, email: info.email, name: info.name || "" }
      });
      headers.set("Location", redirectTo);
      return new Response(null, { status: 302, headers });
    } catch (err2) {
      return handleAuthError(err2);
    }
  }
  return null;
}
__name(handleAuthRoutes, "handleAuthRoutes");

// skills-bundle.js
var SKILL_SOURCE = "github.com/team-datapopcorn/datapopcorn-analysis-plugin@main";
var SKILL_FILES = [
  {
    "skill": "data-analysis-pipeline",
    "file": "SKILL.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/data-analysis-pipeline/SKILL.md",
    "text": '---\nname: data-analysis-pipeline\ndescription: \uB370\uC774\uD130 \uBD84\uC11D\uC744 \uCC98\uC74C\uBD80\uD130 \uB05D\uAE4C\uC9C0 \uD55C \uBC14\uD034 \uB3CC\uB824\uC57C \uD560 \uB54C \uC0AC\uC6A9\uD55C\uB2E4. "\uBD84\uC11D\uD574\uC918", "\uC774 \uB370\uC774\uD130\uB85C \uD655\uC778\uD574\uC918", "OO\uAC00 \uB72C \uAC83 \uAC19\uC740\uB370 \uB9DE\uB098", "OO\uAC00 \uC65C \uB5A8\uC5B4\uC9C0\uB098", "\uB9AC\uD3EC\uD2B8\uAE4C\uC9C0 \uB9CC\uB4E4\uC5B4\uC918", "\uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC", "\uB2E4\uC74C \uB2E8\uACC4", "\uC5B4\uB514\uAE4C\uC9C0 \uD588\uC9C0" \uAC19\uC740 \uC694\uCCAD. \uAC1C\uBCC4 \uB2E8\uACC4\uB9CC \uD544\uC694\uD558\uBA74 1-hypothesis / 2-collect / 3-suspect / 4-report\uB97C \uC9C1\uC811 \uC4F4\uB2E4.\n---\n\n# Data Analysis Pipeline \u2014 4\uB2E8\uACC4 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130\n\n**\uC774 \uC2A4\uD0AC\uC740 \uC21C\uC11C\uB9CC \uAD00\uB9AC\uD55C\uB2E4.** \uAC01 \uB2E8\uACC4\uC758 \uBC29\uBC95\uC740 \uB2E8\uACC4 \uC2A4\uD0AC\uC774 \uAC16\uACE0 \uC788\uB2E4. \uC5EC\uAE30\uC5D0 \uD568\uC815 \uBAA9\uB85D\xB7\uC778\uD130\uBDF0 \uC9C8\uBB38\xB7\uB514\uC790\uC778 \uC2A4\uD399\uC744 \uB2E4\uC2DC \uC4F0\uC9C0 \uC54A\uB294\uB2E4.\n\n> \uD55C \uC904: **\uD310\uB2E8\uC740 \uC0AC\uB78C, \uBC18\uBCF5\uC740 \uCF54\uB4DC, \uD568\uC815\uC740 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8.**\n\n---\n\n## 4\uB2E8\uACC4 = \uC2A4\uD0AC 4\uAC1C\n\n```\n\u2460 \uAC00\uC124  \u2192  \u2461 \uC218\uC9D1  \u2192  \u2462 \uC758\uC2EC  \u2192  \u2463 \uC815\uB9AC\n```\n\n| \uB2E8\uACC4 | \uD638\uCD9C\uD560 \uC2A4\uD0AC | \uC0B0\uCD9C\uBB3C (\uC644\uB8CC \uC99D\uBA85) |\n|---|---|---|\n| **\u2460 \uAC00\uC124** | `datapopcorn-analysis:1-hypothesis` | `hypothesis.md` |\n| **\u2461 \uC218\uC9D1** | `datapopcorn-analysis:2-collect` | `data/clean/` + `collection_report.md` + `preprocessing_report.html` |\n| **\u2462 \uC758\uC2EC** | `datapopcorn-analysis:3-suspect` | `eda_report.html` + `traps_check.md` |\n| **\u2463 \uC815\uB9AC** | `datapopcorn-analysis:4-report` | `findings.md` + `report_YYYYMMDD.html` |\n\n\uAC01 \uB2E8\uACC4\uB294 **Skill \uD234\uB85C \uD574\uB2F9 \uC2A4\uD0AC\uC744 \uD638\uCD9C**\uD574\uC11C \uC2E4\uD589\uD55C\uB2E4. \uB2E8\uACC4 \uB0B4\uC6A9\uC744 \uC9C1\uC811 \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294\uB2E4.\n\n### \uC2A4\uD06C\uB9BD\uD2B8 \uB124\uC774\uBC0D (\uB2E8\uACC4 \uC2A4\uD0AC\uC774 \uB9CC\uB4E0\uB2E4)\n\n`1_collect.py` \xB7 `2_preprocess.py` \xB7 `3_eda.py` \xB7 `4_analyze.py` \u2014 \u2460\uAC00\uC124\uC740 \uB300\uD654 \uB2E8\uACC4\uB77C \uC2A4\uD06C\uB9BD\uD2B8\uAC00 \uC5C6\uB2E4.\n\n---\n\n## \uC2DC\uC791\uC810 \u2014 \uB450 \uACBD\uB85C\n\n- **A. \uAC00\uC124 \uC788\uC74C / \uB370\uC774\uD130 \uC5C6\uC74C** \u2192 \u2460\uBD80\uD130 4\uB2E8\uACC4 \uC804\uBD80.\n- **B. \uD30C\uC77C \uC774\uBBF8 \uC788\uC74C** (\uC5D1\uC140\xB7CSV \uCD94\uCD9C\uBCF8, \uB9E4\uCD9C, \uCEA0\uD398\uC778 \uC131\uACFC, CRM \uB4F1) \u2192 `input/`\uC5D0 \uB123\uACE0 \uC2DC\uC791.\n  - **\uAC00\uC124\uC774 \uC788\uC73C\uBA74** \u2461\uBD80\uD130. `hypothesis.md`\uB97C \uBA3C\uC800 \uC4F4\uB2E4.\n  - **\uAC00\uC124\uC774 \uC5C6\uC73C\uBA74** \u2460\uC744 \uAC74\uB108\uB6F0\uC9C0 \uC54A\uB294\uB2E4. `1-hypothesis`\uB85C \uBAA9\uD45C \uC778\uD130\uBDF0\uB97C \uBA3C\uC800 \uB3CC\uB9B0\uB2E4. "\uC774 \uB370\uC774\uD130\uB85C \uBB50 \uBCF4\uC9C0"\uB294 \uAC00\uC124\uC774 \uC544\uB2C8\uB2E4.\n\n\uC5B4\uB290 \uACBD\uB85C\uB4E0 \u2462 \uC758\uC2EC\uACFC \u2463 \uC815\uB9AC\uB294 \uB611\uAC19\uC774 \uD1B5\uACFC\uD55C\uB2E4.\n\n---\n\n## \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uADDC\uCE59\n\n1. \uAC01 \uB2E8\uACC4 \uC2E4\uD589 **\uC804** \uC0B0\uCD9C\uBB3C \uC874\uC7AC\uB97C \uD655\uC778\uD55C\uB2E4. \uC774\uBBF8 \uC788\uACE0 \uC785\uB825\uBCF4\uB2E4 \uC0C8\uAC83\uC774\uBA74 `\u2705 STEP N \u2014 \uC644\uB8CC (skip)` \uCD9C\uB825 \uD6C4 \uAC74\uB108\uB6F4\uB2E4.\n2. \uAC01 \uB2E8\uACC4 \uC2E4\uD589 **\uD6C4** \uC0B0\uCD9C\uBB3C \uC874\uC7AC\uB97C \uD655\uC778\uD55C\uB2E4. \uC5C6\uC73C\uBA74 \uADF8 \uB2E8\uACC4 \uC2E4\uD328\uB85C \uBCF4\uACE0\uD558\uACE0 **\uBA48\uCD98\uB2E4**. \uB2E4\uC74C \uB2E8\uACC4\uB85C \uAC00\uC9C0 \uC54A\uB294\uB2E4.\n3. `hypothesis.md`\uC640 `traps_check.md`\uB3C4 \uC0B0\uCD9C\uBB3C\uC774\uB2E4. **\uCF54\uB4DC\uAC00 \uC5C6\uB294 \uB2E8\uACC4\uB77C\uB294 \uC774\uC720\uB85C \uAC74\uB108\uB6F0\uC9C0 \uC54A\uB294\uB2E4.**\n4. "\uCC98\uC74C\uBD80\uD130 \uB2E4\uC2DC" \u2192 \uC0B0\uCD9C\uBB3C\uC744 \uBE44\uC6B0\uACE0 \u2460\uBD80\uD130 \uC7AC\uC2E4\uD589.\n5. "\uB2E4\uC74C \uB2E8\uACC4" / "\uC5B4\uB514\uAE4C\uC9C0 \uD588\uC9C0" \u2192 \uC0B0\uCD9C\uBB3C \uC874\uC7AC\uB97C \uC2A4\uCE94\uD574 \uD604\uC7AC \uC704\uCE58\uB97C \uBCF4\uACE0\uD558\uACE0 \uADF8 \uB2E4\uC74C \uB2E8\uACC4\uB97C \uC2E4\uD589.\n6. \uC644\uB8CC \uC2DC \uC0B0\uCD9C\uBB3C \uACBD\uB85C\uB97C \uBAA9\uB85D\uC73C\uB85C \uBCF4\uACE0. \uAC74\uB108\uB6F4 \uB2E8\uACC4\uB294 `(cached)` \uD45C\uC2DC.\n\n### \uC9C4\uD589 \uBCF4\uACE0 \uD615\uC2DD\n\n```\n\u2705 STEP 1 \uAC00\uC124  \u2014 hypothesis.md (cached)\n\u2705 STEP 2 \uC218\uC9D1  \u2014 data/clean/orders.csv \xB7 preprocessing_report.html\n\u25B6  STEP 3 \uC758\uC2EC  \u2014 \uC2E4\uD589 \uC911...\n   STEP 4 \uC815\uB9AC  \u2014 \uB300\uAE30\n```\n\n---\n\n## \uC790\uB3D9 vs \uC0AC\uB78C\n\n- **\u2705 \uCF54\uB4DC**: \uC218\uC9D1 \xB7 \uC815\uB9AC \xB7 \uC9D1\uACC4 \xB7 \uCC28\uD2B8 \xB7 \uB9AC\uD3EC\uD2B8 \uC0DD\uC131. \uB2E4\uC74C \uC8FC\uC81C\uB294 **\uD0A4\uC6CC\uB4DC\xB7\uAE30\uAC04\xB7\uCEEC\uB7FC\uB9CC \uBC14\uAFD4** \uC7AC\uC2E4\uD589.\n- **\u274C \uC0AC\uB78C**: \uAC00\uC124 \uC138\uC6B0\uAE30 \xB7 \uD568\uC815 \uD310\uC815 \xB7 "\uC774 \uC2E0\uD638\uAC00 \uC9C4\uC9DC\uB0D0 \uD3B8\uD5A5\uC774\uB0D0" \xB7 \uD5E4\uB4DC\uB77C\uC778 \uACB0\uC815. AI\uAC00 \uADF8\uB7F4\uB4EF\uD558\uAC8C \uB2F5\uD574\uB3C4 **\uC774\uAC78 \uC758\uC2EC\uD558\uB294 \uAC8C \uBD84\uC11D\uAC00**\uB2E4.\n\n---\n\n## \uAC15\uC81C \uADDC\uCE59\n\n1. **\uC21C\uC11C \uACE0\uC815** \u2014 \u2460\u2192\u2461\u2192\u2462\u2192\u2463. \uB2E8\uACC4\uB97C \uC0C8\uB85C \uB9CC\uB4E4\uAC70\uB098 \uC21C\uC11C\uB97C \uBC14\uAFB8\uC9C0 \uC54A\uB294\uB2E4.\n2. **\uB2E8\uACC4\uB294 \uC2A4\uD0AC \uD638\uCD9C\uB85C \uC2E4\uD589** \u2014 \uD568\uC815 \uBAA9\uB85D\xB7\uC778\uD130\uBDF0 \uC9C8\uBB38\xB7\uB514\uC790\uC778\uC744 \uC774 \uC2A4\uD0AC\uC5D0\uC11C \uC9C1\uC811 \uCC98\uB9AC\uD558\uC9C0 \uC54A\uB294\uB2E4.\n3. **\uC0B0\uCD9C\uBB3C \uC5C6\uC73C\uBA74 \uBBF8\uC644\uB8CC** \u2014 \uB2E4\uC74C \uB2E8\uACC4\uB85C \uB118\uC5B4\uAC00\uC9C0 \uC54A\uB294\uB2E4.\n4. **\uAC00\uC124 \uC5C6\uC774 \u2461\uB85C \uAC00\uC9C0 \uC54A\uB294\uB2E4** \u2014 `1-hypothesis`\uB97C \uBA3C\uC800 \uB3CC\uB9B0\uB2E4.\n5. **`.env`\uB85C \uD0A4 \uAD00\uB9AC** \u2014 \uD558\uB4DC\uCF54\uB529 \uAE08\uC9C0, `.gitignore`\uC5D0 \uB4F1\uB85D.\n6. **\uC7AC\uC2E4\uD589 \uAC00\uB2A5\uD558\uAC8C \uB9C8\uBB34\uB9AC** \u2014 \uB2E4\uC74C \uC8FC\uC81C\uC5D0 \uADF8\uB300\uB85C \uAD74\uB7EC\uAC00\uB294 \uCF54\uB4DC\uB85C \uB0A8\uAE34\uB2E4.\n\n---\n\n## \uD754\uD55C \uC2E4\uD328\n\n| \uC99D\uC0C1 | \uC6D0\uC778 | \uACE0\uCE58\uB294 \uBC95 |\n|---|---|---|\n| \uAC00\uC124 \uC5C6\uC774 \uCF54\uB4DC\uBD80\uD130 \uC9EC | \uD30C\uC77C\uC774 \uC788\uC5B4\uC11C \u2460\uC744 \uAC74\uB108\uB700 | `1-hypothesis` \uBA3C\uC800 |\n| \uB2E8\uACC4 \uC2A4\uD0AC\uC744 \uC548 \uBD80\uB974\uACE0 \uC9C1\uC811 \uCC98\uB9AC | \uC774 \uC2A4\uD0AC\uC5D0 \uB0B4\uC6A9\uC774 \uC788\uB2E4\uACE0 \uCC29\uAC01 | \uC5EC\uAE30\uC5D4 \uC21C\uC11C\uB9CC \uC788\uB2E4. Skill \uD234\uB85C \uD638\uCD9C |\n| \uD568\uC815 \uD1B5\uACFC \uAE30\uB85D\uC774 \uC5C6\uC74C | \u2462\uC744 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uD6D1\uAE30\uB85C \uB300\uCCB4 | `3-suspect`\uAC00 `traps_check.md`\uB97C \uB9CC\uB4E0\uB2E4 |\n| \uB9AC\uD3EC\uD2B8 \uD1A4\uC774 \uC548 \uB9DE\uC74C | \u2463\uB97C \uC9C1\uC811 HTML \uC791\uC131 | `4-report` \uD638\uCD9C |\n| \uC911\uAC04\uC5D0 \uB04A\uAE34 \uB4A4 \uC5B4\uB514\uC11C \uC774\uC744\uC9C0 \uBAA8\uB984 | \uC0B0\uCD9C\uBB3C \uC2A4\uCE94 \uC548 \uD568 | \uCCB4\uD06C\uD3EC\uC778\uD2B8 \uADDC\uCE59 5 |\n\n---\n\n## \uBA54\uD0C0\n\n- **\uBC84\uC804**: v4 (2026-08-11) \u2014 4\uB2E8\uACC4\uB97C \uC2A4\uD0AC 4\uAC1C(`1-hypothesis`/`2-collect`/`3-suspect`/`4-report`)\uC640 1:1 \uC815\uB82C. \uC774 \uC2A4\uD0AC\uC740 \uC21C\uC11C\xB7\uC0B0\uCD9C\uBB3C\xB7\uCCB4\uD06C\uD3EC\uC778\uD2B8\uB9CC \uAD00\uB9AC\uD558\uB294 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130\uB85C \uCD95\uC18C\n- **\uB2E8\uACC4 \uC2A4\uD0AC**: `1-hypothesis` \xB7 `2-collect` \xB7 `3-suspect` \xB7 `4-report`\n- **\uC720\uC9C0\uBCF4\uC218**: \uB2E8\uACC4\uC758 *\uBC29\uBC95*\uC774 \uBC14\uB00C\uBA74 \uB2E8\uACC4 \uC2A4\uD0AC\uC744, *\uC21C\uC11C\xB7\uC0B0\uCD9C\uBB3C \uADDC\uC57D*\uC774 \uBC14\uB00C\uBA74 \uC774 \uC2A4\uD0AC\uC744 \uACE0\uCE5C\uB2E4\n'
  },
  {
    "skill": "1-hypothesis",
    "file": "SKILL.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/1-hypothesis/SKILL.md",
    "text": '---\nname: 1-hypothesis\ndescription: \uBD84\uC11D 4\uB2E8\uACC4\uC758 \u2460 \uAC00\uC124. \uBB34\uC5C7\uC744 \uBD84\uC11D\uD560\uC9C0 \uC548 \uC815\uD574\uC84C\uC744 \uB54C \uC0AC\uC6A9\uD55C\uB2E4. "\uC774\uAC70 \uBD84\uC11D \uC5B4\uB5BB\uAC8C \uC2DC\uC791", "\uB0B4 \uC5C5\uBB34 \uBD84\uC11D\uD574\uC918", "OO\uB97C \uC62C\uB9AC\uACE0 \uC2F6\uC740\uB370", "OO\uAC00 \uC65C \uB5A8\uC5B4\uC9C0\uB098", "\uBAA9\uD45C\uBD80\uD130 \uC7A1\uC544\uC918", "\uBB58 \uBD10\uC57C \uD560\uC9C0 \uBAA8\uB974\uACA0\uC5B4", "\uC774 \uC5D1\uC140\uB85C \uBB58 \uC54C \uC218 \uC788\uC5B4", "\uAC00\uC124 \uC138\uC6CC\uC918", "\uC9C0\uD45C \uBB58 \uBD10\uC57C \uD574" \uAC19\uC740 \uC694\uCCAD. \uD310\uB2E4\uC2A4\xB7SQL \uBAA8\uB974\uB294 \uC0AC\uC6A9\uC790, \uC601\uC5C5\xB7\uC6B4\uC601\xB7\uB9C8\uCF00\uD305\xB7\uC778\uC0AC \uB4F1 \uC9C1\uAD70 \uBB34\uAD00.\n---\n\n# \u2460 \uAC00\uC124 \u2014 \uBAA9\uD45C\uBD80\uD130 \uBB3B\uB294\uB2E4\n\n\uBD84\uC11D 4\uB2E8\uACC4\uC758 \uCCAB \uB2E8\uACC4. \uB370\uC774\uD130\uAC00 \uC544\uB2C8\uB77C **\uBAA9\uD45C\uC5D0\uC11C \uCD9C\uBC1C**\uD55C\uB2E4. \uC0AC\uC6A9\uC790\uB294 \uB358\uC9C0\uB294 \uC9C8\uBB38\uC5D0 \uB2F5\uB9CC \uD558\uBA74 \uB41C\uB2E4. \uD310\uB2E4\uC2A4 \uBB38\uBC95\uC744 \uBAB0\uB77C\uB3C4 \uB41C\uB2E4.\n\n> \uD55C \uC904: **"\uBB34\uC5C7\uC744 \uC774\uB8E8\uACE0 \uC2F6\uC740\uAC00"\uC5D0\uC11C \uC2DC\uC791\uD574, "\uADF8\uB798\uC11C \uBB34\uC5C7\uC744 \uBC14\uAFBC\uB2E4"\uB85C \uB05D\uB0B8\uB2E4.**\n\n**\uC0B0\uCD9C\uBB3C**: `hypothesis.md` \u2014 \uC774 \uD30C\uC77C\uC774 \uC5C6\uC73C\uBA74 \u2460 \uB2E8\uACC4\uB294 \uC644\uB8CC\uAC00 \uC544\uB2C8\uB2E4.\n**\uB2E4\uC74C \uB2E8\uACC4**: `datapopcorn-analysis:2-collect` (\uC218\uC9D1\xB7\uC815\uB9AC)\n\n---\n\n## \uBAA9\uD45C \uC778\uD130\uBDF0 (\uB2F5\uB9CC \uD558\uBA74 \uB428)\n\n**\uD55C \uBC88\uC5D0 \uD558\uB098\uC529\uB9CC \uBB3B\uB294\uB2E4.** \uB2E4\uC12F \uC9C8\uBB38\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB358\uC9C0\uC9C0 \uB9D0 \uAC83. \uB2F5\uC774 \uBAA8\uD638\uD558\uBA74 \uD55C \uBC88 \uB354 \uC881\uD600\uC11C \uB2E4\uC2DC \uBB3B\uB294\uB2E4.\n\n### Q1. \uBB34\uC2A8 \uC77C\uC778\uAC00 \u2014 \uD55C \uC904\n"\uC774 \uBD84\uC11D\uC73C\uB85C \uB2E4\uB8E8\uB824\uB294 \uC5C5\uBB34\uB97C \uD55C \uC904\uB85C\uC694. (\uC608: \'B2B \uAD50\uC721 \uBB38\uC758\uB97C \uACC4\uC57D\uAE4C\uC9C0 \uC5F0\uACB0\uD558\uB294 \uC601\uC5C5\')"\n\n### Q2. \uC9C0\uAE08 \uC22B\uC790 \u2014 \uD604\uD669(AS-IS)\n"\uADF8 \uC5C5\uBB34\uC758 \uC9C0\uAE08 \uC8FC\uC694 \uC22B\uC790\uAC00 \uC5B4\uB5BB\uAC8C \uB3FC\uC694? \uCD94\uCE21 \uB9D0\uACE0 **\uC2E4\uC81C \uC22B\uC790**\uB85C \uD55C \uC904."\n- \uB9C9\uD788\uBA74 \uD55C \uAC00\uC9C0\uB9CC \uCF55: "\uC9C0\uB09C\uB2EC \uBB38\uC758 \uBA87 \uAC74? \uADF8\uC911 \uACC4\uC57D \uBA87 \uAC74?"\n- \uC22B\uC790\uAC00 \uC544\uC608 \uC5C6\uC73C\uBA74 \u2192 "\uADF8\uB7FC **\uD604\uD669 \uD30C\uC545\uC774 0\uBC88 \uBBF8\uC158**\uC774\uC5D0\uC694" (\uD604\uD669 \uC9D1\uACC4\uB3C4 \uBD84\uC11D \uC77C\uAC10)\n\n### Q3. \uBAA9\uD45C \uC22B\uC790 \u2014 \uB418\uACE0 \uC2F6\uC740 \uC0C1\uD0DC(TO-BE)\n"\uC5B4\uB5A4 \uC22B\uC790\uAC00 \uC5B4\uB5BB\uAC8C \uBC14\uB00C\uBA74 \'OK \uB410\uB2E4\' \uC2F6\uC73C\uC138\uC694?"\n- "X\uB97C Y\uB85C" \uD615\uD0DC\uB85C. \uB9C9\uC5F0\uD558\uBA74 "\uAE30\uAC04\uC740? \uC5BC\uB9C8\uB098?" (\uC608: 3\uAC1C\uC6D4 \uB0B4 \uC804\uD658\uC728 12% \u2192 20%)\n\n### Q4. \uAC00\uC124 \u2014 \uBB34\uC5C7\uC744 \uD558\uBA74 \uBB34\uC5C7\uC774 \uBC14\uB014\uAE4C\n"\uC65C \uC9C0\uAE08 \uADF8 \uC22B\uC790\uB77C\uACE0 \uBCF4\uC138\uC694? \uBB34\uC5C7\uC744 \uBC14\uAFB8\uBA74 \uBAA9\uD45C\uC5D0 \uAC00\uAE4C\uC6CC\uC9C8\uAE4C\uC694?"\n- **\uCE21\uC815 \uAC00\uB2A5\uD55C \uD615\uD0DC**\uB85C: "\uACAC\uC801 \uD6C4 3\uC77C \uB0B4 \uD6C4\uC18D \uC5F0\uB77D\uC744 \uD558\uBA74, \uACC4\uC57D \uC804\uD658\uC728\uC774 \uC624\uB97C \uAC83"\n- \u274C \uB098\uC05C \uAC00\uC124: "\uADF8\uB0E5 \uC601\uC5C5\uC774 \uC57D\uD574\uC11C" \xB7 "\uC5B4\uCA50\uC9C0 \uC548 \uB41C\uB2E4" \xB7 "OO\uAC00 \uB354 \uC88B\uB2E4"\n- \u2705 \uC88B\uC740 \uAC00\uC124: \uBC14\uAFC0 \uAC83(X) \u2192 \uBC14\uB014 \uACB0\uACFC(Y) \u2192 \uAE30\uB300 \uBC29\uD5A5/\uD06C\uAE30(Z)\n\n### Q5. \uBCFC \uC9C0\uD45C \u2014 \uD575\uC2EC \uD558\uB098 + \uBC29\uC5B4 \uD558\uB098\n- **\uD575\uC2EC \uC9C0\uD45C**: \uAC00\uC124\uC758 \uC131\uD328\uB97C \uD310\uB2E8\uD560 \uB2E8 \uD558\uB098. (\uC608: \uACC4\uC57D \uC804\uD658\uC728)\n- **\uBC29\uC5B4 \uC9C0\uD45C**: \uD575\uC2EC\uC774 \uC62C\uB77C\uB3C4 \uC774\uAC8C \uAE68\uC9C0\uBA74 \uC548 \uB418\uB294 \uAC83. (\uC608: \uD3C9\uADE0 \uC751\uB300 \uC2DC\uAC04, \uACE0\uAC1D \uBD88\uB9CC)\n- \uD575\uC2EC\uB9CC \uBCF4\uBA74 \uD568\uC815\uC774\uB2E4. **"\uC62C\uB9AC\uB824\uB294 \uAC83 + \uAE68\uC9C0\uBA74 \uC548 \uB418\uB294 \uAC83" \uD55C \uC30D**\uC73C\uB85C \uBCF8\uB2E4.\n\n### Q6. \uD310\uC815 \uAE30\uC900 \u2014 \uBBF8\uB9AC \uC815\uD55C\uB2E4\n"\uBA87 %(\uB610\uB294 \uBA87 \uAC74) \uC774\uC0C1\uC774\uBA74 \uAC00\uC124\uC774 \uB9DE\uB2E4\uACE0 \uBCFC\uAE4C\uC694?"\n- **\uB370\uC774\uD130\uB97C \uBCF8 \uB4A4\uC5D0 \uAE30\uC900\uC744 \uC815\uD558\uBA74 \uACB0\uB860\uC774 \uB370\uC774\uD130\uC5D0 \uB9DE\uCDB0\uC9C4\uB2E4.** \uC9C0\uAE08 \uC801\uB294\uB2E4.\n\n---\n\n## hypothesis.md \uD615\uC2DD\n\n```markdown\n# \uAC00\uC124\n\n- **\uC5C5\uBB34**: B2B \uAD50\uC721 \uBB38\uC758\uB97C \uACC4\uC57D\uAE4C\uC9C0 \uC5F0\uACB0\uD558\uB294 \uC601\uC5C5\n- **\uD604\uD669(AS-IS)**: \uC9C0\uB09C\uB2EC \uBB38\uC758 84\uAC74 \u2192 \uACC4\uC57D 10\uAC74 (11.9%)\n- **\uBAA9\uD45C(TO-BE)**: 3\uAC1C\uC6D4 \uB0B4 \uC804\uD658\uC728 20%\n- **\uAC00\uC124**: \uACAC\uC801 \uD6C4 3\uC77C \uB0B4 \uD6C4\uC18D \uC5F0\uB77D\uC744 \uD558\uBA74 \uACC4\uC57D \uC804\uD658\uC728\uC774 \uC624\uB978\uB2E4\n- **\uD575\uC2EC \uC9C0\uD45C**: \uACC4\uC57D \uC804\uD658\uC728\n- **\uBC29\uC5B4 \uC9C0\uD45C**: \uD3C9\uADE0 \uC751\uB300\uC77C (\uB298\uC5B4\uB098\uBA74 \uC2E4\uD328)\n- **\uD310\uC815 \uAE30\uC900**: 3\uC77C \uB0B4 \uC5F0\uB77D \uADF8\uB8F9\uC758 \uC804\uD658\uC728\uC774 \uADF8 \uC678 \uADF8\uB8F9\uBCF4\uB2E4 5%p \uC774\uC0C1 \uB192\uC73C\uBA74 \uCC38\n\n## \uC65C \uC774\uB807\uAC8C \uBD24\uB098\n- \uD604\uD669: CRM \uBB38\uC758 \uAD00\uB9AC\uD45C \uAE30\uC900. \uCDE8\uC18C \uAC74 \uC81C\uC678\n- \uAC00\uC124 \uADFC\uAC70: \uC751\uB300\uAC00 \uB2A6\uC740 \uAC74\uC774 \uC720\uC2E4\uB41C\uB2E4\uB294 \uD604\uC7A5 \uCCB4\uAC10\n- \uBC29\uC5B4 \uC9C0\uD45C \uC774\uC720: \uD6C4\uC18D \uC5F0\uB77D\uC744 \uB298\uB9AC\uBA74 \uC2E0\uADDC \uC751\uB300\uAC00 \uBC00\uB9B4 \uC218 \uC788\uC74C\n```\n\n\uAC01 \uB2F5\uC758 *\uC65C*\uB97C \uD55C \uC904\uC529 \uB0A8\uAE34\uB2E4. \uC774\uAC8C \uADF8\uB300\uB85C **"\uC774\uB807\uAC8C \uBD84\uC11D\uD560 \uAC70\uACE0 \uC774\uC720\uB294 X"\uB77C\uB294 \uBCF4\uACE0**\uAC00 \uB41C\uB2E4.\n\n---\n\n## \uC9C1\uAD70\uBCC4 \uC608\uC2DC \u2014 \uAC19\uC740 \uC9C8\uBB38, \uB2E4\uB978 \uC785\uB825\n\n| \uC9C1\uAD70 | \uBAA9\uD45C(TO-BE) | \uD575\uC2EC / \uBC29\uC5B4 \uC9C0\uD45C | \uB370\uC774\uD130 |\n|---|---|---|---|\n| \uC601\uC5C5 | \uACAC\uC801 \u2192 \uACC4\uC57D \uC804\uD658\uC728 \u2191 | \uACC4\uC57D \uC804\uD658\uC728 / \uD3C9\uADE0 \uC751\uB300\uC77C | \uBB38\uC758 \uAD00\uB9AC\uD45C |\n| \uC6B4\uC601\xB7CS | \uBB38\uC758 \uCC98\uB9AC\uC2DC\uAC04 \u2193 | \uD3C9\uADE0 \uCC98\uB9AC\uC2DC\uAC04 / \uC7AC\uBB38\uC758\uC728 | \uBB38\uC758 \uB85C\uADF8 |\n| \uB9C8\uCF00\uD305 | \uCC44\uB110 \uD6A8\uC728 \u2191 | \uC804\uD658\uB2F9 \uBE44\uC6A9 / \uC774\uD0C8\uB960 | \uCEA0\uD398\uC778 \uC131\uACFC |\n| \uB9E4\uC7A5\xB7\uCEE4\uBA38\uC2A4 | \uC7AC\uAD6C\uB9E4\uC728 \u2191 | \uC7AC\uAD6C\uB9E4\uC728 / \uAC1D\uB2E8\uAC00 | \uC8FC\uBB38 \uB0B4\uC5ED |\n| \uC778\uC0AC | \uC2E0\uC785 \uC870\uAE30\uC774\uD0C8 \u2193 | 6\uAC1C\uC6D4 \uC794\uC874\uC728 / \uCC44\uC6A9 \uB9AC\uB4DC\uD0C0\uC784 | \uC785\uD1F4\uC0AC \uAE30\uB85D |\n\n---\n\n## \uB0B4 \uC5C5\uBB34\uB85C \uB9CC\uB4E4\uAE30 (\u2605 \uC7AC\uC0AC\uC6A9\uC758 \uD575\uC2EC)\n\n\uC774 \uC2A4\uD0AC\uC740 \uBC94\uC6A9\uC774\uB77C, **\uB124 \uCE78\uB9CC \uC790\uAE30 \uC5C5\uBB34 \uC6A9\uC5B4\uB85C \uAC08\uC544\uB07C\uC6B0\uBA74** \uB0B4 \uC9C1\uAD70 \uC804\uC6A9 \uBD84\uC11D\uAE30\uAC00 \uB41C\uB2E4. \uD310\uB2E4\uC2A4\uAC00 \uC544\uB2C8\uB77C **\uC2A4\uD0AC\uC758 \uD56D\uBAA9\uC744 \uBC14\uAFB8\uB294 \uC77C**\uC774\uB2E4.\n\n| \uAC08\uC544\uB07C\uC6B8 \uCE78 | \uBB34\uC5C7\uC744 \uBC14\uAFB8\uB098 | \uC5B4\uB514 |\n|---|---|---|\n| **\uBAA9\uD45C \uD15C\uD50C\uB9BF** | "\uBB34\uC2A8 \uC77C / \uC9C0\uAE08 \uC22B\uC790 / \uBAA9\uD45C \uC22B\uC790" \uC608\uC2DC\uB97C \uB0B4 \uC5C5\uBB34\uB85C | Q1~Q3 |\n| **\uC9C8\uBB38 \uBD84\uD574** | \uADF8 \uBAA9\uD45C\uB97C \uCABC\uAC1C\uB294 \uB2E8\uACE8 \uC9C8\uBB38\uB4E4 | Q4 |\n| **\uB370\uC774\uD130 \uB9E4\uD551** | \uB0B4 \uB370\uC774\uD130\uC758 \uC5B4\uB290 \uCEEC\uB7FC\uC774 \uD575\uC2EC\xB7\uBC29\uC5B4 \uC9C0\uD45C\uC778\uC9C0 | Q5 |\n| **\uD310\uC815 \uAE30\uC900** | \uB0B4 \uC5C5\uBB34\uC5D0\uC11C "\uB410\uB2E4"\uC758 \uAE30\uC900\uC120 | Q6 |\n\n\uBC18\uBCF5 \uC5C5\uBB34\uB77C\uBA74 \uB2F5\uD55C \uB0B4\uC6A9\uC744 `hypothesis.md`\uC5D0 \uBC15\uC544\uB450\uACE0 \uB2E4\uC74C\uC5D4 \uB370\uC774\uD130\uB9CC \uBC14\uAFD4 \uC7AC\uC2E4\uD589.\n\n---\n\n## \uAC15\uC81C \uADDC\uCE59\n\n1. **\uD55C \uBC88\uC5D0 \uD55C \uC9C8\uBB38\uB9CC** \u2014 Q1~Q6\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB358\uC9C0\uC9C0 \uB9D0 \uAC83. \uB2F5\uC744 \uBCF4\uACE0 \uB2E4\uC74C\uC744 \uC870\uC815.\n2. **\uBAA9\uD45C\uBD80\uD130, \uB370\uC774\uD130\uB294 \uADF8\uB2E4\uC74C** \u2014 "\uC774 \uB370\uC774\uD130\uB85C \uBB50 \uBCF4\uC9C0?"\uB85C \uC2DC\uC791\uD574\uB3C4 Q1~Q3\uC73C\uB85C \uBAA9\uD45C\uB97C \uBA3C\uC800 \uC138\uC6B4\uB2E4.\n3. **\uBC29\uC5B4 \uC9C0\uD45C \uBC18\uB4DC\uC2DC** \u2014 \uD575\uC2EC \uC9C0\uD45C\uB9CC \uBC1B\uC73C\uBA74 \uC790\uAE30\uAE30\uB9CC. Q5\uB294 \uD55C \uC30D\uC73C\uB85C.\n4. **\uAC80\uC99D \uAC00\uB2A5\uD55C \uAC00\uC124\uB85C** \u2014 "\uADF8\uB0E5 \uC57D\uD574\uC11C" \uAC19\uC740 \uCD94\uC0C1 \uAC00\uC124\uC740 "\uBC14\uAFC0 X \u2192 \uBC14\uB014 Y"\uB85C \uC7AC\uC791\uC131 \uC694\uCCAD.\n5. **\uD310\uC815 \uAE30\uC900\uC744 \uB370\uC774\uD130 \uBCF4\uAE30 \uC804\uC5D0** \u2014 Q6\uC744 \uAC74\uB108\uB6F0\uBA74 \uACB0\uB860\uC774 \uB370\uC774\uD130\uC5D0 \uB9DE\uCDB0\uC9C4\uB2E4.\n6. **\uC22B\uC790 \uC5C6\uC73C\uBA74 \uC815\uC9C1\uD558\uAC8C** \u2014 \uD604\uD669 \uC22B\uC790\uAC00 \uC5C6\uC73C\uBA74 "\uD604\uD669 \uD30C\uC545\uC774 0\uBC88 \uBBF8\uC158"\uC774\uB77C \uBA85\uC2DC.\n7. **`hypothesis.md` \uC5C6\uC774 \uB2E4\uC74C \uB2E8\uACC4\uB85C \uB118\uAE30\uC9C0 \uC54A\uB294\uB2E4.**\n\n---\n\n## \uD754\uD55C \uC2E4\uD328\n\n| \uC99D\uC0C1 | \uC6D0\uC778 | \uACE0\uCE58\uB294 \uBC95 |\n|---|---|---|\n| \uC778\uD130\uBDF0\uAC00 \uCDE8\uC870\uAC00 \uB428 | Q1~Q6\uC744 \uD55C\uAEBC\uBC88\uC5D0 \uB358\uC9D0 | \uD55C \uC9C8\uBB38\uC529. \uB2F5 \uBCF4\uACE0 \uB2E4\uC74C \uC870\uC815 |\n| \uAC00\uC124\uC774 \uAC80\uC99D \uBD88\uAC00 | "OO\uAC00 \uB354 \uC88B\uB2E4" \uD615\uD0DC | "X\uB97C \uBC14\uAFB8\uBA74 Y\uAC00 Z\uB9CC\uD07C" \uC73C\uB85C \uC7AC\uC791\uC131 |\n| \uD575\uC2EC \uC9C0\uD45C\uB9CC \uBCF4\uACE0 \uC131\uACF5 \uC120\uC5B8 | \uBC29\uC5B4 \uC9C0\uD45C \uC0DD\uB7B5 | Q5\uB97C \uD55C \uC30D\uC73C\uB85C \uB2E4\uC2DC |\n| \uACB0\uB860\uC774 \uB370\uC774\uD130\uC5D0 \uB9DE\uCDB0\uC9D0 | \uD310\uC815 \uAE30\uC900\uC744 \uB098\uC911\uC5D0 \uC815\uD568 | Q6\uC744 \uBA3C\uC800 |\n\n## \uC5F0\uAD00 \uC2A4\uD0AC\n\n- \uB2E4\uC74C \uB2E8\uACC4: `2-collect` (\uC218\uC9D1\xB7\uC815\uB9AC)\n- \uC804\uCCB4\uB97C \uC21C\uC11C\uB300\uB85C \uAD74\uB9AC\uB824\uBA74: `data-analysis-pipeline`\n'
  },
  {
    "skill": "2-collect",
    "file": "SKILL.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/2-collect/SKILL.md",
    "text": '---\nname: 2-collect\ndescription: \uBD84\uC11D 4\uB2E8\uACC4\uC758 \u2461 \uC218\uC9D1. \uB370\uC774\uD130\uB97C \uD655\uBCF4\uD558\uACE0 \uBD84\uC11D \uAC00\uB2A5\uD55C \uC0C1\uD0DC\uB85C \uB2E4\uB4EC\uC744 \uB54C \uC0AC\uC6A9\uD55C\uB2E4. "\uC804\uCC98\uB9AC\uD574\uC918", "CSV \uB2E4\uB4EC\uC5B4\uC918", "\uB370\uC774\uD130 \uC815\uB9AC\uD574\uC918", "\uB370\uC774\uD130 \uC5B4\uB514\uC11C \uAD6C\uD574", "\uACF5\uACF5\uB370\uC774\uD130 \uBC1B\uC544\uC918", "\uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9", "\uC5D1\uC140 \uB0B4\uBCF4\uB0C8\uB294\uB370", \uD55C\uAE00\uC774 \uAE68\uC838 \uBCF4\uC784, \uB0A0\uC9DC\xB7\uC22B\uC790\uAC00 \uBB38\uC790\uB85C \uB4E4\uC5B4\uC628 \uCEEC\uB7FC, \uACB0\uCE21\xB7\uC911\uBCF5 \uD655\uC778\uC774 \uD544\uC694\uD55C \uC0C1\uD669.\n---\n\n# \u2461 \uC218\uC9D1 \u2014 \uD655\uBCF4 + \uC815\uB9AC\n\n\uBD84\uC11D 4\uB2E8\uACC4\uC758 \uB450 \uBC88\uC9F8. **\uD655\uBCF4**(\uC5B4\uB514\uC11C \uAC00\uC838\uC624\uB098)\uC640 **\uC815\uB9AC**(\uBD84\uC11D \uAC00\uB2A5\uD558\uAC8C \uB2E4\uB4EC\uAE30)\uB97C \uD55C \uB2E8\uACC4\uB85C \uBB36\uB294\uB2E4. \uC804\uCC98\uB9AC\uB294 \uACB0\uACFC\uB97C \uBC14\uAFB8\uBBC0\uB85C, \uBC14\uAFBC \uB0B4\uC5ED\uC774 \uB0A8\uC9C0 \uC54A\uC73C\uBA74 \uBD84\uC11D\uC744 \uC7AC\uD604\uD560 \uC218 \uC5C6\uB2E4.\n\n**\uC0B0\uCD9C\uBB3C**: `data/clean/` + `collection_report.md` + `preprocessing_report.html`\n**\uC55E \uB2E8\uACC4**: `datapopcorn-analysis:1-hypothesis` (\uAC00\uC124) \u2014 `hypothesis.md`\uAC00 \uC5C6\uC73C\uBA74 \uBA3C\uC800 \uADF8\uCABD\uC73C\uB85C\n**\uB2E4\uC74C \uB2E8\uACC4**: `datapopcorn-analysis:3-suspect` (EDA\xB7\uD568\uC815)\n\n---\n\n## \uACBD\uB85C / \uC2A4\uD06C\uB9BD\uD2B8 (\uACE0\uC815)\n\n| \uBB34\uC5C7 | \uACBD\uB85C |\n|---|---|\n| \uC785\uB825 | `input/` (\uC0AC\uC6A9\uC790\uAC00 \uB123\uC740 \uD30C\uC77C) \uB610\uB294 `data/raw/` (\uC218\uC9D1 \uC2A4\uD06C\uB9BD\uD2B8 \uC0B0\uCD9C\uBB3C) |\n| \uCD9C\uB825 | `data/clean/` |\n| \uBCF4\uACE0\uC11C | `collection_report.md`(\uD655\uBCF4) \xB7 `preprocessing_report.html`(\uC815\uB9AC) |\n| \uC2A4\uD06C\uB9BD\uD2B8 | `1_collect.py`(\uD655\uBCF4) \xB7 `2_preprocess.py`(\uC815\uB9AC) |\n\n`input/`\uACFC `data/raw/` \uB458 \uB2E4 \uC788\uC73C\uBA74 \uB458 \uB2E4 \uC77D\uACE0 \uCD9C\uB825 \uD30C\uC77C\uBA85\uC73C\uB85C \uAD6C\uBD84\uD55C\uB2E4. \uD615\uC2DD(CSV\xB7Excel\xB7JSON) \uBB34\uAD00.\n\n---\n\n## \uD655\uBCF4 \u2014 \uB370\uC774\uD130\uB294 \uBCF4\uD1B5 \uC5B4\uB518\uAC00\uC5D0 \uC788\uB2E4\n\n\uC5C6\uB2E4\uACE0 \uB290\uB07C\uB294 \uAC74 \uB300\uAC1C \uBD84\uC11D\uC744 \uC548 \uD574\uBD10\uC11C\uB2E4. \uC138 \uD328\uD134 \uC911 \uD558\uB098:\n\n| \uC0C1\uD0DC | \uC5B4\uB514\uC5D0 | \uD560 \uC77C |\n|---|---|---|\n| \uD50C\uB7AB\uD3FC\uC5D0 \uAC07\uD798 | \uC2A4\uB9C8\uD2B8\uC2A4\uD1A0\uC5B4\xB7GA\xB7\uC778\uC2A4\uD0C0\xB7\uC778\uD504\uB7F0\xB7CRM | **\uB0B4\uBCF4\uB0B4\uAE30(CSV)** \u2192 `input/` |\n| \uD769\uC5B4\uC838 \uC788\uC74C | \uBA54\uC77C\xB7\uCE74\uD1A1\xB7\uBA54\uBAA8 | "\uD45C\uB85C \uB9CC\uB4E4\uC5B4\uC918" \u2192 \uBE44\uC815\uD615\uC5D0\uC11C \uD56D\uBAA9 \uCD94\uCD9C \u2192 CSV |\n| \uC5D1\uC140\uC5D0 \uC9C0\uC800\uBD84 | \uAD6C\uAE00\uC2DC\uD2B8\xB7\uC5D1\uC140 | \uADF8\uB300\uB85C `input/` \u2192 \uC815\uB9AC\uC5D0\uC11C \uCC98\uB9AC |\n| \uC544\uC9C1 \uC5C6\uC74C | \uC678\uBD80 \uC18C\uC2A4 | `references/data-sources-korea.md` \uCC38\uACE0\uD574 `1_collect.py` |\n\n### \uD55C \uC18C\uC2A4\uB85C\uB294 \uBD80\uC871\uD558\uB2E4\n\n\uAC00\uB2A5\uD558\uBA74 \uC138 \uC885\uB958 \uC2E0\uD638\uB97C \uC5EE\uB294\uB2E4: **\uAD00\uC2EC**(\uAC80\uC0C9\xB7\uC870\uD68C\xB7\uBB38\uC758) + **\uC2E4\uC81C**(\uAD6C\uB9E4\xB7\uBC29\uBB38\xB7\uACC4\uC57D) + **\uB3D9\uC778**(\uCEA0\uD398\uC778\xB7\uC815\uCC45\xB7\uC774\uBCA4\uD2B8\xB7\uB0A0\uC528).\n\uAD00\uC2EC\uB9CC\uC73C\uB85C \uACB0\uB860 \uB0B4\uBA74 \u2462\uC758\uC2EC \uB2E8\uACC4\uC5D0\uC11C \uC9C0\uD45C \uB300\uB9AC \uC624\uB958\uC5D0 \uAC78\uB9B0\uB2E4.\n\n### \uC678\uBD80 \uC218\uC9D1\uC77C \uB54C\uB9CC\n\uC18C\uC2A4 \uCE74\uD0C8\uB85C\uADF8\xB7API \uC2A4\uD06C\uB9BD\uD2B8 \uD328\uD134 \u2192 **`references/data-sources-korea.md`**\n- \uD0A4\uB294 `.env` \u2192 `os.environ`. **\uCF54\uB4DC \uD558\uB4DC\uCF54\uB529 \uAE08\uC9C0**, `.env`\uB294 `.gitignore`\uC5D0\n- \uBBFC\uAC10\uC815\uBCF4(\uC2E4\uBA85\xB7\uC5F0\uB77D\uCC98)\uB294 \uBE7C\uACE0 \uB123\uB294\uB2E4. \uC5F0\uC2B5\uC774\uBA74 \uAC00\uC0C1 \uB370\uC774\uD130\uB85C \uD750\uB984\uBD80\uD130\n\n### collection_report.md \u2014 \uBC1B\uB294 \uC989\uC2DC \uAE30\uB85D\n\n```markdown\n# \uC218\uC9D1 \uAE30\uB85D\n- \uC18C\uC2A4: CRM \uBB38\uC758 \uAD00\uB9AC\uD45C (\uC218\uB3D9 \uB0B4\uBCF4\uB0B4\uAE30)\n- \uC870\uD68C\uC77C: 2026-08-11\n- \uAE30\uAC04: 2025-01 ~ 2026-07\n- \uD589\uC218: 1,284 / \uCEEC\uB7FC: 12\n- \uACB0\uCE21: \uACAC\uC801\uC77C 8.2%, \uB2F4\uB2F9\uC790 0%\n- \uC54C\uB824\uC9C4 \uD55C\uACC4: \uCDE8\uC18C \uAC74\uC774 \uC0AD\uC81C\uB3FC \uC788\uC5B4 \uC720\uC2E4 \uC0AC\uC720 \uCD94\uC801 \uBD88\uAC00\n```\n\n\uCD9C\uCC98\xB7\uC870\uD68C\uC77C\xB7\uAE30\uAC04\xB7\uD55C\uACC4\uB97C \uC548 \uC801\uC73C\uBA74 \uB098\uC911\uC5D0 \uAC19\uC740 \uC22B\uC790\uB97C \uC7AC\uD604\uD560 \uC218 \uC5C6\uB2E4.\n\n---\n\n## \uC815\uB9AC \uADDC\uCE59\n\n1. **\uC778\uCF54\uB529** \u2014 CSV\uB294 `utf-8-sig`\uB85C \uC77D\uACE0 \uC800\uC7A5\uD55C\uB2E4. \uC2E4\uD328\uD558\uBA74 `cp949` \u2192 `utf-8` \uC21C\uC11C\uB85C \uC7AC\uC2DC\uB3C4\uD558\uACE0, \uC5B4\uB290 \uC778\uCF54\uB529\uC73C\uB85C \uC77D\uD614\uB294\uC9C0 \uB85C\uADF8\uC5D0 \uB0A8\uAE34\uB2E4.\n2. **\uD0C0\uC785 \uBCC0\uD658** \u2014 \uB0A0\uC9DC\xB7\uC22B\uC790 \uCEEC\uB7FC\uC758 \uD0C0\uC785\uC744 \uBCC0\uD658\uD55C\uB2E4. \uBA85\uC138\uC640 \uC2E4\uC81C \uD3EC\uB9F7\uC774 \uB2E4\uB974\uBA74 \uB85C\uADF8\uC5D0 \uB0A8\uAE34\uB2E4. \uC22B\uC790\uC5D0 \uC11E\uC778 \uC27C\uD45C\xB7\uB2E8\uC704 \uBB38\uC790(`1,234`, `12%`, `3\uAC74`)\uB294 \uC81C\uAC70 \uD6C4 \uBCC0\uD658\uD558\uACE0, \uC81C\uAC70\uD55C \uD328\uD134\uC744 \uAE30\uB85D\uD55C\uB2E4.\n3. **\uACB0\uCE21** \u2014 \uCEEC\uB7FC\uBCC4 \uACB0\uCE21 \uBE44\uC728\uC744 \uACC4\uC0B0\uD574 \uAE30\uB85D\uD55C\uB2E4. **\uD589\uC744 \uC784\uC758\uB85C \uBC84\uB9AC\uC9C0 \uC54A\uB294\uB2E4.** \uBC84\uB824\uC57C \uD558\uBA74 \uC0AC\uC720\uC640 \uAC74\uC218\uB97C \uB85C\uADF8\uC5D0 \uB0A8\uAE34\uB2E4.\n4. **\uC911\uBCF5** \u2014 \uC644\uC804\uC911\uBCF5 \uD589 \uC218\uB97C \uAE30\uB85D\uD55C\uB2E4. \uD0A4\uAC00 \uC788\uC73C\uBA74 \uD0A4 \uAE30\uC900 \uC911\uBCF5\uB3C4 \uD568\uAED8. \uC81C\uAC70 \uC5EC\uBD80\uB294 \uC0AC\uC720\uC640 \uD568\uAED8 \uAE30\uB85D\uD55C\uB2E4.\n5. **\uD30C\uC0DD \uCEEC\uB7FC** \u2014 \uBD84\uC11D \uB2E8\uC704\uC5D0 \uB9DE\uCDB0 \uB9CC\uB4E0\uB2E4. \uC77C \uB2E8\uC704 \uB370\uC774\uD130\uBA74 \uC694\uC77C\xB7\uD3C9\uC77C/\uC8FC\uB9D0\xB7\uC6D4, \uC6D4 \uB2E8\uC704\uBA74 \uC5F0\uB3C4\xB7\uC6D4\xB7\uBD84\uAE30. \uC801\uC6A9 \uBD88\uAC00\uD558\uBA74 \uC0AC\uC720\uB97C \uB85C\uADF8\uC5D0 \uB0A8\uAE34\uB2E4.\n6. **\uAE30\uCD08\uD1B5\uACC4\uB294 \uCE21\uC815\uAC12 \uCEEC\uB7FC\uC5D0\uB9CC** \u2014 \uD3C9\uADE0\xB7\uD45C\uC900\uD3B8\uCC28\xB7\uC0AC\uBD84\uC704\uB294 \uCE21\uC815\uAC12\uC5D0\uB9CC. \uB0A0\uC9DC\xB7\uC5F0\uB3C4\xB7\uC6D4\xB7\uBD84\uAE30\xB7ID \uAC19\uC740 \uC2DC\uAC04\xB7\uAD6C\uBD84 \uCEEC\uB7FC\uC740 **\uBC94\uC704(min~max)\xB7\uACE0\uC720\uAC12 \uC218\xB7\uC911\uBCF5 \uC218**\uB9CC \uAE30\uB85D\uD55C\uB2E4. \uB0A0\uC9DC\uC758 \uD3C9\uADE0 \uAC19\uC740 \uBB34\uC758\uBBF8\uD55C \uD1B5\uACC4 \uAE08\uC9C0.\n7. **\uC6D0\uBCF8 \uBD88\uBCC0** \u2014 `input/`\xB7`data/raw/`\uC758 \uD30C\uC77C\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uB294\uB2E4. \uD56D\uC0C1 `data/clean/`\uC5D0 \uC0C8\uB85C \uC4F4\uB2E4.\n\n### \uC774\uC0C1\uCE58\uB294 \uC9C0\uC6B0\uC9C0 \uC54A\uB294\uB2E4\n\n\uC774\uC0C1\uCE58\uB97C \uC870\uC6A9\uD788 \uC81C\uAC70\uD558\uBA74 \uD568\uC815\uC774 \uC0AC\uB77C\uC9C4 \uAC8C \uC544\uB2C8\uB77C \uC228\uB294\uB2E4.\n\n- \uC774\uC0C1\uCE58\uB294 **\uD45C\uC2DC\uB9CC** \uD55C\uB2E4 (\uD50C\uB798\uADF8 \uCEEC\uB7FC \uB610\uB294 \uB85C\uADF8).\n- \uC81C\uAC70\uB294 \uC0AC\uC6A9\uC790\uAC00 \uC0AC\uC720\uB97C \uD655\uC778\uD55C \uB4A4\uC5D0\uB9CC. \uC81C\uAC70\uD558\uBA74 \uAC74\uC218\uC640 \uC0AC\uC720\uB97C \uBCF4\uACE0\uC11C\uC5D0 \uC801\uB294\uB2E4.\n- **\uD310\uB2E8\uC740 \uB2E4\uC74C \uB2E8\uACC4(\u2462 \uC758\uC2EC)\uC758 \uC77C\uC774\uB2E4.**\n\n---\n\n## preprocessing_report.html \u2014 \uBC18\uB4DC\uC2DC \uB4E4\uC5B4\uAC08 \uAC83\n\n```\n1. \uC77D\uC740 \uD30C\uC77C \uBAA9\uB85D + \uAC10\uC9C0\uB41C \uC778\uCF54\uB529 + \uC6D0\uBCF8 \uD589\uC218\xB7\uCEEC\uB7FC\uC218\n2. \uBCC0\uD658 \uB85C\uADF8 (\uCEEC\uB7FC\uBCC4: \uBB34\uC5C7\uC744 \u2192 \uBB34\uC5C7\uC73C\uB85C, \uC2E4\uD328 \uAC74\uC218)\n3. \uACB0\uCE21\uB960 \uD45C (\uCEEC\uB7FC\uBCC4 %)\n4. \uC911\uBCF5 \uAC74\uC218 (\uC644\uC804\uC911\uBCF5 / \uD0A4\uC911\uBCF5)\n5. before / after \uD589\uC218\xB7\uCEEC\uB7FC\uC218\n6. \uCE21\uC815\uAC12 \uCEEC\uB7FC \uAE30\uCD08\uD1B5\uACC4 + \uC2DC\uAC04\xB7\uAD6C\uBD84 \uCEEC\uB7FC \uBC94\uC704\uD45C (\uBD84\uB9AC\uD574\uC11C)\n7. \uC774\uC0C1\uCE58 \uD50C\uB798\uADF8 \uC694\uC57D (\uC81C\uAC70\uD588\uB2E4\uBA74 \uC0AC\uC720\xB7\uAC74\uC218)\n8. \uB0A8\uC740 \uBB38\uC81C \u2014 \uD574\uACB0 \uBABB \uD55C \uAC83. \u2462\uC758\uC2EC \uB2E8\uACC4\uC5D0\uC11C \uD655\uC778\uD560 \uBAA9\uB85D\n```\n\n---\n\n## \uAC15\uC81C \uADDC\uCE59\n\n1. **\uACBD\uB85C\xB7\uD30C\uC77C\uBA85 \uACE0\uC815** \u2014 \uCD9C\uB825 `data/clean/`, \uBCF4\uACE0\uC11C `collection_report.md`\xB7`preprocessing_report.html`. \uC774\uB984\uC744 \uBC14\uAFB8\uBA74 \uD30C\uC774\uD504\uB77C\uC778 \uCCB4\uD06C\uD3EC\uC778\uD2B8\uAC00 \uAE68\uC9C4\uB2E4.\n2. **\uC6D0\uBCF8 \uB36E\uC5B4\uC4F0\uAE30 \uAE08\uC9C0**\n3. **\uD589 \uC0AD\uC81C\uB294 \uB85C\uADF8 \uD544\uC218** \u2014 \uC0AC\uC720 + \uAC74\uC218\n4. **\uC774\uC0C1\uCE58 \uC784\uC758 \uC81C\uAC70 \uAE08\uC9C0** \u2014 \uD45C\uC2DC\uB9CC. \uD310\uB2E8\uC740 \u2462\n5. **\uB0A0\uC9DC\xB7\uAD6C\uBD84 \uCEEC\uB7FC\uC5D0 \uD3C9\uADE0 \uACC4\uC0B0 \uAE08\uC9C0**\n6. **\uCD9C\uCC98\xB7\uC870\uD68C\uC77C \uAE30\uB85D** \u2014 `collection_report.md` \uC5C6\uC774 \uC644\uB8CC \uBCF4\uACE0 \uAE08\uC9C0\n7. **`.env`\uB85C \uD0A4 \uAD00\uB9AC** \u2014 \uD558\uB4DC\uCF54\uB529 \uAE08\uC9C0\n\n---\n\n## \uD754\uD55C \uC2E4\uD328\n\n| \uC99D\uC0C1 | \uC6D0\uC778 | \uACE0\uCE58\uB294 \uBC95 |\n|---|---|---|\n| \uD55C\uAE00\uC774 `\xEF\xBF\xBD`\uB85C \uBCF4\uC784 | \uC778\uCF54\uB529 \uBBF8\uC9C0\uC815 | `utf-8-sig` \u2192 `cp949` \uC21C\uC11C\uB85C \uC7AC\uC2DC\uB3C4 |\n| \uC22B\uC790 \uCEEC\uB7FC\uC774 \uBB38\uC790\uB85C \uB0A8\uC74C | `1,234` \uC27C\uD45C | \uC27C\uD45C\xB7\uB2E8\uC704 \uC81C\uAC70 \uD6C4 \uBCC0\uD658, \uD328\uD134 \uAE30\uB85D |\n| \uB098\uC911\uC5D0 \uAC19\uC740 \uC22B\uC790\uAC00 \uC548 \uB098\uC634 | \uC870\uD68C\uC77C\xB7\uAE30\uAC04 \uBBF8\uAE30\uB85D | `collection_report.md` |\n| \u2462\uC5D0\uC11C \uC774\uC0C1\uCE58\uAC00 \uC548 \uBCF4\uC784 | \uC815\uB9AC \uB2E8\uACC4\uC5D0\uC11C \uC870\uC6A9\uD788 \uC0AD\uC81C | \uD50C\uB798\uADF8\uB9CC \uB2EC\uACE0 \uB118\uAE40 |\n\n## \uCC38\uACE0 \uD30C\uC77C\n\n- `references/data-sources-korea.md` \u2014 \uACF5\uACF5\xB7\uB124\uC774\uBC84\xB7\uD2B8\uB80C\uB4DC\xB7\uB3C4\uBA54\uC778\uBCC4 \uC18C\uC2A4 \uCE74\uD0C8\uB85C\uADF8 + \uC218\uC9D1 \uC2A4\uD06C\uB9BD\uD2B8 \uD328\uD134 (\uC678\uBD80 \uC218\uC9D1\uD560 \uB54C\uB9CC \uC77D\uB294\uB2E4)\n\n## \uC5F0\uAD00 \uC2A4\uD0AC\n\n- \uC55E \uB2E8\uACC4: `1-hypothesis` \xB7 \uB2E4\uC74C \uB2E8\uACC4: `3-suspect`\n- \uC804\uCCB4\uB97C \uC21C\uC11C\uB300\uB85C \uAD74\uB9AC\uB824\uBA74: `data-analysis-pipeline`\n'
  },
  {
    "skill": "2-collect",
    "file": "references/data-sources-korea.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/2-collect/references/data-sources-korea.md",
    "text": '# \uB370\uC774\uD130 \uC18C\uC2A4 \uCE74\uD0C8\uB85C\uADF8 (\uD55C\uAD6D) + \uC218\uC9D1 \uC2A4\uD06C\uB9BD\uD2B8 \uD328\uD134\n\n`2-collect`\uC5D0\uC11C **\uC678\uBD80 \uB370\uC774\uD130\uB97C \uC0C8\uB85C \uD655\uBCF4\uD560 \uB54C\uB9CC** \uC77D\uB294\uB2E4.\n\uC774\uBBF8 \uD30C\uC77C\uC774 \uC788\uC73C\uBA74(\uACBD\uB85C B) \uC774 \uBB38\uC11C\uB294 \uD544\uC694 \uC5C6\uB2E4.\n\n\uD0A4\uB294 \uC804\uBD80 `.env` \u2192 `os.environ`. **\uCF54\uB4DC\uC5D0 \uD558\uB4DC\uCF54\uB529 \uAE08\uC9C0**, `.env`\uB294 `.gitignore`\uC5D0.\n\n---\n\n## \uC2E0\uD638 3\uC885 \u2014 \uAC00\uB2A5\uD558\uBA74 \uC5EE\uB294\uB2E4\n\n| \uC2E0\uD638 | \uB73B | \uC608\uC2DC \uC18C\uC2A4 |\n|---|---|---|\n| **\uAD00\uC2EC** | \uC0AC\uB78C\uB4E4\uC774 \uCC3E\uC544\uBCF8 \uAC83 | \uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9, \uAD6C\uAE00\uD2B8\uB80C\uB4DC, \uC0AC\uB0B4 \uAC80\uC0C9\xB7\uC870\uD68C \uB85C\uADF8 |\n| **\uC2E4\uC81C** | \uC0AC\uB78C\uB4E4\uC774 \uD55C \uAC83 | \uBC29\uBB38\xB7\uAD6C\uB9E4\xB7\uACC4\uC57D\xB7\uC774\uC6A9 \uC9D1\uACC4, \uACF5\uACF5 \uD1B5\uACC4, CRM |\n| **\uB3D9\uC778** | \uC65C \uBC14\uB00C\uC5C8\uB098 | \uCEA0\uD398\uC778 \uC9D1\uD589, \uC815\uCC45\xB7\uAD50\uD1B5 \uAC1C\uD1B5, \uC774\uBCA4\uD2B8, \uB0A0\uC528, \uACBD\uC7C1\uC0AC |\n\n\uAD00\uC2EC\uB9CC\uC73C\uB85C \uACB0\uB860 \uB0B4\uBA74 \u2462\uC758\uC2EC\uC758 \uAC80\uC99D \uD568\uC815 7(\uC9C0\uD45C \uB300\uB9AC \uC624\uB958)\uC5D0 \uAC78\uB9B0\uB2E4.\n\n---\n\n## \uACF5\uACF5\xB7\uC815\uBD80\n\n### data.go.kr (\uACF5\uACF5\uB370\uC774\uD130\uD3EC\uD138)\n- `TOUR_API_KEY` \uB4F1 \uD658\uACBD\uBCC0\uC218. **\uB514\uCF54\uB529 \uD0A4** \uC0AC\uC6A9(\uC778\uCF54\uB529 \uD0A4 X)\n- **User-Agent \uD5E4\uB354 \uD544\uC218** \u2014 \uC5C6\uC73C\uBA74 403\n- \uBC1C\uAE09 \uD6C4 **1~2\uC2DC\uAC04 \uD0A4 \uC804\uD30C \uC9C0\uC5F0** \uC788\uC74C\n- \u26A0\uFE0F \uD65C\uC6A9\uC2E0\uCCAD \uD6C4 **\uC6F9 \uB2E4\uC6B4\uB85C\uB4DC \uD398\uC774\uC9C0\uC758 CSV\uAC00 API\uBCF4\uB2E4 \uD48D\uBD80\uD55C \uACBD\uC6B0\uAC00 \uB9CE\uB2E4.** API \uBD99\uC774\uAE30 \uC804\uC5D0 \uB2E4\uC6B4\uB85C\uB4DC \uBAA9\uB85D\uC744 \uBA3C\uC800 \uD655\uC778\n- \uD55C\uAD6D\uAD00\uAD11 \uB370\uC774\uD130\uB7A9: \uC778\uAE30\uAD00\uAD11\uC9C0\xB7\uCCB4\uB958\xB7\uC219\uBC15\xB7\uC720\uC785 \uB4F1 40+\uC885 CSV\n\n### \uADF8 \uC678\n- **KOSIS** (\uD1B5\uACC4\uCCAD) \u2014 \uC778\uAD6C\xB7\uC0AC\uC5C5\uCCB4\xB7\uC18C\uBE44. \u2462\uC758\uC2EC\uC758 \uAC80\uC99D \uD568\uC815 10(\uAD6C\uC870 \uBCF4\uC815)\uC6A9 \uBD84\uBAA8 \uB370\uC774\uD130\n- **\uC11C\uC6B8 \uC5F4\uB9B0\uB370\uC774\uD130\uAD11\uC7A5** \u2014 \uC0DD\uD65C\uC778\uAD6C, \uC9C0\uD558\uCCA0 \uC2B9\uD558\uCC28, \uB530\uB989\uC774 \uB300\uC5EC\n- **\uC9C0\uC790\uCCB4 \uC5F4\uB9B0\uB370\uC774\uD130** \u2014 \uC2DC\xB7\uB3C4\uBCC4\uB85C \uBCC4\uB3C4 \uD3EC\uD138\n\n## \uB124\uC774\uBC84\n\n### \uAC80\uC0C9\uC5B4 \uD2B8\uB80C\uB4DC (\uB370\uC774\uD130\uB7A9)\n- `NAVER_ID` / `NAVER_SECRET`\n- \uD55C\uAD6D \uAC80\uC0C9 **\uBE44\uC728**(\uC808\uB300\uB7C9 \uC544\uB2D8). \uD0A4\uC6CC\uB4DC \uADF8\uB8F9\xB7\uC5F0\uB839\uBCC4\xB7\uAE30\uAE30\uBCC4 \uBD84\uD574 \uAC00\uB2A5\n- \uCD5C\uC18C \uC870\uD68C \uB2E8\uC704: \uC77C/\uC8FC/\uC6D4\n\n### \uBE14\uB85C\uADF8 \uAC80\uC0C9 API\n- \uAC19\uC740 \uD0A4. \u26A0\uFE0F \'\uAC80\uC0C9\' API \uAD8C\uD55C\uC774 \uBCC4\uB3C4\uB85C \uD544\uC694\n- **1000\uAC74 \uC0C1\uD55C + \uB0A0\uC9DC \uD544\uD130 \uC5C6\uC74C** \u2192 **\uC2DC\uACC4\uC5F4 \uBD88\uAC00**. cross-section(\uB204\uC801 \uCE74\uC6B4\uD2B8) \uBE44\uAD50\uB9CC\n- \u2462\uC758\uC2EC\uC758 \uAC80\uC99D \uD568\uC815 9(\uB370\uC774\uD130 \uBC94\uC704\xB7\uC0C1\uD55C)\uC758 \uB300\uD45C \uC0AC\uB840\n\n### \uC1FC\uD551\uC778\uC0AC\uC774\uD2B8 (\uC635\uC158)\n- \uCE74\uD14C\uACE0\uB9AC\uBCC4 \uD074\uB9AD \uCD94\uC774. \uC0C1\uD488 \uCE74\uD14C\uACE0\uB9AC \uCF54\uB4DC \uD544\uC694\n\n## \uD2B8\uB80C\uB4DC\xB7SNS\n\n- **\uAD6C\uAE00\uD2B8\uB80C\uB4DC** (pytrends, \uD0A4 \uBD88\uD544\uC694) \u2014 \uC800\uBCFC\uB968 \uD0A4\uC6CC\uB4DC\uB294 \uC6D4\uBCC4 \uB178\uC774\uC988\uAC00 \uD06C\uB2E4. \uBA40\uD2F0\uC774\uC5B4 \uCD94\uC138\uC5D0\uB9CC \uC2E0\uB8B0. \u2192 `trend-traps.md`\n- **Apify \uC778\uC2A4\uD0C0\xB7\uC6F9 \uC2A4\uD06C\uB798\uD37C** (`APIFY_TOKEN`, $5 \uBB34\uB8CC) \u2014 \uCD5C\uADFC ~1\uAC1C\uC6D4\uB9CC. **\uC2DC\uACC4\uC5F4 \uC99D\uBA85 \uBD88\uAC00**\n\n## \uB3C4\uBA54\uC778\uBCC4\n\n| \uB3C4\uBA54\uC778 | \uC18C\uC2A4 |\n|---|---|\n| \uCD9C\uD310\xB7\uB3C4\uC11C | \uAD50\uBCF4\uBB38\uACE0\xB7YES24\xB7\uC54C\uB77C\uB518 \uBCA0\uC2A4\uD2B8\uC140\uB7EC, KPIPA(\uCD9C\uD310\uC0B0\uC5C5\uC9C4\uD765\uC6D0), \uAD6D\uB9BD\uC911\uC559\uB3C4\uC11C\uAD00 \uD1B5\uACC4 |\n| \uC0C1\uAD8C | \uC11C\uC6B8\uC2DC \uC0C1\uAD8C\uBD84\uC11D\uC11C\uBE44\uC2A4, \uD540\uB2E4\xB7\uD56B\uD50C\uB808\uC774\uC2A4 |\n| \uC2A4\uD3EC\uCE20 | KBO \uAE30\uB85D, \uC885\uBAA9\uBCC4 \uD611\uD68C \uD1B5\uACC4 |\n| \uC18C\uBE44\xB7\uAC00\uACA9 | \uB2E4\uB098\uC640, \uB124\uC774\uBC84 \uC1FC\uD551 |\n| \uC601\uD654 | KOFIC \uC601\uD654\uAD00\uC785\uC7A5\uAD8C\uD1B5\uD569\uC804\uC0B0\uB9DD(\uBC15\uC2A4\uC624\uD53C\uC2A4 API) |\n\n---\n\n## \uC218\uC9D1 \uC2A4\uD06C\uB9BD\uD2B8 \uD328\uD134\n\n### \uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9 \uAC80\uC0C9\uC5B4 \uD2B8\uB80C\uB4DC\n\n```python\nimport os, json, requests\n\nID, SECRET = os.environ["NAVER_ID"], os.environ["NAVER_SECRET"]\nbody = {\n    "startDate": "2022-01-01", "endDate": "2026-05-28", "timeUnit": "month",\n    "keywordGroups": [\n        {"groupName": "\uADF8\uB8F9\uBA85", "keywords": ["\uD0A4\uC6CC\uB4DC1", "\uD0A4\uC6CC\uB4DC2"]},\n    ],\n}\nr = requests.post(\n    "https://openapi.naver.com/v1/datalab/search",\n    headers={\n        "X-Naver-Client-Id": ID,\n        "X-Naver-Client-Secret": SECRET,\n        "Content-Type": "application/json",\n    },\n    data=json.dumps(body), timeout=30,\n)\nr.raise_for_status()\n```\n\n### \uB124\uC774\uBC84 \uBE14\uB85C\uADF8 \uAC80\uC0C9 (cross-section\uB9CC, \uC2DC\uACC4\uC5F4 \uBD88\uAC00)\n\n```python\nH = {"X-Naver-Client-Id": ID, "X-Naver-Client-Secret": SECRET}\nr = requests.get(\n    "https://openapi.naver.com/v1/search/blog.json",\n    params={"query": "\uAC80\uC0C9\uC5B4", "display": 1}, headers=H, timeout=15,\n)\ntotal = r.json().get("total")  # \uB204\uC801 \uAE00 \uC218. \uAE30\uAC04 \uBD84\uD574 \uBD88\uAC00\n```\n\n### data.go.kr (User-Agent \uD544\uC218)\n\n```python\nKEY = os.environ["TOUR_API_KEY"]  # \uB514\uCF54\uB529 \uD0A4\nUA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}\n\nr = requests.get(URL, params={"serviceKey": KEY, "_type": "json"},\n                 headers=UA, timeout=20)\n# params\uB85C \uB118\uAE30\uBA74 requests\uAC00 \uD55C \uBC88 \uC778\uCF54\uB529\uD55C\uB2E4 \u2192 \uBC18\uB4DC\uC2DC \uB514\uCF54\uB529 \uD0A4\uB97C \uB123\uB294\uB2E4\n```\n\n### \uC218\uC9D1 \uC9C1\uD6C4 \uBC18\uB4DC\uC2DC \uAE30\uB85D\n\n```python\nfrom pathlib import Path\nPath("collection_report.md").write_text(f"""# \uC218\uC9D1 \uAE30\uB85D\n- \uC18C\uC2A4: \uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9 \uAC80\uC0C9\uC5B4 \uD2B8\uB80C\uB4DC\n- \uC870\uD68C\uC77C: 2026-08-11\n- \uAE30\uAC04: 2022-01 ~ 2026-05 (\uC6D4 \uB2E8\uC704)\n- \uD589\uC218: {len(df)}\n- \uACB0\uCE21: {df.isna().sum().to_dict()}\n- \uC54C\uB824\uC9C4 \uD55C\uACC4: \uC808\uB300\uB7C9 \uC544\uB2D8(\uBE44\uC728). \uAE30\uAE30\uBCC4 \uBD84\uD574 \uC2DC \uD45C\uBCF8 \uCD95\uC18C\n""", encoding="utf-8")\n```\n\n\uC870\uD68C\uC77C\xB7\uAE30\uAC04\xB7\uD55C\uACC4\uB97C \uC548 \uC801\uC73C\uBA74 \uB098\uC911\uC5D0 \uAC19\uC740 \uC22B\uC790\uB97C \uC7AC\uD604\uD560 \uC218 \uC5C6\uB2E4.\n'
  },
  {
    "skill": "3-suspect",
    "file": "SKILL.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/3-suspect/SKILL.md",
    "text": '---\nname: 3-suspect\ndescription: \uBD84\uC11D 4\uB2E8\uACC4\uC758 \u2462 \uC758\uC2EC. \uACB0\uB860\uC744 \uB0B4\uAE30 \uC804\uC5D0 \uB370\uC774\uD130\uB97C \uC758\uC2EC\uD574\uC57C \uD560 \uB54C \uC0AC\uC6A9\uD55C\uB2E4. "\uC774 \uC22B\uC790 \uBBFF\uC744 \uC218 \uC788\uB098", "\uD568\uC815 \uC5C6\uB098", "\uAC80\uC99D\uD574\uC918", "\uC774 \uACB0\uB860 \uB9DE\uB098", "EDA \uD574\uC918", "\uBD84\uD3EC \uBD10\uC918", "\uC774\uC0C1\uCE58 \uD655\uC778", "\uC65C \uC774\uB807\uAC8C \uB098\uC654\uC9C0", \uAE09\uC99D\xB7\uAE09\uAC10\uC774 \uBCF4\uC774\uB294\uB370 \uC6D0\uC778\uC774 \uBD88\uD655\uC2E4\uD55C \uC0C1\uD669, \uB9AC\uD3EC\uD2B8\uB97C \uC4F0\uB824\uB294\uB370 \uC218\uCE58\uAC00 \uAC80\uC99D\uB418\uC9C0 \uC54A\uC740 \uC0C1\uD669.\n---\n\n# \u2462 \uC758\uC2EC \u2014 \uACB0\uB860 \uB0B4\uAE30 \uC804\uC5D0 \uB370\uC774\uD130\uB97C \uC758\uC2EC\uD55C\uB2E4\n\n\uBD84\uC11D 4\uB2E8\uACC4\uC758 \uC138 \uBC88\uC9F8. **\uC774 \uB2E8\uACC4\uAC00 \uBD84\uC11D\uAC00\uC640 \uACC4\uC0B0\uAE30\uC758 \uCC28\uC774\uB2E4.** \uC9D1\uACC4\uB294 \uCF54\uB4DC\uAC00 \uD558\uC9C0\uB9CC, "\uC774 \uC22B\uC790\uAC00 \uC9C4\uC9DC\uB0D0"\uB294 \uC5EC\uAE30\uC11C \uD310\uC815\uD55C\uB2E4.\n\n> \uD55C \uC904: **\uC790\uBA85\uD574 \uBCF4\uC774\uB294 \uC22B\uC790\uAC00 \uAC00\uC7A5 \uC704\uD5D8\uD558\uB2E4.**\n\n**\uC0B0\uCD9C\uBB3C**: `eda_report.html` + `traps_check.md`\n**\uC55E \uB2E8\uACC4**: `datapopcorn-analysis:2-collect` (\uC218\uC9D1\xB7\uC815\uB9AC)\n**\uB2E4\uC74C \uB2E8\uACC4**: `datapopcorn-analysis:4-report` (\uD55C \uC7A5 \uB9AC\uD3EC\uD2B8)\n\n---\n\n## \uC21C\uC11C\n\n1. **EDA** \u2014 `3_eda.py`\uB85C \uBAA8\uC591\uC744 \uBCF8\uB2E4. \uBD10\uC57C \uC758\uC2EC\uD560 \uC218 \uC788\uB2E4.\n2. **\uD568\uC815 10\uAC1C \uD310\uC815** \u2014 \uD558\uB098\uC529 \uC790\uBB38\uD558\uACE0 `traps_check.md`\uC5D0 \uAE30\uB85D\uD55C\uB2E4.\n3. **\uAC78\uB9B0 \uAC83 \uCC98\uB9AC** \u2014 \uC7AC\uC9D1\uACC4\uB85C \uACE0\uCE60 \uC218 \uC788\uC73C\uBA74 \uACE0\uCE58\uACE0, \uBABB \uACE0\uCE58\uBA74 \u2463\uC758 "\uD55C\uACC4" \uCE74\uB4DC\uB85C \uB118\uAE34\uB2E4.\n\n### 1. EDA \u2014 eda_report.html\n\n| \uBCFC \uAC83 | \uC65C |\n|---|---|\n| \uCEEC\uB7FC\uBCC4 \uBD84\uD3EC (\uD788\uC2A4\uD1A0\uADF8\uB7A8\xB7\uBC15\uC2A4\uD50C\uB86F) | \uD3C9\uADE0 \uD558\uB098\uB85C \uC694\uC57D\uB418\uC9C0 \uC54A\uB294 \uBAA8\uC591\uC744 \uCC3E\uB294\uB2E4 |\n| \uC774\uC0C1\uCE58 (\u2461\uC5D0\uC11C \uB2EC\uC544\uB454 \uD50C\uB798\uADF8) | \uC9C0\uC6B4 \uAC8C \uC544\uB2C8\uB77C \uD310\uC815\uD574\uC57C \uD560 \uAC83 |\n| \uACB0\uCE21 \uD328\uD134 | \uB79C\uB364 \uACB0\uCE21\uC778\uAC00, \uD2B9\uC815 \uC870\uAC74\uC5D0\uC11C\uB9CC \uBE44\uB294\uAC00 |\n| \uAE30\uAC04 \uCEE4\uBC84\uB9AC\uC9C0 | \uC55E\uB4A4\uAC00 \uC798\uB824 \uC788\uC9C0 \uC54A\uB098. \uBE48 \uAD6C\uAC04 \uC788\uB098 |\n| \uD575\uC2EC \uC9C0\uD45C \xD7 \uC138\uADF8\uBA3C\uD2B8 | \uCC44\uB110\xB7\uC720\uD615\xB7\uC9C0\uC810\uBCC4\uB85C \uCABC\uAC20 \uCCAB \uADF8\uB9BC |\n| \uC2DC\uAC04\uCD95 \uCD94\uC138 | \uAE09\uBCC0\uC810\uC774 \uC5B4\uB514\uC778\uAC00 |\n\n**\u2461\uC5D0\uC11C \uB118\uC5B4\uC628 `preprocessing_report.html`\uC758 "\uB0A8\uC740 \uBB38\uC81C" \uD56D\uBAA9\uC744 \uBA3C\uC800 \uD655\uC778\uD55C\uB2E4.**\n\n### 2. \uD568\uC815 10\uAC1C \uD310\uC815\n\n`hypothesis.md`\uC758 \uD575\uC2EC \uC9C0\uD45C\uC640 \uD310\uC815 \uAE30\uC900\uC744 \uC5F4\uC5B4\uB193\uACE0, \uC544\uB798 10\uAC1C\uB97C **\uACB0\uB860 \uB0B4\uAE30 \uC804\uC5D0** \uD558\uB098\uC529 \uC790\uBB38\uD55C\uB2E4.\n\n\uAE30\uB85D \uD615\uC2DD (`traps_check.md`):\n```markdown\n| # | \uD568\uC815 | \uD310\uC815 | \uADFC\uAC70 / \uC870\uCE58 |\n|---|---|---|---|\n| 1 | \uAE30\uC900 \uAE30\uAC04 | \uAC78\uB9BC | \uBE44\uAD50 \uAE30\uC900\uC774 \uC124 \uC5F0\uD734 \uD3EC\uD568 \uB2EC \u2192 2~3\uC6D4 \uD3C9\uADE0\uC73C\uB85C \uC7AC\uACC4\uC0B0 |\n| 2 | \uC808\uB300 vs \uBCC0\uD654\uC728 | \uD655\uC778\uD568 | \uC9C8\uBB38\uC774 "\uC5B4\uB514\uAC00 \uBE68\uB9AC \uB290\uB098"\uB77C \uBCC0\uD654\uC728\uC774 \uB9DE\uC74C |\n| 3 | \uD45C\uBCF8 \uD06C\uAE30 | \uAC78\uB9BC | C\uCC44\uB110 7\uAC74\uBFD0 \u2192 \uBE44\uC728 \uD45C\uAE30 \uC0AD\uC81C, \uAC74\uC218\uB85C\uB9CC |\n| 4 | \uD3C9\uADE0\uC758 \uD568\uC815 | \uD655\uC778\uD568 | \uC911\uC559\uAC12 \uBCD1\uAE30. \uBD84\uD3EC \uB2E8\uBD09 |\n| 5 | \uC0C1\uAD00 \u2260 \uC778\uACFC | \uAC78\uB9BC | \uCEA0\uD398\uC778 \uC2DC\uC810\uACFC \uACB9\uCE58\uB098 \uB2E4\uB978 \uBCC0\uD654\uB3C4 \uC788\uC5C8\uC74C \u2192 "\uB3D9\uC2DC \uBC1C\uC0DD"\uC73C\uB85C \uC11C\uC220 |\n```\n\n**`\uD574\uB2F9\uC5C6\uC74C` / `\uD655\uC778\uD568(\uBC29\uBC95)` / `\uAC78\uB9BC(\u2192 \uC870\uCE58)`** \uC14B \uC911 \uD558\uB098\uB85C \uC801\uB294\uB2E4. \uBE48 \uCE78\uC744 \uB0A8\uAE30\uC9C0 \uC54A\uB294\uB2E4.\n\n---\n\n## \uACF5\uD1B5 \uD568\uC815 5 \u2014 \uBAA8\uB4E0 \uBD84\uC11D\n\n1. **\uAE30\uC900 \uAE30\uAC04** \u2014 \uBE44\uAD50 \uAE30\uC900\uC774 \uBE44\uC815\uC0C1 \uC2DC\uC810(\uBA85\uC808\xB7\uBE44\uC218\uAE30\xB7\uC774\uBCA4\uD2B8 \uB2EC\xB7\uD32C\uB370\uBBF9 \uC800\uC810) \uC544\uB2CC\uAC00? \uC815\uC0C1 \uAE30\uAC04\uACFC \uB2E4\uC2DC \uBE44\uAD50.\n2. **\uC808\uB300 vs \uBCC0\uD654\uC728** \u2014 "\uC81C\uC77C \uD070 \uAC83"\uACFC "\uC81C\uC77C \uBE68\uB9AC \uB290\uB294 \uAC83"\uC740 \uB2E4\uB974\uB2E4. \uC9C8\uBB38\uC5D0 \uB9DE\uB294 \uC9C0\uD45C\uC778\uAC00.\n3. **\uD45C\uBCF8 \uD06C\uAE30** \u2014 \uAC74\uC218\uAC00 \uC801\uC740\uB370(10\uAC74 \uBBF8\uB9CC) \uBE44\uC728(%)\uB85C \uB2E8\uC815 \uC548 \uD588\uB098. "\uC804\uD658\uC728 50%"\uAC00 2\uAC74 \uC911 1\uAC74\uC77C \uC218 \uC788\uB2E4. \uAC00\uB2A5\uD558\uBA74 \uACF5\uC2DD \uC9D1\uACC4\uB85C \uAD50\uCCB4.\n4. **\uD3C9\uADE0\uC758 \uD568\uC815** \u2014 \uD3C9\uADE0 \uD558\uB098\uAC00 \uADF9\uB2E8\uAC12\xB7\uC138\uADF8\uBA3C\uD2B8 \uCC28\uC774\uB97C \uAC00\uB9AC\uC9C0 \uC54A\uB098? \uC911\uC559\uAC12\xB7\uBD84\uD3EC\uB3C4 \uAC19\uC774 \uBCF8\uB2E4.\n5. **\uC0C1\uAD00 \u2260 \uC778\uACFC** \u2014 \uC2DC\uC810\uC774 \uACB9\uCE5C\uB2E4\uACE0 \uC6D0\uC778\uC73C\uB85C \uB2E8\uC815 \uC548 \uD588\uB098. "\uBC14\uAFBC \uAC83 \uB9D0\uACE0 \uB2E4\uB978 \uBCC0\uD654\uB294 \uC5C6\uC5C8\uB098" \uD55C \uBC88 \uB354.\n\n## \uAC80\uC99D \uD568\uC815 5 \u2014 \uD55C \uB2E8\uACC4 \uAE4A\uAC8C\n\n6. **\uB2E8\uC704 \uC815\uC758** \u2014 \uC9D1\uACC4 \uB2E8\uC704\uAC00 \uC0AC\uB78C\uB4E4\uC774 \uC2E4\uC81C \uC4F0\uB294 \uB2E8\uC704\uC778\uAC00? (\uC870\uC9C1\uB3C4\uC0C1 \uBD80\uC11C vs \uC2E4\uC81C \uC77C\uD558\uB294 \uD300, \uACC4\uC815 vs \uC0AC\uB78C, \uD589\uC815\uAD6C\uC5ED vs \uBE0C\uB79C\uB4DC) \uB2E8\uC704\uB97C \uC798\uBABB \uC7A1\uC73C\uBA74 \uBC29\uD5A5\uAE4C\uC9C0 \uB4A4\uC9D1\uD78C\uB2E4.\n7. **\uC9C0\uD45C \uB300\uB9AC \uC624\uB958** \u2014 \uCE21\uC815\uD55C \uAC83\uC774 \uC54C\uACE0 \uC2F6\uC740 \uAC83\uC758 **\uB300\uB9AC\uC9C0\uD45C**\uC77C \uBFD0 \uC544\uB2CC\uAC00? (\uD074\uB9AD \u2260 \uAD6C\uB9E4, \uAC80\uC0C9 \u2260 \uBC29\uBB38, \uBB38\uC758 \u2260 \uC218\uC694) \uC2DC\uCC28\uB3C4 \uC788\uB2E4.\n8. **\uC18C\uC2A4 \uD3B8\uD5A5** \u2014 \uC18C\uC2A4 \uC790\uCCB4\uAC00 \uD55C \uBC29\uD5A5\uC73C\uB85C \uC3E0\uB824 \uC788\uC9C0 \uC54A\uB098? (\uB9AC\uBDF0\xB7\uBE14\uB85C\uADF8\uC758 \uAE0D\uC815 \uD3B8\uD5A5, \uD2B9\uC815 \uCC44\uB110\uB9CC \uB0A8\uB294 \uC140\uD504\uC120\uD0DD, \uB9E4\uCCB4\uBCC4 \uC7A5\uB974 \uC3E0\uB9BC) \uBD88\uB9CC\xB7\uBD80\uC7AC\uB294 \uD3B8\uD5A5\uB41C \uC18C\uC2A4\uC5D0\uC11C \uCC3E\uC744 \uC218 \uC5C6\uB2E4.\n9. **\uB370\uC774\uD130 \uBC94\uC704\xB7\uC0C1\uD55C** \u2014 API\xB7\uCD94\uCD9C\uBCF8\uC758 **\uAE30\uAC04\xB7\uAC74\uC218 \uC0C1\uD55C**\uC744 \uBA3C\uC800 \uD655\uC778\uD588\uB098? (\uAC74\uC218 \uC0C1\uD55C\uB9CC \uC8FC\uB294 API\uB85C\uB294 \uC2DC\uACC4\uC5F4\uC744 \uB9CC\uB4E4 \uC218 \uC5C6\uB2E4)\n10. **\uAD6C\uC870 \uBCF4\uC815** \u2014 \uC808\uB300 \uBD84\uD3EC\uB97C \uBD84\uBAA8 \uBCF4\uC815 \uC5C6\uC774 \uD574\uC11D \uC548 \uD588\uB098? (\uC5F0\uB839\xB7\uC9C0\uC5ED\xB7\uADDC\uBAA8\xB7\uACC4\uC808) \uBAA8\uC9D1\uB2E8 \uAD6C\uC870\uAC00 \uC774\uBBF8 \uADF8\uB7F0 \uBAA8\uC591\uC77C \uC218 \uC788\uB2E4.\n\n## \uD2B8\uB80C\uB4DC\xB7\uC9C0\uC5ED \uBD84\uC11D\uC774\uBA74 \uCD94\uAC00\n\n\uAC80\uC0C9\uB7C9\xB7SNS\xB7\uC9C0\uBA85\xB7\uACC4\uC808 \uD2B8\uB80C\uB4DC\uB97C \uB2E4\uB8EC\uB2E4\uBA74 **`references/trend-traps.md`**\uC758 \uC804\uC6A9 \uD568\uC815 6\uAC1C(\uB3D9\uC74C\uC774\uC758\uC5B4\xB7\uC5B8\uAE09\uB7C9\u2260\uBAA9\uC801\uC9C0\xB7\uC800\uBCFC\uB968 \uB178\uC774\uC988\xB7\uC0C1\uC2DCvs\uC2E0\uADDC\xB7\uB9E4\uCCB4\uD3B8\uD5A5\xB7\uD32C\uB370\uBBF9 \uAE30\uC900\uC5F0\uB3C4)\uB97C **\uCD94\uAC00\uB85C** \uD1B5\uACFC\uC2DC\uD0A8\uB2E4. \uC2E4\uC81C \uC0AC\uB840\uC640 \uAC80\uC99D\uBC95\uB3C4 \uADF8 \uD30C\uC77C\uC5D0 \uC788\uB2E4.\n\n---\n\n## \uC778\uACFC\uB97C \uC8FC\uC7A5\uD560 \uC218 \uC788\uB294 \uC870\uAC74\n\n\uB300\uBD80\uBD84\uC758 \uBD84\uC11D\uC740 \uC778\uACFC\uB97C \uB9D0\uD560 \uC218 \uC5C6\uB2E4. \uB9D0\uD560 \uC218 \uC788\uB294 \uC720\uC77C\uD55C \uACBD\uC6B0:\n\n```\n\uAC1C\uC785 \uC774\uC804 baseline\uC774 \uD3C9\uD3C9\uD558\uB2E4 (\uCD94\uC138 \uC5C6\uC74C)\n        +\n\uAE09\uBCC0 \uC2DC\uC810\uC774 \uAC1C\uC785 \uC2DC\uC810\uACFC \uC815\uD655\uD788 \uC77C\uCE58\uD55C\uB2E4\n        +\n\uAC19\uC740 \uC2DC\uC810\uC758 \uB2E4\uB978 \uBCC0\uD654\uAC00 \uC5C6\uB2E4\n```\n\n\uC138 \uAC1C\uAC00 \uB2E4 \uB9DE\uC73C\uBA74 \uAC15\uD55C \uADC0\uC778\uC774 \uAC00\uB2A5\uD558\uB2E4. \uD558\uB098\uB77C\uB3C4 \uBE60\uC9C0\uBA74 **"\uB3D9\uC2DC \uBC1C\uC0DD"**\uAE4C\uC9C0\uB9CC \uC4F4\uB2E4.\n\n---\n\n## \uAC15\uC81C \uADDC\uCE59\n\n1. **`traps_check.md`\uC5D0 10\uC904 \uD310\uC815 \uAE30\uB85D** \u2014 \uBA38\uB9BF\uC18D\uC73C\uB85C \uD1B5\uACFC\uC2DC\uD0A4\uC9C0 \uC54A\uB294\uB2E4. \uD30C\uC77C\uC774 \uC774 \uB2E8\uACC4\uC758 \uC644\uB8CC \uC99D\uBA85\uC774\uB2E4.\n2. **\uBE48 \uD310\uC815 \uAE08\uC9C0** \u2014 \uD574\uB2F9\uC5C6\uC74C/\uD655\uC778\uD568/\uAC78\uB9BC \uC911 \uD558\uB098\uB97C \uBC18\uB4DC\uC2DC \uC801\uB294\uB2E4.\n3. **\uAC78\uB9B0 \uD56D\uBAA9\uC740 \uC0AC\uB77C\uC9C0\uC9C0 \uC54A\uB294\uB2E4** \u2014 \uC7AC\uC9D1\uACC4\uB85C \uACE0\uCE58\uAC70\uB098, \u2463\uC758 "\uD55C\uACC4" \uCE74\uB4DC\uB85C \uB118\uAE34\uB2E4. \uC870\uC6A9\uD788 \uC9C0\uC6B0\uC9C0 \uC54A\uB294\uB2E4.\n4. **\uC778\uACFC \uB2E8\uC815 \uAE08\uC9C0** \u2014 \uC704 3\uC870\uAC74\uC744 \uB2E4 \uB9CC\uC871\uD558\uC9C0 \uC54A\uC73C\uBA74 "\uB3D9\uC2DC \uBC1C\uC0DD"\uC73C\uB85C \uC11C\uC220.\n5. **\uD310\uC815 \uAE30\uC900\uC740 `hypothesis.md`\uC758 \uAC83\uC744 \uC4F4\uB2E4** \u2014 \uC5EC\uAE30\uC11C \uC0C8\uB85C \uB9CC\uB4E4\uC9C0 \uC54A\uB294\uB2E4.\n6. **\uAC80\uC99D \uC548 \uB41C \uC218\uCE58\uB294 \u2463\uB85C \uB118\uAE30\uC9C0 \uC54A\uB294\uB2E4** \u2014 \uB118\uAE30\uBA74 \uD5E4\uB4DC\uB77C\uC778\xB7KPI\uC5D0 \uC62C\uB77C\uAC04\uB2E4.\n7. **\uC790\uBA85\uD55C \uBC1C\uACAC\uC740 \uBC1C\uACAC\uC774 \uC544\uB2C8\uB2E4** \u2014 "\uC5EC\uB984\uC5D0 \uC544\uC774\uC2A4\uCEE4\uD53C\uAC00 \uB354 \uD314\uB9B0\uB2E4"\uB294 \uC778\uC0AC\uC774\uD2B8\uAC00 \uC544\uB2C8\uB2E4.\n\n---\n\n## \uD754\uD55C \uC2E4\uD328\n\n| \uC99D\uC0C1 | \uC6D0\uC778 | \uACE0\uCE58\uB294 \uBC95 |\n|---|---|---|\n| \uD568\uC815 \uD310\uC815 \uAE30\uB85D\uC774 \uC5C6\uC74C | \uCCB4\uD06C\uB9AC\uC2A4\uD2B8\uB97C \uB300\uD654\uB85C\uB9CC \uD6D1\uC74C | `traps_check.md` \uD45C 10\uC904 |\n| \uAC78\uB9B0 \uD568\uC815\uC774 \uB9AC\uD3EC\uD2B8\uC5D0 \uC548 \uAC10 | \uC7AC\uC9D1\uACC4\uB85C \uBABB \uACE0\uCCD0\uC11C \uADF8\uB0E5 \uBE8C | "\uD55C\uACC4" \uCE74\uB4DC\uB85C \uC774\uAD00 |\n| \uAE09\uC99D \uC6D0\uC778\uC744 \uB2E8\uC815 | \uC2DC\uC810 \uC77C\uCE58\uB9CC \uBCF4\uACE0 \uC778\uACFC \uACB0\uB860 | 3\uC870\uAC74 \uD655\uC778 \u2192 \uC548 \uB418\uBA74 "\uB3D9\uC2DC \uBC1C\uC0DD" |\n| \uC138\uADF8\uBA3C\uD2B8 \uBE44\uC728\uC774 \uACFC\uC7A5\uB428 | \uC18C\uD45C\uBCF8\uC5D0 % \uD45C\uAE30 | 10\uAC74 \uBBF8\uB9CC\uC740 \uAC74\uC218\uB85C\uB9CC |\n| EDA\uB97C \uAC74\uB108\uB700 | \uBC14\uB85C \uC9D1\uACC4\uB85C \uAC10 | \uBAA8\uC591\uC744 \uBD10\uC57C \uC758\uC2EC\uD560 \uC218 \uC788\uB2E4 |\n\n## \uCC38\uACE0 \uD30C\uC77C\n\n- `references/trend-traps.md` \u2014 \uD2B8\uB80C\uB4DC\xB7\uC9C0\uC5ED \uC804\uC6A9 \uD568\uC815 6\uAC1C + \uAC80\uC99D \uC0AC\uB840\uC9D1(\uBB35\uD638\xB7\uC601\uC6D4\xB7\uB530\uB989\uC774)\n\n## \uC5F0\uAD00 \uC2A4\uD0AC\n\n- \uC55E \uB2E8\uACC4: `2-collect` \xB7 \uB2E4\uC74C \uB2E8\uACC4: `4-report`\n- \uC804\uCCB4\uB97C \uC21C\uC11C\uB300\uB85C \uAD74\uB9AC\uB824\uBA74: `data-analysis-pipeline`\n'
  },
  {
    "skill": "3-suspect",
    "file": "references/trend-traps.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/3-suspect/references/trend-traps.md",
    "text": '# \uD2B8\uB80C\uB4DC\xB7\uC9C0\uC5ED \uBD84\uC11D \uC804\uC6A9 \uD568\uC815 + \uAC80\uC99D \uC0AC\uB840\uC9D1\n\n`3-suspect`\uC5D0\uC11C **\uAC80\uC0C9\uB7C9\xB7SNS\xB7\uC9C0\uBA85\xB7\uACC4\uC808 \uD2B8\uB80C\uB4DC**\uB97C \uB2E4\uB8F0 \uB54C\uB9CC \uCD94\uAC00\uB85C \uC77D\uB294\uB2E4.\n\uACF5\uD1B5 \uD568\uC815 5 + \uAC80\uC99D \uD568\uC815 5(SKILL.md)\uB97C \uBA3C\uC800 \uD1B5\uACFC\uD55C \uB4A4 \uC544\uB798\uB97C \uC5B9\uB294\uB2E4.\n\n---\n\n## \uD2B8\uB80C\uB4DC \uC804\uC6A9 \uD568\uC815 6\n\n### T1. \uB3D9\uC74C\uC774\uC758\uC5B4\n\uC9C0\uBA85\xB7\uB2E8\uC5B4\uAC00 \uC77C\uBC18\uBA85\uC0AC\uB098 \uB2E4\uB978 \uB73B\uACFC \uC11E\uC774\uB098?\n- \uC0AC\uB840: "\uB3D9\uD574" = \uB3D9\uD574\uC2DC + \uB3D9\uD574\uBC14\uB2E4. \uAC80\uC0C9\uB7C9\uC774 \uB3C4\uC2DC \uAD00\uC2EC\uC73C\uB85C \uBCF4\uC774\uC9C0\uB9CC \uB300\uBD80\uBD84 \uBC14\uB2E4\n- \uAC80\uC99D: \uC5F0\uAD00\uAC80\uC0C9\uC5B4\xB7\uC790\uB3D9\uC644\uC131\uC73C\uB85C \uC2E4\uC81C \uC758\uB3C4 \uBD84\uD574. \uC9C0\uC5ED\uBA85\uC744 \uBD99\uC778 \uC870\uD569 \uD0A4\uC6CC\uB4DC\uB85C \uC7AC\uCE21\uC815("\uB3D9\uD574\uC2DC \uB9DB\uC9D1")\n\n### T2. \uC5B8\uAE09\uB7C9 \u2260 \uBAA9\uC801\uC9C0\n"X \uC5EC\uD589" \uCE74\uC6B4\uD2B8\uB294 **\uBAA9\uC801\uC9C0\uAC00 \uC544\uB2C8\uB77C \uB4E4\uB974\uB294 \uC2A4\uD31F**\uB3C4 \uD06C\uAC8C \uC7A1\uD78C\uB2E4.\n- \uC0AC\uB840: \uC131\uC218 316k vs \uC815\uB3D9\uC9C4 191k \u2014 \uC131\uC218\uB294 \uBAA9\uC801\uC9C0\uAC00 \uC544\uB2C8\uB77C \uACBD\uC720\xB7\uC77C\uC0C1 \uC18C\uBE44 \uC9C0\uC5ED\n- \uAC80\uC99D: \uC5B8\uAE09\uB7C9\uC73C\uB85C \uB2E8\uC704\uB97C \uBE44\uAD50\uD558\uC9C0 \uB9D0\uACE0 \uB2E4\uB978 \uC9C0\uD45C\uB85C(\uAC80\uC0C9 \uAE09\uB4F1\uB960, \uC5ED \uC2B9\uD558\uCC28 \uAC19\uC740 \uC9C1\uC811 \uC9C0\uD45C, \uC219\uBC15 \uC9D1\uACC4)\n\n### T3. \uC800\uBCFC\uB968 \uB178\uC774\uC988\n\uAD6C\uAE00\uD2B8\uB80C\uB4DC \uC6D4\uBCC4 \uAC12\uC774 0\uACFC \uC2A4\uD30C\uC774\uD06C\uB85C \uD280\uB294 \uC800\uBCFC\uB968 \uD0A4\uC6CC\uB4DC \uC544\uB2CC\uAC00?\n- \uC99D\uC0C1: \uC5B4\uB5A4 \uB2EC\uC740 0, \uC5B4\uB5A4 \uB2EC\uC740 100. \uD3C9\uADE0\uC774 \uBB34\uC758\uBBF8\n- \uAC80\uC99D: \uC8FC \uB2E8\uC704 \u2192 \uC6D4/\uBD84\uAE30\uB85C \uBB36\uAE30. \uBA40\uD2F0\uC774\uC5B4 \uCD94\uC138\uB9CC \uC77D\uACE0 \uB2E8\uC6D4 \uBE44\uAD50\uB294 \uBC84\uB9B0\uB2E4. \uAD6D\uB0B4 \uD0A4\uC6CC\uB4DC\uB294 \uB124\uC774\uBC84 \uB370\uC774\uD130\uB7A9\uC73C\uB85C \uAD50\uCC28 \uD655\uC778\n\n### T4. \uC0C1\uC2DC vs \uC2E0\uADDC\n\uBCC0\uD654\uC758 \uB3D9\uC778\uC744 **\uB9E4\uB144 \uBC18\uBCF5\uB418\uB294 \uAC83**\uC5D0\uC11C \uCC3E\uACE0 \uC788\uC9C0 \uC54A\uB098?\n- \uC0AC\uB840: \uC601\uC6D4 \uB2E8\uC885\uBB38\uD654\uC81C\uB294 \uD3C9\uB144 \uAC80\uC0C9\uB7C9\uC744 \uBABB \uC6C0\uC9C1\uC778\uB2E4. \uC2E4\uC81C \uB3D9\uC778\uC740 \uAC1C\uBD09 \uC601\uD654\uC600\uB2E4\n- \uAC80\uC99D: \uC804\uB144\xB7\uC804\uC804\uB144 \uAC19\uC740 \uB2EC\uC5D0\uB3C4 \uAC19\uC740 \uC2A4\uD30C\uC774\uD06C\uAC00 \uC788\uB098 \uD655\uC778. \uC788\uC73C\uBA74 \uADF8\uAC74 \uB3D9\uC778\uC774 \uC544\uB2C8\uB77C \uACC4\uC808\uC131\n\n### T5. \uB9E4\uCCB4 \uD3B8\uD5A5 (\uC7A5\uB974\xB7\uAE0D\uC815)\n- **\uC7A5\uB974 \uD3B8\uD5A5**: \uCE74\uD398\xB7\uB9DB\uC9D1\uCC98\uB7FC \uB9E4\uCCB4\uAC00 \uC6D0\uB798 \uC3E0\uB9AC\uB294 \uD56D\uBAA9\uC778\uAC00? \u2192 \uC5EC\uB7EC \uC9C0\uC5ED\uC758 **\uBE44\uC728**\uC744 \uD53C\uC5B4 \uBE44\uAD50\uB85C \uAC80\uC99D\n- **\uAE0D\uC815 \uD3B8\uD5A5**: \uBD88\uB9CC\xB7\uBD80\uC7AC\uB97C \uBE14\uB85C\uADF8\uCC98\uB7FC \uAE0D\uC815 \uD3B8\uD5A5 \uB9E4\uCCB4\uC5D0\uC11C \uCC3E\uACE0 \uC788\uC9C0 \uC54A\uB098? \u2192 \uC9C0\uB3C4 \uB9AC\uBDF0\xB7\uBBFC\uC6D0 \uCC44\uB110\xB7\uCEE4\uBBA4\uB2C8\uD2F0\uB85C \uAD50\uCC28\n\n### T6. \uD32C\uB370\uBBF9 \uAE30\uC900\uC5F0\uB3C4\n2020~2022\uB97C \uBE44\uAD50 \uAE30\uC900\uC73C\uB85C \uC7A1\uC73C\uBA74 \uBB34\uC5C7\uC774\uB4E0 \uAE09\uC99D\uC73C\uB85C \uBCF4\uC778\uB2E4.\n- \uAC80\uC99D: \uC815\uC0C1\uC5F0\uB3C4(2019 \uB610\uB294 2024 \uC774\uD6C4)\uB97C \uAE30\uC900\uC73C\uB85C \uB2E4\uC2DC \uACC4\uC0B0. \uACF5\uD1B5 \uD568\uC815 1\uC758 \uD55C\uAD6D \uD2B9\uC218 \uCF00\uC774\uC2A4\n\n---\n\n## \uAC80\uC99D \uC0AC\uB840\uC9D1\n\n### \uC0AC\uB840 1 \u2014 \uBB35\uD638: \uAD6C\uC870\uC801 \uBD80\uC0C1 (\uB2E8\uC704\uB97C \uBC14\uAFB8\uB2C8 \uBC29\uD5A5\uC774 \uB4A4\uC9D1\uD798)\n\n| \uC9D1\uACC4 \uB2E8\uC704 | \uACB0\uACFC |\n|---|---|\n| \uB3D9\uD574\uC2DC (\uD589\uC815\uBA85) | \xD70.7 \u2014 \uAC10\uC18C |\n| \uBB35\uD638 (\uBE0C\uB79C\uB4DC\uBA85) | \xD73.7 \u2014 \uAE09\uC99D |\n\n- **\uBC30\uC6B4 \uAC83**: \uC0AC\uB78C\uB4E4\uC774 \uBD80\uB974\uB294 \uC774\uB984\uC774 \uBD84\uC11D \uB2E8\uC704\uB2E4. \uD589\uC815 \uB2E8\uC704\uB85C \uC9D1\uACC4\uD558\uBA74 \uC0C1\uAD8C \uD558\uB098\uC758 \uBD80\uC0C1\uC774 \uC2DC \uC804\uCCB4 \uD3C9\uADE0\uC5D0 \uBB3B\uD78C\uB2E4 \u2192 \uAC80\uC99D \uD568\uC815 6(\uB2E8\uC704 \uC815\uC758)\n- **\uB3D9\uC778 \uADC0\uC778**: KTX \uAC1C\uD1B5. \uAC1C\uD1B5 \uC804 baseline\uC774 \uD3C9\uD3C9\uD588\uACE0 \uAC1C\uD1B5 \uC2DC\uC810\uACFC \uAE09\uC99D \uC2DC\uC810\uC774 \uC815\uD655\uD788 \uC77C\uCE58 \u2192 \uAC15\uD55C \uADC0\uC778 \uAC00\uB2A5\n- **\uC131\uACA9**: \uAD6C\uC870\uC801 \uBD80\uC0C1(\uAD50\uD1B5 \uC778\uD504\uB77C). \uB418\uB3CC\uC544\uAC00\uC9C0 \uC54A\uB294\uB2E4\n\n### \uC0AC\uB840 2 \u2014 \uC601\uC6D4: \uC774\uBCA4\uD2B8\uC131 \uBD80\uC0C1 (\uB3D9\uC778\uC744 \uC798\uBABB \uC9DA\uAE30 \uC26C\uC6C0)\n\n- \uCCAB \uAC00\uC124: \uC9C0\uC5ED \uCD95\uC81C(\uB2E8\uC885\uBB38\uD654\uC81C)\uAC00 \uB3D9\uC778 \u2192 **\uD2C0\uB9BC**. \uD3C9\uB144 \uAC19\uC740 \uB2EC\uC5D0\uB3C4 \uCD95\uC81C\uAC00 \uC788\uC5C8\uC9C0\uB9CC \uAC80\uC0C9\uC740 \uC548 \uC6C0\uC9C1\uC600\uB2E4\n- \uC2E4\uC81C \uB3D9\uC778: \uCD2C\uC601\uC9C0\uB85C \uB098\uC628 \uC601\uD654 \uAC1C\uBD09\n- \uD45C\uBCF8 \uB178\uC774\uC988: \uB2E8\uC77C \uD1A0\uC694\uC77C \uD45C\uBCF8 **+57%** \u2192 \uACF5\uC2DD \uC5F0\uC778\uC6D0 \uC9D1\uACC4\uB85C \uAD50\uCCB4\uD558\uB2C8 **+13%**\n- **\uBC30\uC6B4 \uAC83**: \uC0C1\uC2DC \uC774\uBCA4\uD2B8\uB97C \uB3D9\uC778\uC73C\uB85C \uC4F0\uC9C0 \uB9D0 \uAC83(T4), \uB2E8\uC77C \uD45C\uBCF8\uC744 \uACF5\uC2DD \uC9D1\uACC4\uB85C \uAD50\uCCB4\uD560 \uAC83(\uACF5\uD1B5 \uD568\uC815 3)\n- **\uC131\uACA9**: \uC774\uBCA4\uD2B8\uC131 \uBD80\uC0C1. \uAC1C\uBD09 \uD6C4 \uAC10\uC1E0 \uC608\uC0C1 \u2192 \uC561\uC158 \uCE74\uB4DC\uC5D0 "\uC9C0\uC18D\uC131 \uBBF8\uD655\uC778"\uC744 \uD55C\uACC4\uB85C \uBA85\uC2DC\n\n### \uC0AC\uB840 3 \u2014 \uB530\uB989\uC774: \uB0A0\uC528 \uBBFC\uAC10 \uC120\uD0DD\uC7AC\n\n- \uBE44 \uC624\uB294 \uB0A0 \uC774\uC6A9\uC774 \uB208\uC5D0 \uB744\uAC8C \uAC10\uC18C \u2014 \uD1B5\uADFC \uD544\uC218\uC7AC\uAC00 \uC544\uB2C8\uB77C **\uC120\uD0DD\uC7AC**\uB85C \uC18C\uBE44\uB41C\uB2E4\n- \uAC15\uC218\uB7C9 \uB370\uC774\uD130\uAC00 \uC5C6\uC73C\uBA74 \uC694\uC77C\xB7\uACC4\uC808 \uD6A8\uACFC\uC640 \uAD6C\uBD84\uC774 \uC548 \uB41C\uB2E4 \u2192 \uC678\uBD80 \uBCC0\uC218(\uB3D9\uC778)\uB97C \uD655\uBCF4\uD558\uC9C0 \uC54A\uC73C\uBA74 \uC778\uACFC \uC8FC\uC7A5 \uBD88\uAC00\n- **\uBC30\uC6B4 \uAC83**: \uB3D9\uC778 \uB370\uC774\uD130\uAC00 \uC5C6\uC73C\uBA74 \uACB0\uB860\uC744 "\uB3D9\uC2DC \uBC1C\uC0DD"\uAE4C\uC9C0\uB9CC \uC4F4\uB2E4\n\n---\n\n## \uD2B8\uB80C\uB4DC \uBD84\uC11D \uB9AC\uD3EC\uD2B8\uC5D0 \uBC18\uB4DC\uC2DC \uC801\uB294 \uD55C\uACC4\n\n1. **\uAD6C\uC870\uC801 \uBD80\uC0C1\uC778\uAC00 \uC774\uBCA4\uD2B8\uC131 \uBD80\uC0C1\uC778\uAC00** \u2014 \uC9C0\uC18D\uC131 \uD310\uB2E8\uC774 \uC561\uC158\uC744 \uBC14\uAFBC\uB2E4\n2. **\uAD00\uC2EC \uC9C0\uD45C\uC640 \uC2E4\uC81C \uC9C0\uD45C\uC758 \uC2DC\uCC28** \u2014 \uAC80\uC0C9\uC740 \uC55E\uC11C\uACE0 \uBC29\uBB38\uC740 \uB2A6\uB2E4\n3. **\uC9D1\uACC4 \uB2E8\uC704** \u2014 \uC5B4\uB5A4 \uC774\uB984\uC73C\uB85C \uC14C\uB294\uC9C0(\uD589\uC815\uBA85/\uBE0C\uB79C\uB4DC\uBA85) \uBA85\uC2DC\n4. **\uAE30\uC900 \uAE30\uAC04** \u2014 \uC5B4\uB290 \uC5F0\uB3C4\uB97C 100\uC73C\uB85C \uC7A1\uC558\uB294\uC9C0\n'
  },
  {
    "skill": "4-report",
    "file": "SKILL.md",
    "mimeType": "text/markdown",
    "uri": "datapopcorn://skills/4-report/SKILL.md",
    "text": '---\nname: 4-report\ndescription: \uBD84\uC11D 4\uB2E8\uACC4\uC758 \u2463 \uC815\uB9AC. \uBD84\uC11D \uACB0\uACFC\uB97C \uD55C \uC7A5 HTML \uB9AC\uD3EC\uD2B8\uB85C \uB0B4\uBCF4\uB0BC \uB54C \uC0AC\uC6A9\uD55C\uB2E4. "\uB9AC\uD3EC\uD2B8 \uB9CC\uB4E4\uC5B4\uC918", "report.html", "\uBD84\uC11D \uACB0\uACFC \uD55C \uD398\uC774\uC9C0\uB85C \uC815\uB9AC\uD574\uC918", "HTML \uB9AC\uD3EC\uD2B8\uB85C \uCD9C\uB825", "\uC758\uC0AC\uACB0\uC815 \uB9AC\uD3EC\uD2B8", "\uB9E4\uAC70\uC9C4 \uD1A4 \uB9AC\uD3EC\uD2B8", "popcorn-report \uC2A4\uD0C0\uC77C\uB85C", \uCE74\uD1A1\xB7\uBA54\uC77C\uB85C \uBCF4\uB0BC \uB2E8\uC77C \uD30C\uC77C \uB9AC\uD3EC\uD2B8\uAC00 \uD544\uC694\uD55C \uC0C1\uD669. \uB370\uC774\uD130\uD31D\uCF58 \uD45C\uC900 \uB9AC\uD3EC\uD2B8 \uB514\uC790\uC778(popcorn-report).\n---\n\n# \u2463 \uC815\uB9AC \u2014 Popcorn Report Design System\n\n\uBD84\uC11D 4\uB2E8\uACC4\uC758 \uB9C8\uC9C0\uB9C9. \uACB0\uACFC\uB97C **\uD55C \uD398\uC774\uC9C0 \uC815\uC801 HTML**\uB85C \uB9CC\uB4E0\uB2E4. \uC758\uC0AC\uACB0\uC815\uC790\uC6A9 \uC694\uC57D, \uC815\uAE30 \uBD84\uC11D \uBCF4\uACE0, \uD2B8\uB80C\uB4DC \uC778\uC0AC\uC774\uD2B8\uC5D0 \uC4F4\uB2E4.\n\n**\uC0B0\uCD9C\uBB3C**: `findings.md` + `report_YYYYMMDD.html`\n**\uC55E \uB2E8\uACC4**: `datapopcorn-analysis:3-suspect` (EDA\xB7\uD568\uC815 \uD310\uC815)\n\n## \uB9AC\uD3EC\uD2B8 \uC791\uC131 \uC804 \u2014 \uD568\uC815 \uD1B5\uACFC \uD655\uC778 (\uD544\uC218)\n\n1. `traps_check.md`\uC5D0\uC11C **\uAC78\uB9BC** \uD310\uC815 \uD56D\uBAA9\uC744 \uCC3E\uB294\uB2E4.\n2. \uAC78\uB9B0 \uD56D\uBAA9\uC740 **\uD55C\uACC4\xB7\uC7AC\uD604 \uCE74\uB4DC\uC5D0 \uADF8\uB300\uB85C \uC62E\uAE34\uB2E4.**\n3. **\uAC80\uC99D \uC548 \uB41C \uC218\uCE58\uB294 \uD5E4\uB4DC\uB77C\uC778\xB7KPI\uC5D0 \uC4F0\uC9C0 \uC54A\uB294\uB2E4.**\n4. \uD5E4\uB4DC\uB77C\uC778\uC774 `hypothesis.md`\uC758 \uAC00\uC124\uC5D0 \uB2F5\uD558\uB294\uC9C0 \uD655\uC778\uD55C\uB2E4. \uAC00\uC124\uACFC \uBB34\uAD00\uD55C \uBC1C\uACAC\uC740 \uC139\uC158\uC73C\uB85C \uB0B4\uB9AC\uACE0 \uD5E4\uB4DC\uB77C\uC778\uC740 \uAC00\uC124\uC5D0 \uB2F5\uD55C\uB2E4.\n5. `traps_check.md`\uAC00 \uC5C6\uC73C\uBA74 \u2192 `datapopcorn-analysis:3-suspect`\uB97C \uBA3C\uC800 \uD638\uCD9C\uD55C\uB2E4. **\uAE30\uB85D \uC5C6\uC774 \uB9AC\uD3EC\uD2B8\uB97C \uB9CC\uB4E4\uC9C0 \uC54A\uB294\uB2E4.**\n\n---\n\n## \uCD9C\uB825 \uD615\uD0DC\n\n- **\uB2E8\uC77C HTML \uD30C\uC77C** \u2014 \uCC28\uD2B8\uB294 \uC774\uBBF8\uC9C0\uB85C \uC784\uBCA0\uB4DC, \uC678\uBD80 \uC758\uC874\uC131\uC740 \uC6F9\uD3F0\uD2B8 \uD558\uB098\uBFD0\n- \uC778\uC1C4 \uAC00\uB2A5 (Cmd+P \u2192 PDF)\n- \uBAA8\uBC14\uC77C \uBC18\uC751\uD615 (900px / 640px breakpoint)\n- \uD30C\uC77C\uBA85: `report_YYYYMMDD.html`. \uCE74\uD1A1\xB7\uBA54\uC77C \uC804\uC1A1\uC6A9 \uB2E8\uC77C \uD30C\uC77C\uC740 `report_YYYYMMDD_\uACF5\uC720\uC6A9.html`\n\n---\n\n## \uB9CC\uB4DC\uB294 \uC21C\uC11C\n\n1. `assets/template.html`\uC744 \uBCF5\uC0AC\uD55C\uB2E4. **\uC644\uC131\uB41C \uC608\uC2DC\uAC00 \uB4E4\uC5B4\uC788\uB2E4** \u2014 \uAD6C\uC870\uB97C \uC0C8\uB85C \uC4F0\uC9C0 \uC54A\uB294\uB2E4.\n2. \uC544\uB798 [\uCC44\uC6B8 \uC2AC\uB86F](#\uCC44\uC6B8-\uC2AC\uB86F) \uD45C\uB300\uB85C \uC608\uC2DC \uAC12\uC744 \uC2E4\uC81C \uAC12\uC73C\uB85C \uAD50\uCCB4\uD55C\uB2E4.\n3. \uBC18\uBCF5 \uBE14\uB85D(KPI 4\uAC1C, \uC139\uC158 N\uAC1C, \uB9AC\uC2A4\uD2B8 \uD56D\uBAA9)\uC740 **HTML \uBE14\uB85D\uC744 \uC2E4\uC81C \uAC1C\uC218\uB9CC\uD07C \uBCF5\uC81C**\uD574\uC11C \uCC44\uC6B4\uB2E4.\n4. \uCC28\uD2B8 PNG\uB97C \uAC19\uC740 \uD3F4\uB354\uC5D0 \uB450\uACE0 `<img src="...">` \uACBD\uB85C\uB97C \uB9DE\uCD98\uB2E4.\n5. \uB2E8\uC77C \uD30C\uC77C\uC774 \uD544\uC694\uD558\uBA74 `scripts/inline_assets.py`\uB85C \uC774\uBBF8\uC9C0\uB97C \uC778\uB77C\uC778\uD55C\uB2E4.\n\n```bash\npython scripts/inline_assets.py report_20260811.html report_20260811_\uACF5\uC720\uC6A9.html\n```\n\n### \uCC44\uC6B8 \uC2AC\uB86F\n\n| \uC2AC\uB86F | \uB0B4\uC6A9 | \uADDC\uCE59 |\n|---|---|---|\n| `TOPIC_LABEL` | eyebrow \uB77C\uBCA8 | \uC601\uBB38 \uB300\uBB38\uC790, \uC608: `SEOUL AIR QUALITY 2024` |\n| `HEADLINE` | \uBA54\uC778 \uD5E4\uB4DC\uB77C\uC778 | **\uACB0\uB860 \uC9C1\uC124\uD615** \uB610\uB294 \uC758\uBB38\uD615. "\u25CB\u25CB \uBD84\uC11D" \uAE08\uC9C0 |\n| `LEAD_PARAGRAPH` | \uB9AC\uB4DC \uBB38\uB2E8 | 2~3\uBB38\uC7A5. \uBB34\uC5C7\uC744 \uBD24\uACE0 \uBB34\uC5C7\uC774 \uB098\uC654\uB098 |\n| `HERO_INSIGHT` | \uD788\uC5B4\uB85C \uC778\uC0AC\uC774\uD2B8 \uBC15\uC2A4 | \uD575\uC2EC \uC218\uCE58 1\uAC1C + \uD55C \uBB38\uC7A5 |\n| Snapshot 3~5\uAC1C | \uB77C\uBCA8 + \uAC12 | \uAE30\uAC04\xB7\uB370\uC774\uD130 \uC18C\uC2A4\xB7\uD45C\uBCF8 \uD06C\uAE30\xB7\uC870\uD68C\uC77C |\n| KPI 4\uAC1C | label / value / note | **\uC815\uD655\uD788 4\uAC1C.** value\uB294 \uC22B\uC790, note\uB294 \uBE44\uAD50 \uAE30\uC900 |\n| \uC139\uC158 2\uAC1C \uC774\uC0C1 | \uB77C\uBCA8 / \uC81C\uBAA9 / \uBD80\uC81C / \uCC28\uD2B8 / \uC778\uC0AC\uC774\uD2B8 | \uC139\uC158\uB2F9 \uC778\uC0AC\uC774\uD2B8 **\uCD5C\uB300 1\uAC1C** |\n| \uADFC\uAC70 | \uC218\uCE58\xB7\uCD9C\uCC98 \uB9AC\uC2A4\uD2B8 | \uB370\uC774\uD130\uAC00 \uC9C1\uC811 \uAC00\uB9AC\uD0A4\uB294 \uAC83\uB9CC |\n| \uC561\uC158 | \uCCB4\uD06C\uBC15\uC2A4 \uB9AC\uC2A4\uD2B8 | \u2705 = \uB370\uC774\uD130 \uADFC\uAC70 \uC788\uC74C, \u26A0\uFE0F = \uC77C\uBC18 \uAD8C\uACE0(\uAC80\uC99D \uD544\uC694) |\n| \uD55C\uACC4\xB7\uC7AC\uD604 | \uAC78\uB9B0 \uD568\uC815 + \uC7AC\uD604 \uBC29\uBC95 | \u{1F501} \uB85C \uC7AC\uD604 \uB808\uC2DC\uD53C \uD45C\uC2DC |\n\n**\uCD9C\uB825 HTML\uC5D0 `{{`\uB098 `{{#each}}` \uAC19\uC740 \uD15C\uD50C\uB9BF \uBB38\uBC95\uC774 \uB0A8\uC544 \uC788\uC73C\uBA74 \uC2E4\uD328\uB2E4.** \uBC18\uBCF5 \uBE14\uB85D\uC740 \uBCF5\uC81C\uD574\uC11C \uAC12\uC744 \uCC44\uC6B4\uB2E4.\n\n---\n\n## \uB514\uC790\uC778 \uC2DC\uC2A4\uD15C (CSS \uBCC0\uC218 \u2014 \uADF8\uB300\uB85C \uC0AC\uC6A9)\n\n```css\n:root {\n  --bg: #f7f6f1;          /* \uBCA0\uC774\uC9C0 \uBC30\uACBD */\n  --card: #ffffff;        /* \uCE74\uB4DC \uD770\uC0C9 */\n  --text: #1a1a1a;        /* \uBCF8\uBB38 \uB2E4\uD06C */\n  --muted: #6b6b6b;       /* \uBCF4\uC870 \uD14D\uC2A4\uD2B8 */\n  --accent: #e53935;      /* \uAC15\uC870 \uBE68\uAC15 */\n  --teal: #2e7d7a;        /* \uBCF4\uC870 \uCCAD\uB85D */\n  --line: #d7d1c7;        /* \uAD6C\uBD84\uC120 */\n  --shadow: 0 24px 80px rgba(0,0,0,0.08);\n}\n```\n\n### 6:3:1 \uCEEC\uB7EC \uBE44\uC728\n- **\uC911\uC131\uC0C9 60%**: \uBCA0\uC774\uC9C0 \uBC30\uACBD + \uD654\uC774\uD2B8 \uCE74\uB4DC + \uD68C\uC0C9 \uD14D\uC2A4\uD2B8\n- **\uBA54\uC778 30%**: \uAC80\uC815 \uBCF8\uBB38 + \uAC80\uC815 \uC778\uC0AC\uC774\uD2B8 \uBC15\uC2A4\n- **\uD3EC\uC778\uD2B8 10%**: \uBE68\uAC15 \uAC15\uC870(`#e53935`), \uCCAD\uB85D \uBCF4\uC870(`#2e7d7a`)\n\n### \uD3F0\uD2B8 \u2014 Pretendard (\u26A0\uFE0F Google Fonts\uC5D0 \uC5C6\uB2E4)\n\nPretendard\uB294 Google Fonts\uC5D0\uC11C \uC81C\uACF5\uD558\uC9C0 \uC54A\uB294\uB2E4. **jsDelivr CDN**\uC744 \uC4F4\uB2E4.\n\n```html\n<link rel="stylesheet"\n      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">\n```\n```css\nfont-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,\n             system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;\n```\n\n- \uBA54\uC778 \uD5E4\uB4DC\uB77C\uC778: `clamp(34px, 5vw, 62px)` + `font-weight: 800` + `letter-spacing: -0.04em`\n- \uC139\uC158 \uB77C\uBCA8(eyebrow): 12~13px + `letter-spacing: 0.18em` + `text-transform: uppercase`\n- \uC624\uD504\uB77C\uC778\uC5D0\uC11C \uBD10\uC57C \uD558\uBA74 \uD3F0\uD2B8\uB97C base64\uB85C \uC784\uBCA0\uB4DC\uD558\uAC70\uB098 \uC2DC\uC2A4\uD15C \uD3F0\uD2B8 fallback\uC744 \uBC1B\uC544\uB4E4\uC778\uB2E4\n\n### \uB77C\uC6B4\uB4DC / \uADF8\uB9BC\uC790 / \uBC30\uACBD\n- \uCE74\uB4DC \uB77C\uC6B4\uB4DC **28px**, \uADF8\uB9BC\uC790 `0 24px 80px rgba(0,0,0,0.08)`\n- \uBC30\uACBD (\uC2DC\uADF8\uB2C8\uCC98 \uD328\uD134):\n```css\nbackground:\n  radial-gradient(circle at top left, rgba(229,57,53,0.08), transparent 22%),\n  linear-gradient(180deg, #faf8f3 0%, var(--bg) 100%);\n```\n\n---\n\n## \uB808\uC774\uC544\uC6C3 \uACE8\uACA9 (\uD544\uC218 5\uAC1C \uC139\uC158)\n\n```\n\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n\u2502 [Hero] eyebrow + \uD070 \uD5E4\uB4DC\uB77C\uC778 + \uB9AC\uB4DC + \uC778\uC0AC\uC774\uD2B8   \u2502 + Snapshot \uC0AC\uC774\uB4DC\n\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 [KPIs] 4\uAC1C \uCE74\uB4DC grid (label / value / note)      \u2502\n\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 [Section 01 \xB7 TREND OVERVIEW]                    \u2502\n\u2502   section-header + \uCC28\uD2B8 + \uC778\uC0AC\uC774\uD2B8 1\uAC1C           \u2502\n\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 [Section 02 \xB7 BREAKDOWN]                         \u2502\n\u2502   section-header + \uCC28\uD2B8 + \uC778\uC0AC\uC774\uD2B8 1\uAC1C           \u2502\n\u251C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2524\n\u2502 [Action Cards] 03 \xB7 ACTIONABLE INSIGHT           \u2502\n\u2502   \uADFC\uAC70 / \uC561\uC158 / \uD55C\uACC4\xB7\uC7AC\uD604                        \u2502\n\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n```\n\n### \uC561\uC158 \uCE74\uB4DC 3\uBD84\uD560 (\uC774\uB984 \uACE0\uC815)\n\n| \uCE74\uB4DC | \uC81C\uBAA9 | \uB4E4\uC5B4\uAC08 \uAC83 |\n|---|---|---|\n| 1 | **\uADFC\uAC70** | \uB370\uC774\uD130\uAC00 \uC9C1\uC811 \uAC00\uB9AC\uD0A4\uB294 \uC218\uCE58 + \uCD9C\uCC98 |\n| 2 | **\uC561\uC158** | \u2610 \uCCB4\uD06C\uBC15\uC2A4. `\u2705` \uB370\uC774\uD130 \uADFC\uAC70 \uC788\uC74C / `\u26A0\uFE0F` \uC77C\uBC18 \uAD8C\uACE0(\uAC80\uC99D \uD544\uC694) \uAD6C\uBD84 \uD45C\uC2DC. "\uB204\uAC00 / \uC5B8\uC81C / \uBB34\uC5C7\uC744" |\n| 3 | **\uD55C\uACC4\xB7\uC7AC\uD604** | \uAC78\uB9B0 \uD568\uC815 + \uB2E4\uC74C \uD574\uC11D \uBC29\uD5A5 + `\u{1F501}` \uC7AC\uD604 \uB808\uC2DC\uD53C(\uC5B4\uB5A4 \uC2A4\uD06C\uB9BD\uD2B8\uB97C \uC5B4\uB5A4 \uC778\uC790\uB85C) |\n\n\uCE74\uB4DC \uC774\uB984\uC744 \uBC14\uAFB8\uC9C0 \uC54A\uB294\uB2E4. `3-suspect`\uC758 \uD310\uC815 \uACB0\uACFC\uAC00 3\uBC88 \uCE74\uB4DC\uB85C \uADF8\uB300\uB85C \uB4E4\uC5B4\uC628\uB2E4.\n\n### \uC139\uC158 \uB77C\uBCA8 \uC791\uBA85\n- **\uC601\uBB38 + \uC22B\uC790**: `01 \xB7 TREND OVERVIEW`, `02 \xB7 CATEGORY BREAKDOWN`, `03 \xB7 ACTIONABLE INSIGHT`\n- \uC810\uC740 `\xB7` (middle dot, U+00B7). \uD558\uC774\uD508 X\n- \uBAA8\uB450 \uB300\uBB38\uC790, letter-spacing \uB113\uAC8C\n\n### \uD5E4\uB4DC\uB77C\uC778 \uD1A4\n- **\uACB0\uB860 \uC9C1\uC124\uD615**: "\uC11C\uC6B8 25\uAC1C \uAD6C, PM2.5 \uACA9\uCC28\uB294 14.7%"\n- \uC758\uBB38\uD615\uB3C4 OK \u2014 \uB2E8, \uBCF8\uBB38\uC5D0\uC11C \uB2F5\uC744 \uC904 \uAC83: "\uBE44 \uC624\uB294 \uB0A0 \uB530\uB989\uC774\uB294 \uC815\uB9D0 \uC548 \uD0C0\uB098?"\n- \u274C "\u25CB\u25CB \uBD84\uC11D \uACB0\uACFC", "\u25CB\u25CB \uB370\uC774\uD130 \uB9AC\uD3EC\uD2B8"\n- \u274C **\uB204\uAD6C\uB098 \uC544\uB294 \uC0AC\uC2E4\uC740 \uD5E4\uB4DC\uB77C\uC778\uC774 \uC544\uB2C8\uB2E4.** "\uC5EC\uB984\uC5D0 \uC544\uC774\uC2A4\uCEE4\uD53C\uAC00 \uB354 \uD314\uB9B0\uB2E4" \uAC19\uC740 \uC790\uBA85\uD55C \uBB38\uC7A5 \uAE08\uC9C0\n\n### \uC778\uC0AC\uC774\uD2B8 \uBC15\uC2A4\n```html\n<div class="insight">\uC885\uB85C\uAD6C\uB294 \uD3C9\uADE0\uBCF4\uB2E4 8% \uB192\uB2E4.</div>\n```\n- \uAC80\uC815 \uBC30\uACBD + \uD770 \uAE00\uC528, **\uC139\uC158\uB2F9 \uCD5C\uB300 1\uAC1C** (\uB0A8\uC6A9\uD558\uBA74 \uAC15\uC870\uAC00 \uC8FD\uB294\uB2E4)\n- \uD575\uC2EC \uC218\uCE58 1\uAC1C + \uD55C \uBB38\uC7A5 \uACB0\uB860\n\n---\n\n## \uCC28\uD2B8 \uD1B5\uD569\n\n- **PNG \uAD8C\uC7A5** \u2014 `<img>`\uB85C \uC784\uBCA0\uB4DC, \uB2E8\uC77C \uD30C\uC77C portable\n- \uD574\uC0C1\uB3C4 1600px \uC774\uC0C1 (Retina), \uBC30\uACBD `#fff`\n\n```python\nimport matplotlib.pyplot as plt\nimport seaborn as sns\nfrom matplotlib import font_manager, rcParams\n\n# 1. \uD3F0\uD2B8 \u2014 set_theme() \uBA3C\uC800, \uADF8 \uB2E4\uC74C \uD3F0\uD2B8 \uC7AC\uC9C0\uC815\nsns.set_theme(style="white", context="notebook")\ninstalled = {f.name for f in font_manager.fontManager.ttflist}\nfor name in ("Pretendard", "Pretendard Variable", "AppleGothic", "Malgun Gothic", "NanumGothic"):\n    if name in installed:\n        rcParams["font.family"] = name\n        break\nrcParams["axes.unicode_minus"] = False   # \uC74C\uC218 \uAE30\uD638 \uAE68\uC9D0 \uBC29\uC9C0\n\n# 2. \uCEEC\uB7EC \uD314\uB808\uD2B8 \u2014 CSS \uBCC0\uC218\uC640 \uB9E4\uCE6D\nCOLORS = {"accent": "#e53935", "teal": "#2e7d7a", "muted": "#6b6b6b", "line": "#d7d1c7"}\n\n# 3. \uC800\uC7A5\nfig.savefig("chart_01.png", dpi=200, bbox_inches="tight",\n            facecolor="white", edgecolor="none")\n```\n\n\uB85C\uCEEC\uC5D0 \uD55C\uAE00 \uD3F0\uD2B8\uAC00 \uD558\uB098\uB3C4 \uC5C6\uC73C\uBA74 \uB77C\uBCA8\uC774 \u25A1\u25A1\u25A1\uB85C \uAE68\uC9C4\uB2E4. \uC704 \uB8E8\uD504\uAC00 \uC544\uBB34\uAC83\uB3C4 \uBABB \uCC3E\uC73C\uBA74 \uC0AC\uC6A9\uC790\uC5D0\uAC8C \uC54C\uB9AC\uACE0 \uC601\uBB38 \uB77C\uBCA8\uB85C \uB300\uCCB4\uD55C\uB2E4.\n\n### \uCC28\uD2B8 \uC885\uB958\xB7\uB77C\uBCA8\n- \uC2DC\uACC4\uC5F4 \u2192 \uB77C\uC778 (`COLORS["accent"]`) \xB7 \uCE74\uD14C\uACE0\uB9AC \uBE44\uAD50 \u2192 \uC218\uD3C9 \uB9C9\uB300 \xB7 \uBD84\uD3EC \u2192 \uBC15\uC2A4\uD50C\uB86F \xB7 \uAD00\uACC4 \u2192 \uC0B0\uC810\uB3C4 + \uD68C\uADC0\uC120\n- **\uC218\uCE58\uB97C \uCC28\uD2B8\uC5D0 \uC9C1\uC811 \uB178\uCD9C**, \uACA9\uC790\uC120\xB7\uCD95 \uB77C\uBCA8 \uCD5C\uC18C\uD654\n- \uB2E8\uC704\uB294 \uCD95 \uC81C\uBAA9\uC5D0 \uD3EC\uD568 (`(\u338D/\u33A5)`), \uBC94\uB840\uB294 \uC678\uBD80 \uB610\uB294 \uC0DD\uB7B5\n\n---\n\n## \uAC15\uC81C \uADDC\uCE59\n\n1. **CSS \uBCC0\uC218 \uADF8\uB300\uB85C** \u2014 \uCEEC\uB7EC\uB97C \uC784\uC758\uB85C \uBC14\uAFB8\uC9C0 \uC54A\uB294\uB2E4\n2. **\uD15C\uD50C\uB9BF \uBB38\uBC95 \uC794\uC874 \uAE08\uC9C0** \u2014 \uCD9C\uB825 HTML\uC5D0 `{{`\uAC00 \uB0A8\uC73C\uBA74 \uC2E4\uD328. \uBC18\uBCF5 \uBE14\uB85D\uC740 \uBCF5\uC81C\uD574 \uCC44\uC6B4\uB2E4\n3. **\uC139\uC158\uB2F9 \uC778\uC0AC\uC774\uD2B8 \uBC15\uC2A4 1\uAC1C**\n4. **KPI\uB294 \uC815\uD655\uD788 4\uAC1C**\n5. **\uC561\uC158 \uCE74\uB4DC\uB294 \uD56D\uC0C1 3\uAC1C, \uC774\uB984 \uACE0\uC815** \u2014 \uADFC\uAC70 / \uC561\uC158 / \uD55C\uACC4\xB7\uC7AC\uD604\n6. **\uD5E4\uB4DC\uB77C\uC778\uC740 \uACB0\uB860\xB7\uC758\uBB38\uD615** \u2014 \uB2E8\uC21C \uC81C\uBAA9\xB7\uC790\uBA85\uD55C \uBB38\uC7A5 \uAE08\uC9C0\n7. **\uC139\uC158 \uB77C\uBCA8 `01 \xB7` \uBC88\uD638 + middle dot**\n8. **\uAC80\uC99D \uC548 \uB41C \uC218\uCE58\uB294 \uD5E4\uB4DC\uB77C\uC778\xB7KPI\uC5D0 \uAE08\uC9C0** \u2014 \uD55C\uACC4 \uCE74\uB4DC\uB85C \uBCF4\uB0B8\uB2E4\n9. **Pretendard\uB294 jsDelivr CDN** \u2014 Google Fonts\uC5D0\uC11C import \uAE08\uC9C0(\uC874\uC7AC\uD558\uC9C0 \uC54A\uC74C)\n\n---\n\n## \uD754\uD55C \uC2E4\uD328\n\n| \uC99D\uC0C1 | \uC6D0\uC778 | \uACE0\uCE58\uB294 \uBC95 |\n|---|---|---|\n| \uD3F0\uD2B8\uAC00 \uC2DC\uC2A4\uD15C \uAE30\uBCF8\uC73C\uB85C \uB098\uC634 | Google Fonts\uC5D0\uC11C Pretendard import | jsDelivr CDN \uB9C1\uD06C\uB85C \uAD50\uCCB4 |\n| HTML\uC5D0 `{{#each ...}}` \uB178\uCD9C | \uD15C\uD50C\uB9BF\uC744 \uADF8\uB300\uB85C \uC800\uC7A5 | \uBE14\uB85D\uC744 \uC2E4\uC81C \uAC1C\uC218\uB9CC\uD07C \uBCF5\uC81C\uD574 \uAC12 \uCC44\uC6C0 |\n| \uCC28\uD2B8 \uD55C\uAE00\uC774 \u25A1\u25A1\u25A1 | matplotlib \uD3F0\uD2B8 \uBBF8\uC124\uC815 | `rcParams["font.family"]` \uAC10\uC9C0 \uB8E8\uD504 |\n| \uCE74\uD1A1\uC5D0\uC11C \uCC28\uD2B8 \uC548 \uBCF4\uC784 | \uC0C1\uB300\uACBD\uB85C PNG \uCC38\uC870 | `scripts/inline_assets.py`\uB85C \uC778\uB77C\uC778 |\n| \uC778\uC0AC\uC774\uD2B8 \uBC15\uC2A4 \uB3C4\uBC30 | \uC139\uC158\uB2F9 \uC5EC\uB7EC \uAC1C | \uC139\uC158\uB2F9 1\uAC1C\uB85C \uC904\uC784 |\n\n---\n\n## \uCC38\uACE0 \uD30C\uC77C\n\n- `assets/template.html` \u2014 \uAC12\uC774 \uCC44\uC6CC\uC9C4 \uC644\uC131 \uC608\uC2DC. \uBCF5\uC0AC\uD574\uC11C \uAC12\uB9CC \uAD50\uCCB4\n- `scripts/inline_assets.py` \u2014 \uB85C\uCEEC PNG\xB7JS\uB97C \uC778\uB77C\uC778\uD574 \uB2E8\uC77C \uD30C\uC77C\uB85C \uBCC0\uD658\n\n## \uBA54\uD0C0\n\n- **\uBC84\uC804**: v3 (2026-08-11) \u2014 `popcorn-report` \u2192 `4-report`\uB85C \uAC1C\uBA85(4\uB2E8\uACC4 = \uC2A4\uD0AC 1:1 \uC815\uB82C). v2\uC5D0\uC11C Pretendard CDN \uC218\uC815(Google Fonts\uC5D0 \uC5C6\uC74C), Handlebars \uD15C\uD50C\uB9BF\uC744 \uC644\uC131 \uC608\uC2DC HTML\uB85C \uAD50\uCCB4, \uC561\uC158 \uCE74\uB4DC 3\uBD84\uD560 \uD1B5\uC77C\n- **\uC5F0\uAD00 \uC2A4\uD0AC**: \uC55E \uB2E8\uACC4 `3-suspect` \xB7 \uC804\uCCB4 \uC624\uCF00\uC2A4\uD2B8\uB808\uC774\uD130 `data-analysis-pipeline`\n- **\uC720\uC9C0\uBCF4\uC218**: \uB370\uC774\uD130\uD31D\uCF58 \uD45C\uC900 \uB9AC\uD3EC\uD2B8 \uD1A4. \uCEEC\uB7EC\xB7\uB808\uC774\uC544\uC6C3 \uBCC0\uACBD \uC2DC \uC0AC\uB0B4 \uD569\uC758 \uD544\uC694\n'
  },
  {
    "skill": "4-report",
    "file": "assets/template.html",
    "mimeType": "text/html",
    "uri": "datapopcorn://skills/4-report/assets/template.html",
    "text": '<!doctype html>\n<html lang="ko">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>\uC11C\uC6B8 25\uAC1C \uAD6C, PM2.5 \uACA9\uCC28\uB294 14.7%</title>\n\n  <!-- Pretendard: Google Fonts\uC5D0 \uC5C6\uB2E4. jsDelivr CDN\uC744 \uC4F4\uB2E4 -->\n  <link rel="stylesheet"\n        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css">\n  <style>\n    :root {\n      --bg: #f7f6f1;\n      --card: #ffffff;\n      --text: #1a1a1a;\n      --muted: #6b6b6b;\n      --accent: #e53935;\n      --teal: #2e7d7a;\n      --line: #d7d1c7;\n      --shadow: 0 24px 80px rgba(0,0,0,0.08);\n    }\n    * { box-sizing: border-box; }\n    body {\n      margin: 0;\n      font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,\n                   system-ui, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", sans-serif;\n      background:\n        radial-gradient(circle at top left, rgba(229,57,53,0.08), transparent 22%),\n        linear-gradient(180deg, #faf8f3 0%, var(--bg) 100%);\n      color: var(--text);\n    }\n    .page { max-width: 1180px; margin: 0 auto; padding: 48px 24px 72px; }\n    .hero { display: grid; grid-template-columns: 1.2fr .8fr; gap: 28px; align-items: stretch; margin-bottom: 28px; }\n    .hero-main, .hero-side { background: var(--card); border-radius: 28px; box-shadow: var(--shadow); padding: 28px; }\n    .eyebrow { font-size: 12px; letter-spacing: .18em; color: var(--muted); text-transform: uppercase; }\n    h1 { margin: 10px 0 14px; font-size: clamp(34px, 5vw, 62px); line-height: .95; font-weight: 800; letter-spacing: -0.04em; }\n    .hero-copy { font-size: 16px; color: var(--muted); line-height: 1.6; max-width: 60ch; }\n    .insight { margin-top: 20px; background: #121212; color: #fff; border-radius: 18px; padding: 18px 20px; font-size: 18px; font-weight: 700; }\n    .meta-list { display: grid; gap: 14px; margin-top: 14px; }\n    .meta-item { border-top: 1px solid var(--line); padding-top: 14px; }\n    .meta-item strong { display: block; font-size: 12px; letter-spacing: .14em; color: var(--muted); text-transform: uppercase; margin-bottom: 4px; }\n    .meta-item span { font-size: 20px; font-weight: 700; }\n    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }\n    .kpi { background: var(--card); border-radius: 22px; padding: 22px; box-shadow: var(--shadow); }\n    .kpi-label { font-size: 12px; text-transform: uppercase; letter-spacing: .16em; color: var(--muted); }\n    .kpi-value { margin-top: 10px; font-size: clamp(28px, 4vw, 46px); line-height: 1; font-weight: 800; }\n    .kpi-note { margin-top: 10px; color: var(--muted); font-size: 13px; }\n    .section { background: var(--card); border-radius: 28px; box-shadow: var(--shadow); padding: 28px; margin-bottom: 22px; }\n    .section-label { font-size: 13px; letter-spacing: .18em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }\n    .section-header { display: flex; justify-content: space-between; gap: 20px; align-items: end; border-bottom: 1px solid var(--line); padding-bottom: 14px; margin-bottom: 18px; }\n    .section-header h2 { margin: 0; font-size: 28px; letter-spacing: -0.03em; }\n    .section-header p { margin: 0; color: var(--muted); font-size: 14px; max-width: 48ch; }\n    img { width: 100%; border-radius: 18px; border: 1px solid #ece8de; background: #fff; }\n    .action-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-top: 18px; }\n    .action-card { border: 1px solid var(--line); border-radius: 18px; padding: 18px; min-height: 160px; background: linear-gradient(180deg, #fff 0%, #fbfaf7 100%); }\n    .action-card strong { display: block; font-size: 15px; margin-bottom: 12px; }\n    .action-card ul { margin: 0; padding-left: 18px; color: var(--muted); line-height: 1.6; font-size: 14px; }\n    @media (max-width: 900px) {\n      .hero { grid-template-columns: 1fr; }\n      .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }\n      .action-grid { grid-template-columns: 1fr; }\n    }\n    @media (max-width: 640px) {\n      .page { padding: 20px 14px 48px; }\n      .hero-main, .hero-side, .section, .kpi { padding: 20px; border-radius: 20px; }\n      .kpis { grid-template-columns: 1fr; }\n      .section-header { display: block; }\n      .section-header p { margin-top: 8px; }\n    }\n    @media print {\n      body { background: #fff; }\n      .section, .kpi, .hero-main, .hero-side { box-shadow: none; border: 1px solid var(--line); }\n    }\n  </style>\n</head>\n<body>\n  <div class="page">\n\n    <!-- ========== HERO ========== -->\n    <section class="hero">\n      <div class="hero-main">\n        <div class="eyebrow">Seoul Air Quality 2024</div>\n        <h1>\uC11C\uC6B8 25\uAC1C \uAD6C, PM2.5 \uACA9\uCC28\uB294 14.7%</h1>\n        <p class="hero-copy">\n          2024\uB144 \uC11C\uC6B8\uC2DC 25\uAC1C \uC790\uCE58\uAD6C\uC758 \uB300\uAE30\uC9C8 \uCE21\uC815\uC18C \uC77C\uBCC4 \uB370\uC774\uD130 8,930\uAC74\uC744 \uC9D1\uACC4\uD588\uB2E4.\n          \uC5F0\uD3C9\uADE0 PM2.5\uB294 \uAE30\uC900\uCE58 \uC544\uB798\uC600\uC9C0\uB9CC, \uC790\uCE58\uAD6C \uC0AC\uC774 \uACA9\uCC28\uAC00 \uC881\uD600\uC9C0\uC9C0 \uC54A\uC558\uB2E4.\n          \uACA9\uCC28\uB294 \uACC4\uC808\uC774 \uC544\uB2C8\uB77C \uD2B9\uC815 \uAD6C\uC758 \uC0C1\uC2DC \uC218\uC900\uC5D0\uC11C \uC654\uB2E4.\n        </p>\n        <div class="insight">\uAC00\uC7A5 \uB098\uC05C \uAD6C\uC640 \uAC00\uC7A5 \uC88B\uC740 \uAD6C\uC758 \uC5F0\uD3C9\uADE0 \uCC28\uC774\uB294 14.7%\uB2E4.</div>\n      </div>\n\n      <aside class="hero-side">\n        <div class="eyebrow">Snapshot</div>\n        <div class="meta-list">\n          <!-- 3~5\uAC1C. \uAE30\uAC04 \xB7 \uC18C\uC2A4 \xB7 \uD45C\uBCF8 \xB7 \uC870\uD68C\uC77C -->\n          <div class="meta-item"><strong>\uAE30\uAC04</strong><span>2024-01 ~ 2024-12</span></div>\n          <div class="meta-item"><strong>\uB370\uC774\uD130 \uC18C\uC2A4</strong><span>\uC11C\uC6B8 \uC5F4\uB9B0\uB370\uC774\uD130\uAD11\uC7A5</span></div>\n          <div class="meta-item"><strong>\uD45C\uBCF8</strong><span>8,930\uAC74 \xB7 25\uAC1C \uAD6C</span></div>\n          <div class="meta-item"><strong>\uC870\uD68C\uC77C</strong><span>2026-08-11</span></div>\n        </div>\n      </aside>\n    </section>\n\n    <!-- ========== KPIs \u2014 \uC815\uD655\uD788 4\uAC1C ========== -->\n    <section class="kpis">\n      <div class="kpi">\n        <div class="kpi-label">\uC5F0\uD3C9\uADE0 PM2.5</div>\n        <div class="kpi-value">21.3</div>\n        <div class="kpi-note">\u338D/\u33A5 \xB7 \uC804\uB144 22.1 \uB300\uBE44 \u22123.6%</div>\n      </div>\n      <div class="kpi">\n        <div class="kpi-label">\uAC00\uC7A5 \uB098\uC05C \uAD6C</div>\n        <div class="kpi-value">23.8</div>\n        <div class="kpi-note">\uAE08\uCC9C\uAD6C \xB7 \uC2DC \uD3C9\uADE0 +11.7%</div>\n      </div>\n      <div class="kpi">\n        <div class="kpi-label">\uAC00\uC7A5 \uC88B\uC740 \uAD6C</div>\n        <div class="kpi-value">20.7</div>\n        <div class="kpi-note">\uB3C4\uBD09\uAD6C \xB7 \uC2DC \uD3C9\uADE0 \u22122.8%</div>\n      </div>\n      <div class="kpi">\n        <div class="kpi-label">"\uB098\uC068" \uC77C\uC218</div>\n        <div class="kpi-value">37\uC77C</div>\n        <div class="kpi-note">35\u338D/\u33A5 \uCD08\uACFC \xB7 1~3\uC6D4\uC5D0 78% \uC9D1\uC911</div>\n      </div>\n    </section>\n\n    <!-- ========== SECTION 01 \u2014 \uC139\uC158\uC740 \uD544\uC694\uD55C \uB9CC\uD07C \uBCF5\uC81C ========== -->\n    <section class="section">\n      <div class="section-label">01 \xB7 TREND OVERVIEW</div>\n      <div class="section-header">\n        <h2>1~3\uC6D4\uC774 \uC5F0\uAC04 "\uB098\uC068"\uC758 78%\uB97C \uB9CC\uB4E0\uB2E4</h2>\n        <p>\uC6D4\uBCC4 \uD3C9\uADE0\uACFC "\uB098\uC068" \uC77C\uC218\uB97C \uD568\uAED8 \uBCF8 \uACB0\uACFC, \uBB38\uC81C\uB294 \uC5F0\uC911 \uC0C1\uC2DC\uAC00 \uC544\uB2C8\uB77C 1\uBD84\uAE30\uC5D0 \uBAB0\uB824 \uC788\uB2E4.</p>\n      </div>\n      <img src="chart_01_monthly.png" alt="\uC6D4\uBCC4 PM2.5 \uD3C9\uADE0\uACFC \uB098\uC068 \uC77C\uC218 \uCD94\uC774">\n      <div class="insight">3\uC6D4 \uD3C9\uADE0\uC740 8\uC6D4\uC758 2.1\uBC30\uB2E4.</div>\n    </section>\n\n    <!-- ========== SECTION 02 ========== -->\n    <section class="section">\n      <div class="section-label">02 \xB7 CATEGORY BREAKDOWN</div>\n      <div class="section-header">\n        <h2>\uACA9\uCC28\uB294 \uACC4\uC808\uC774 \uC544\uB2C8\uB77C \uD2B9\uC815 \uAD6C\uC758 \uC0C1\uC2DC \uC218\uC900</h2>\n        <p>\uC790\uCE58\uAD6C\uBCC4 \uC5F0\uD3C9\uADE0\uC744 \uC815\uB82C\uD558\uBA74 \uC0C1\uC704\xB7\uD558\uC704 \uAD6C\uAC00 \uACC4\uC808\uACFC \uBB34\uAD00\uD558\uAC8C \uACE0\uC815\uB3FC \uC788\uB2E4.</p>\n      </div>\n      <img src="chart_02_district.png" alt="\uC790\uCE58\uAD6C\uBCC4 \uC5F0\uD3C9\uADE0 PM2.5 \uC218\uD3C9 \uB9C9\uB300">\n      <div class="insight">\uC0C1\uC704 5\uAC1C \uAD6C\uB294 12\uAC1C\uC6D4 \uC911 10\uAC1C\uC6D4\uC5D0\uC11C \uC0C1\uC704\uAD8C\uC744 \uC720\uC9C0\uD588\uB2E4.</div>\n    </section>\n\n    <!-- ========== ACTION CARDS \u2014 \uD56D\uC0C1 3\uAC1C, \uC774\uB984 \uACE0\uC815 ========== -->\n    <section class="section">\n      <div class="section-label">03 \xB7 ACTIONABLE INSIGHT</div>\n      <div class="action-grid">\n\n        <div class="action-card">\n          <strong>\uADFC\uAC70</strong>\n          <ul>\n            <li>\uC5F0\uD3C9\uADE0 \uCD5C\uB300\xB7\uCD5C\uC18C \uACA9\uCC28 14.7% (\uAE08\uCC9C 23.8 / \uB3C4\uBD09 20.7)</li>\n            <li>"\uB098\uC068" 37\uC77C \uC911 29\uC77C\uC774 1~3\uC6D4 (78%)</li>\n            <li>\uC0C1\uC704 5\uAC1C \uAD6C\uAC00 10/12\uAC1C\uC6D4 \uC0C1\uC704\uAD8C \uC720\uC9C0</li>\n            <li>\uCD9C\uCC98: \uC11C\uC6B8 \uC5F4\uB9B0\uB370\uC774\uD130\uAD11\uC7A5 \xB7 8,930\uAC74 \xB7 2026-08-11 \uC870\uD68C</li>\n          </ul>\n        </div>\n\n        <div class="action-card">\n          <strong>\uC561\uC158</strong>\n          <ul>\n            <li>\u2610 \u2705 1~3\uC6D4 \uC9D1\uC911 \uC800\uAC10 \uC870\uCE58\uB97C \uC0C1\uC704 5\uAC1C \uAD6C\uC5D0 \uC6B0\uC120 \uBC30\uCE58 \u2014 \uD658\uACBD\uC815\uCC45\uACFC / 12\uC6D4\uAE4C\uC9C0</li>\n            <li>\u2610 \u2705 \uC0C1\uC704 \uAD6C \uCE21\uC815\uC18C \uC8FC\uBCC0 \uBC30\uCD9C\uC6D0 \uBAA9\uB85D \uC7AC\uD655\uC778 \u2014 \uB300\uAE30\uAD00\uB9AC\uD300 / 2\uC8FC</li>\n            <li>\u2610 \u26A0\uFE0F \uAD50\uD1B5\uB7C9 \uC5F0\uACC4 \uBD84\uC11D \uCD94\uAC00 (\uAC80\uC99D \uD544\uC694: \uAD50\uD1B5 \uB370\uC774\uD130 \uBBF8\uD655\uBCF4)</li>\n          </ul>\n        </div>\n\n        <div class="action-card">\n          <strong>\uD55C\uACC4\xB7\uC7AC\uD604</strong>\n          <ul>\n            <li>\uCE21\uC815\uC18C \uC704\uCE58 \uD3B8\uCC28 \uBCF4\uC815 \uC548 \uB428 \u2014 \uAD6C \uB300\uD45C\uC131 \uC81C\uD55C (\uAC80\uC99D \uD568\uC815 6 \uB2E8\uC704 \uC815\uC758)</li>\n            <li>\uAE30\uC0C1(\uD48D\uD5A5\xB7\uAC15\uC218) \uBCC0\uC218 \uBBF8\uD3EC\uD568 \u2192 \uC778\uACFC \uC8FC\uC7A5 \uBD88\uAC00 (\uACF5\uD1B5 \uD568\uC815 5 \uC0C1\uAD00\u2260\uC778\uACFC)</li>\n            <li>2024 \uB2E8\uC77C \uC5F0\uB3C4. \uCD94\uC138 \uD310\uB2E8\uC740 3\uB144 \uC774\uC0C1 \uD544\uC694 (\uACF5\uD1B5 \uD568\uC815 1 \uAE30\uC900 \uAE30\uAC04)</li>\n            <li>\u{1F501} \uC7AC\uD604: <code>python 4_analyze.py --year 2024 --unit district</code></li>\n          </ul>\n        </div>\n\n      </div>\n    </section>\n\n  </div>\n</body>\n</html>\n'
  },
  {
    "skill": "4-report",
    "file": "scripts/inline_assets.py",
    "mimeType": "text/x-python",
    "uri": "datapopcorn://skills/4-report/scripts/inline_assets.py",
    "text": `#!/usr/bin/env python3
"""\uB85C\uCEEC \uC774\uBBF8\uC9C0\xB7JS\uB97C HTML\uC5D0 \uC778\uB77C\uC778\uD574 \uB2E8\uC77C \uD30C\uC77C \uB9AC\uD3EC\uD2B8\uB85C \uB9CC\uB4E0\uB2E4.

\uCE74\uD1A1\xB7\uBA54\uC77C\uB85C \uB9AC\uD3EC\uD2B8 \uD558\uB098\uB9CC \uBCF4\uB0B4\uB824\uBA74 \uC0C1\uB300\uACBD\uB85C PNG\uAC00 \uAC19\uC774 \uC548 \uAC00\uC11C \uCC28\uD2B8\uAC00 \uAE68\uC9C4\uB2E4.
\uC774 \uC2A4\uD06C\uB9BD\uD2B8\uAC00 <img src="chart.png">\uB97C data: URI\uB85C, <script src="x.js">\uB97C \uC778\uB77C\uC778\uC73C\uB85C \uBC14\uAFBC\uB2E4.
\uC6F9\uD3F0\uD2B8(CDN)\uB294 \uADF8\uB300\uB85C \uB0A8\uAE34\uB2E4 \u2014 \uD3F0\uD2B8\uAE4C\uC9C0 \uB123\uC73C\uB824\uBA74 \uD30C\uC77C\uC774 \uC218 MB \uCEE4\uC9C4\uB2E4.

\uC0AC\uC6A9:
    python inline_assets.py report_20260811.html report_20260811_\uACF5\uC720\uC6A9.html
"""

import base64
import re
import sys
from pathlib import Path

MIME = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
}

SKIP_PREFIXES = ("http://", "https://", "data:", "//")


def inline(src: Path, dst: Path) -> None:
    html = src.read_text(encoding="utf-8")
    base = src.parent
    stats = {"img": 0, "js": 0, "missing": []}

    def replace_img(m: re.Match) -> str:
        url = m.group(2)
        if url.startswith(SKIP_PREFIXES):
            return m.group(0)
        path = base / url
        mime = MIME.get(path.suffix.lower())
        if mime is None or not path.is_file():
            stats["missing"].append(url)
            return m.group(0)
        b64 = base64.b64encode(path.read_bytes()).decode("ascii")
        stats["img"] += 1
        return f'{m.group(1)}data:{mime};base64,{b64}"'

    def replace_script(m: re.Match) -> str:
        url = m.group(1)
        if url.startswith(SKIP_PREFIXES):
            return m.group(0)
        path = base / url
        if not path.is_file():
            stats["missing"].append(url)
            return m.group(0)
        stats["js"] += 1
        return "<script>\\n" + path.read_text(encoding="utf-8") + "\\n<\/script>"

    html = re.sub(r'(<img\\b[^>]*?\\ssrc=")([^"]+)"', replace_img, html)
    html = re.sub(
        r'<script\\b[^>]*?\\ssrc="([^"]+)"[^>]*>\\s*<\/script>', replace_script, html
    )

    dst.write_text(html, encoding="utf-8")

    size_mb = dst.stat().st_size / 1024 / 1024
    print(f"\u2705 {dst}  ({size_mb:.1f} MB)")
    print(f"   \uC774\uBBF8\uC9C0 {stats['img']}\uAC1C \xB7 \uC2A4\uD06C\uB9BD\uD2B8 {stats['js']}\uAC1C \uC778\uB77C\uC778")
    if stats["missing"]:
        print(f"   \u26A0\uFE0F  \uBABB \uCC3E\uC740 \uD30C\uC77C: {', '.join(stats['missing'])}")
    if size_mb > 15:
        print("   \u26A0\uFE0F  15MB \uCD08\uACFC \u2014 \uCE74\uD1A1 \uC804\uC1A1\uC774 \uB9C9\uD790 \uC218 \uC788\uB2E4. PNG dpi\uB97C \uB0AE\uCD94\uAC70\uB098 \uCC28\uD2B8\uB97C \uC904\uC5EC\uB77C.")
    if "{{" in html:
        print("   \u26A0\uFE0F  \uCD9C\uB825\uC5D0 \uD15C\uD50C\uB9BF \uBB38\uBC95 '{{'\uAC00 \uB0A8\uC544 \uC788\uB2E4. \uAC12\uC744 \uCC44\uC6B0\uC9C0 \uC54A\uC740 \uC2AC\uB86F\uC774 \uC788\uB2E4.")


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    if not src.is_file():
        sys.exit(f"\uC785\uB825 \uD30C\uC77C\uC774 \uC5C6\uB2E4: {src}")
    if src.resolve() == dst.resolve():
        sys.exit("\uC785\uB825\uACFC \uCD9C\uB825\uC774 \uAC19\uB2E4. \uC6D0\uBCF8\uC744 \uB36E\uC5B4\uC4F0\uC9C0 \uC54A\uB294\uB2E4.")
    inline(src, dst)


if __name__ == "__main__":
    main()
`
  }
];

// analysis.js
var file = /* @__PURE__ */ __name((skill, name) => SKILL_FILES.find((f) => f.skill === skill && f.file === name), "file");
var skillMd = /* @__PURE__ */ __name((skill) => file(skill, "SKILL.md")?.text ?? "", "skillMd");
var STAGES = {
  pipeline: {
    skill: "data-analysis-pipeline",
    prompt: "analysis_pipeline",
    title: "\uB370\uC774\uD130 \uBD84\uC11D 4\uB2E8\uACC4 \uC804\uCCB4 (\uAC00\uC124 \u2192 \uC218\uC9D1 \u2192 \uC758\uC2EC \u2192 \uC815\uB9AC)",
    refs: []
  },
  "1-hypothesis": { skill: "1-hypothesis", prompt: "analysis_1_hypothesis", title: "\u2460 \uAC00\uC124: \uBAA9\uD45C \uC778\uD130\uBDF0\uB85C hypothesis.md \uB9CC\uB4E4\uAE30", refs: [] },
  "2-collect": {
    skill: "2-collect",
    prompt: "analysis_2_collect",
    title: "\u2461 \uC218\uC9D1: \uB370\uC774\uD130 \uD655\uBCF4\xB7\uC815\uB9AC\uC640 \uC218\uC9D1 \uAE30\uB85D",
    refs: ["references/data-sources-korea.md"]
  },
  "3-suspect": {
    skill: "3-suspect",
    prompt: "analysis_3_suspect",
    title: "\u2462 \uC758\uC2EC: EDA\uC640 \uD568\uC815 10\uAC1C \uD310\uC815(traps_check.md)",
    refs: ["references/trend-traps.md"]
  },
  "4-report": { skill: "4-report", prompt: "analysis_4_report", title: "\u2463 \uC815\uB9AC: \uD55C \uC7A5 HTML \uB9AC\uD3EC\uD2B8", refs: [] }
};
var STAGE_KEYS = Object.keys(STAGES);
var MCP_ADAPTER = `> **MCP \uC5F0\uACB0 \uD658\uACBD \uC548\uB0B4 (\uB370\uC774\uD130\uD31D\uCF58 MCP)**
> \uC544\uB798 \uC2A4\uD0AC\uC740 \uC6D0\uB798 Claude Code\uC5D0\uC11C \uD30C\uC77C\uC744 \uB9CC\uB4E4\uBA70 \uC4F0\uB3C4\uB85D \uC791\uC131\uB410\uC2B5\uB2C8\uB2E4. \uC9C0\uAE08 \uD658\uACBD\uC5D0\uC11C \uD30C\uC77C\uC744 \uB9CC\uB4E4 \uC218 \uC5C6\uB2E4\uBA74:
> - \uC0B0\uCD9C\uBB3C(hypothesis.md, traps_check.md, findings.md \uB4F1)\uC740 **\uB300\uD654\uC5D0 \uB9C8\uD06C\uB2E4\uC6B4 \uBE14\uB85D\uC73C\uB85C \uADF8\uB300\uB85C \uCD9C\uB825**\uD569\uB2C8\uB2E4. \uD30C\uC77C\uBA85\uC744 \uBE14\uB85D \uC81C\uBAA9\uC73C\uB85C \uBD99\uC785\uB2C8\uB2E4.
> - "Skill \uD234\uB85C \uD638\uCD9C"\uC740 \uC774 \uC11C\uBC84\uC758 \`analysis_get_skill\` \uB3C4\uAD6C(\uB610\uB294 \`analysis_*\` \uD504\uB86C\uD504\uD2B8)\uB85C \uD574\uB2F9 \uB2E8\uACC4 \uC9C0\uCE68\uC744 \uBD88\uB7EC\uC624\uB294 \uAC83\uC73C\uB85C \uB300\uCCB4\uD569\uB2C8\uB2E4.
> - \`1_collect.py\` \uAC19\uC740 \uC2A4\uD06C\uB9BD\uD2B8\uB294 \uC0AC\uC6A9\uC790\uAC00 \uC9C1\uC811 \uC2E4\uD589\uD560 \uC218 \uC788\uB294 \uCF54\uB4DC\uB85C \uC81C\uC2DC\uD558\uACE0, \uC2E4\uD589 \uACB0\uACFC\uB97C \uBC1B\uC740 \uB4A4 \uB2E4\uC74C \uD310\uB2E8\uC744 \uD569\uB2C8\uB2E4.
> - \uC22B\uC790 \uC810\uAC80\uC774 \uD544\uC694\uD558\uBA74 \`analysis_suspect_numbers\` \uB3C4\uAD6C\uB85C \uD45C\uBCF8 \uD06C\uAE30\xB7\uD3C9\uADE0\uC758 \uD568\uC815\xB7\uAE30\uAC04 \uACF5\uBC31\xB7\uAE09\uBCC0\uC810\uC744 \uBA3C\uC800 \uACC4\uC0B0\uD569\uB2C8\uB2E4.
> - \uB2E8\uACC4 \uC21C\uC11C(\u2460\u2192\u2461\u2192\u2462\u2192\u2463)\uC640 "\uC0B0\uCD9C\uBB3C\uC774 \uC5C6\uC73C\uBA74 \uB2E4\uC74C \uB2E8\uACC4\uB85C \uAC00\uC9C0 \uC54A\uB294\uB2E4" \uADDC\uCE59\uC740 \uADF8\uB300\uB85C \uC9C0\uD0B5\uB2C8\uB2E4.`;
function stageText(key, includeRefs) {
  const st = STAGES[key];
  let text = `${MCP_ADAPTER}

${skillMd(st.skill)}`;
  if (includeRefs) {
    for (const r of st.refs) text += `

---

<!-- ${st.skill}/${r} -->

${file(st.skill, r)?.text ?? ""}`;
  }
  return text;
}
__name(stageText, "stageText");
var PROMPT_ARGS = [
  { name: "topic", description: "\uBD84\uC11D\uD558\uB824\uB294 \uC8FC\uC81C\uB098 \uC9C8\uBB38 (\uC608: '\uC810\uC2EC \uB9E4\uCD9C\uC774 \uC65C \uB5A8\uC5B4\uC9C0\uB098')", required: false },
  { name: "context", description: "\uC774\uBBF8 \uAC00\uC9C4 \uB370\uC774\uD130, \uAC00\uC124, \uC911\uAC04 \uACB0\uACFC \uB4F1 \uCC38\uACE0\uD560 \uB0B4\uC6A9", required: false }
];
function listPrompts() {
  return STAGE_KEYS.map((k) => ({ name: STAGES[k].prompt, title: STAGES[k].title, description: STAGES[k].title, arguments: PROMPT_ARGS }));
}
__name(listPrompts, "listPrompts");
function getPrompt(name, args = {}) {
  const key = STAGE_KEYS.find((k) => STAGES[k].prompt === name);
  if (!key) return null;
  const ask = [args.topic && `\uBD84\uC11D \uC8FC\uC81C: ${args.topic}`, args.context && `\uCC38\uACE0 \uB0B4\uC6A9:
${args.context}`].filter(Boolean).join("\n\n");
  return {
    description: STAGES[key].title,
    messages: [
      {
        role: "user",
        content: { type: "text", text: `${stageText(key, true)}

---

\uC704 \uC9C0\uCE68\uB300\uB85C \uC9C4\uD589\uD574 \uC8FC\uC138\uC694.${ask ? `

${ask}` : " \uBA3C\uC800 \uBB34\uC5C7\uC744 \uBD84\uC11D\uD560\uC9C0 \uD55C \uBC88\uC5D0 \uD558\uB098\uC529 \uBB3C\uC5B4\uBD10 \uC8FC\uC138\uC694."}` }
      }
    ]
  };
}
__name(getPrompt, "getPrompt");
function listResources() {
  return SKILL_FILES.map((f) => ({ uri: f.uri, name: `${f.skill}/${f.file}`, mimeType: f.mimeType, description: `\uB370\uC774\uD130\uD31D\uCF58 \uBD84\uC11D \uC2A4\uD0AC \uC6D0\uBB38 (${SKILL_SOURCE})` }));
}
__name(listResources, "listResources");
function readResource(uri) {
  const f = SKILL_FILES.find((x) => x.uri === uri);
  return f ? { contents: [{ uri: f.uri, mimeType: f.mimeType, text: f.text }] } : null;
}
__name(readResource, "readResource");
var ANALYSIS_TOOLS = [
  {
    name: "analysis_get_skill",
    description: "[\uBD84\uC11D] \uB370\uC774\uD130\uD31D\uCF58 \uBD84\uC11D 4\uB2E8\uACC4(\u2460 \uAC00\uC124 \u2192 \u2461 \uC218\uC9D1 \u2192 \u2462 \uC758\uC2EC \u2192 \u2463 \uC815\uB9AC) \uC911 \uD55C \uB2E8\uACC4\uC758 \uC791\uC5C5 \uC9C0\uCE68\uC744 \uBD88\uB7EC\uC635\uB2C8\uB2E4. \uBD84\uC11D\uC744 \uC2DC\uC791\uD558\uAC70\uB098 \uB2E4\uC74C \uB2E8\uACC4\uB85C \uB118\uC5B4\uAC08 \uB54C \uBA3C\uC800 \uD638\uCD9C\uD558\uC138\uC694. \uC608: '\uC774 \uB9E4\uCD9C \uB370\uC774\uD130 \uBD84\uC11D \uC5B4\uB5BB\uAC8C \uC2DC\uC791\uD574?' \u2192 stage=pipeline, '\uAC00\uC124\uBD80\uD130 \uC7A1\uC544\uC918' \u2192 stage=1-hypothesis, '\uC774 \uC22B\uC790 \uBBFF\uC5B4\uB3C4 \uB3FC?' \u2192 stage=3-suspect",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", enum: STAGE_KEYS, description: "pipeline(\uC804\uCCB4 \uC21C\uC11C) / 1-hypothesis / 2-collect / 3-suspect / 4-report" },
        include_references: { type: "boolean", default: true, description: "\uCC38\uACE0 \uD30C\uC77C(\uD55C\uAD6D \uB370\uC774\uD130 \uCD9C\uCC98, \uD2B8\uB80C\uB4DC \uD568\uC815 \uC0AC\uB840\uC9D1)\uB3C4 \uD568\uAED8 \uBC1B\uAE30" }
      },
      required: ["stage"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "analysis_traps_checklist",
    description: "[\uBD84\uC11D] \uACB0\uB860\uC744 \uB0B4\uAE30 \uC804\uC5D0 \uD1B5\uACFC\uD574\uC57C \uD558\uB294 \uB370\uC774\uD130 \uD568\uC815 10\uAC1C(\uACF5\uD1B5 5 + \uAC80\uC99D 5)\uB97C traps_check.md \uD45C \uD615\uC2DD\uC73C\uB85C \uC90D\uB2C8\uB2E4. \uAC80\uC0C9\uB7C9\xB7SNS\xB7\uC9C0\uC5ED \uD2B8\uB80C\uB4DC \uBD84\uC11D\uC774\uBA74 trend=true\uB85C \uC804\uC6A9 \uD568\uC815 6\uAC1C\uB97C \uCD94\uAC00\uD569\uB2C8\uB2E4. \uC608: '\uC774 \uACB0\uB860\uC5D0 \uD568\uC815 \uC5C6\uB294\uC9C0 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8 \uC918'",
    inputSchema: {
      type: "object",
      properties: { trend: { type: "boolean", default: false, description: "\uD2B8\uB80C\uB4DC\xB7\uC9C0\uC5ED \uBD84\uC11D \uC804\uC6A9 \uD568\uC815 6\uAC1C \uCD94\uAC00" } }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "analysis_suspect_numbers",
    description: "[\uBD84\uC11D] \uC22B\uC790 \uBC30\uC5F4(\uD544\uC694\uD558\uBA74 \uB0A0\uC9DC\xB7\uC138\uADF8\uBA3C\uD2B8 \uAC74\uC218\uAE4C\uC9C0)\uC744 \uBC1B\uC544 \uD568\uC815 \uC911 \uACC4\uC0B0\uC73C\uB85C \uD655\uC778\uD560 \uC218 \uC788\uB294 \uAC83\uC744 \uC790\uB3D9 \uC810\uAC80\uD558\uACE0 traps_check.md \uCD08\uC548\uC744 \uB3CC\uB824\uC90D\uB2C8\uB2E4. \uD45C\uBCF8 \uD06C\uAE30, \uD3C9\uADE0 vs \uC911\uC559\uAC12, IQR \uC774\uC0C1\uCE58, \uAE30\uAC04 \uACF5\uBC31\xB7\uAC74\uC218 \uC0C1\uD55C \uC758\uC2EC, \uAE30\uC900 \uAE30\uAC04\uC774 \uADF9\uB2E8\uAC12\uC778\uC9C0, \uAC00\uC7A5 \uD070 \uAE09\uBCC0\uC810\uACFC \uADF8 \uC804 \uAD6C\uAC04\uC774 \uD3C9\uD3C9\uD588\uB294\uC9C0\uB97C \uACC4\uC0B0\uD569\uB2C8\uB2E4. \uB098\uBA38\uC9C0 \uD568\uC815\uC740 '\uC0AC\uB78C \uD310\uC815 \uD544\uC694'\uB85C \uD45C\uC2DC\uD569\uB2C8\uB2E4. \uC608: '\uC6D4\uBCC4 \uB9E4\uCD9C [120,118,...]\uC774 3\uC6D4\uC5D0 \uAE09\uC99D\uD588\uB294\uB370 \uBBFF\uC5B4\uB3C4 \uB3FC?'",
    inputSchema: {
      type: "object",
      properties: {
        metric_name: { type: "string", description: "\uC9C0\uD45C \uC774\uB984 (\uC608: \uC6D4 \uB9E4\uCD9C, \uC77C \uBC29\uBB38\uC790 \uC218)" },
        values: { type: "array", items: { type: "number" }, minItems: 3, description: "\uC9C0\uD45C \uAC12 \uBC30\uC5F4 (\uC2DC\uAC04\uC21C\uC774\uBA74 dates\uC640 \uAC19\uC740 \uC21C\uC11C)" },
        dates: { type: "array", items: { type: "string" }, description: "\uC120\uD0DD. values\uC640 \uAC19\uC740 \uAE38\uC774\uC758 \uB0A0\uC9DC (YYYY-MM-DD \uB610\uB294 YYYY-MM)" },
        segments: {
          type: "array",
          description: "\uC120\uD0DD. \uC138\uADF8\uBA3C\uD2B8\uBCC4 \uD45C\uBCF8 \uD06C\uAE30. \uBE44\uC728(rate, %)\uB85C \uBE44\uAD50\uD558\uB294 \uC138\uADF8\uBA3C\uD2B8\uAC00 \uC788\uC73C\uBA74 n\uACFC \uD568\uAED8 \uB123\uC73C\uC138\uC694",
          items: { type: "object", properties: { name: { type: "string" }, n: { type: "number" }, rate: { type: "number" } }, required: ["name", "n"] }
        }
      },
      required: ["values"]
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }
];
var ANALYSIS_TOOL_NAMES = new Set(ANALYSIS_TOOLS.map((t) => t.name));
function callAnalysisTool(name, args = {}) {
  if (name === "analysis_get_skill") {
    if (!STAGES[args.stage]) throw new Error(`stage must be one of: ${STAGE_KEYS.join(", ")}`);
    return stageText(args.stage, args.include_references !== false);
  }
  if (name === "analysis_traps_checklist") return trapsChecklist(Boolean(args.trend));
  if (name === "analysis_suspect_numbers") return suspectNumbers(args);
  throw new Error(`Unknown analysis tool: ${name}`);
}
__name(callAnalysisTool, "callAnalysisTool");
function parseTraps() {
  const traps = [];
  let inTrapSection = false;
  for (const line of skillMd("3-suspect").split("\n")) {
    if (line.startsWith("## ")) inTrapSection = line.includes("\uD568\uC815") && !line.includes("\uD2B8\uB80C\uB4DC");
    if (!inTrapSection) continue;
    const m = line.match(/^(\d+)\.\s+\*\*(.+?)\*\*\s+[—-]\s+(.+)$/);
    if (m && !traps.some((t) => t.id === m[1])) traps.push({ id: m[1], name: m[2], question: m[3].trim() });
  }
  return traps;
}
__name(parseTraps, "parseTraps");
function parseTrendTraps() {
  const text = file("3-suspect", "references/trend-traps.md")?.text ?? "";
  const out = [];
  const re = /^### (T\d+)\. (.+)$/gm;
  let m;
  while (m = re.exec(text)) {
    const rest = text.slice(m.index + m[0].length).split(/\n### |\n## /)[0].trim();
    out.push({ id: m[1], name: m[2].trim(), question: rest.split("\n").find((l) => l.trim()) ?? "" });
  }
  return out;
}
__name(parseTrendTraps, "parseTrendTraps");
function trapsChecklist(trend) {
  const rows = parseTraps();
  if (trend) rows.push(...parseTrendTraps());
  const table = rows.map((t) => `| ${t.id} | ${t.name} | | ${t.question.replace(/\|/g, "/")} |`).join("\n");
  return `# traps_check.md (\uC791\uC131\uC6A9 \uC591\uC2DD)

\uD310\uC815 \uCE78\uC5D0\uB294 **\uD574\uB2F9\uC5C6\uC74C / \uD655\uC778\uD568(\uBC29\uBC95) / \uAC78\uB9BC(\u2192 \uC870\uCE58)** \uC911 \uD558\uB098\uB97C \uBC18\uB4DC\uC2DC \uC801\uC2B5\uB2C8\uB2E4. \uBE48 \uCE78\uC744 \uB0A8\uAE30\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4. \uAC78\uB9B0 \uD56D\uBAA9\uC740 \uC7AC\uC9D1\uACC4\uB85C \uACE0\uCE58\uAC70\uB098 \u2463 \uB9AC\uD3EC\uD2B8\uC758 "\uD55C\uACC4" \uCE74\uB4DC\uB85C \uB118\uAE41\uB2C8\uB2E4.

| # | \uD568\uC815 | \uD310\uC815 | \uC2A4\uC2A4\uB85C \uBB3C\uC744 \uC9C8\uBB38 |
|---|---|---|---|
${table}

\uC778\uACFC\uB97C \uB9D0\uD558\uB824\uBA74 \uC138 \uC870\uAC74(\uAC1C\uC785 \uC804 baseline\uC774 \uD3C9\uD3C9 / \uAE09\uBCC0 \uC2DC\uC810\uC774 \uAC1C\uC785 \uC2DC\uC810\uACFC \uC77C\uCE58 / \uAC19\uC740 \uC2DC\uC810 \uB2E4\uB978 \uBCC0\uD654 \uC5C6\uC74C)\uC744 \uBAA8\uB450 \uB9CC\uC871\uD574\uC57C \uD569\uB2C8\uB2E4. \uD558\uB098\uB77C\uB3C4 \uBE60\uC9C0\uBA74 "\uB3D9\uC2DC \uBC1C\uC0DD"\uAE4C\uC9C0\uB9CC \uC501\uB2C8\uB2E4.`;
}
__name(trapsChecklist, "trapsChecklist");
var round = /* @__PURE__ */ __name((x, d = 2) => Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x, "round");
function quantile(sorted, q) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}
__name(quantile, "quantile");
function parseDates(dates) {
  if (!Array.isArray(dates) || dates.length === 0) return null;
  const monthly = dates.every((d) => /^\d{4}-\d{2}$/.test(d));
  const daily = dates.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!monthly && !daily) return { error: "dates\uB294 \uBAA8\uB450 YYYY-MM-DD \uB610\uB294 \uBAA8\uB450 YYYY-MM \uD615\uC2DD\uC774\uC5B4\uC57C \uD569\uB2C8\uB2E4" };
  const idx = dates.map((d) => {
    const [y, m, day] = d.split("-").map(Number);
    return monthly ? y * 12 + (m - 1) : Date.UTC(y, m - 1, day) / 864e5;
  });
  return { unit: monthly ? "\uC6D4" : "\uC77C", idx };
}
__name(parseDates, "parseDates");
function suspectNumbers(args) {
  const values = (args.values || []).map(Number);
  if (values.length < 3 || values.some((v) => !Number.isFinite(v))) throw new Error("values\uC5D0\uB294 \uC22B\uC790\uB97C 3\uAC1C \uC774\uC0C1 \uB123\uC5B4\uC57C \uD569\uB2C8\uB2E4");
  const metric = args.metric_name || "\uC9C0\uD45C";
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const median = quantile(sorted, 0.5);
  const sd = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1));
  const q1 = quantile(sorted, 0.25), q3 = quantile(sorted, 0.75), iqr = q3 - q1;
  const lowB = q1 - 1.5 * iqr, highB = q3 + 1.5 * iqr;
  const outliers = values.map((v, i) => ({ i, v })).filter(({ v }) => v < lowB || v > highB);
  const gap = median !== 0 ? (mean - median) / Math.abs(median) : null;
  const dates = Array.isArray(args.dates) && args.dates.length ? args.dates : null;
  if (dates && dates.length !== n) throw new Error("dates\uC640 values\uC758 \uAE38\uC774\uAC00 \uAC19\uC544\uC57C \uD569\uB2C8\uB2E4");
  const label = /* @__PURE__ */ __name((i) => dates ? dates[i] : `#${i + 1}`, "label");
  const parsed = dates ? parseDates(dates) : null;
  if (parsed?.error) throw new Error(parsed.error);
  const verdict = {};
  const note = /* @__PURE__ */ __name((id, v, why) => verdict[id] = { v, why }, "note");
  const smallSegs = (args.segments || []).filter((s) => Number(s.n) < 10);
  const smallRated = smallSegs.filter((s) => s.rate !== void 0 && s.rate !== null);
  const p3 = [];
  if (n < 10) p3.push(`\uAD00\uCE21\uCE58\uAC00 ${n}\uAC1C\uBFD0\uC785\uB2C8\uB2E4. \uCD94\uC138\xB7\uAE09\uBCC0\uC744 \uB2E8\uC815\uD558\uC9C0 \uB9D0\uACE0 \uAE30\uAC04\uC744 \uB298\uB9AC\uAC70\uB098 '\uC9E7\uC740 \uAE30\uAC04 \uAD00\uCC30'\uC744 \uD55C\uACC4\uB85C \uC801\uC73C\uC138\uC694`);
  if (smallRated.length) p3.push(`n<10\uC778\uB370 \uBE44\uC728\uB85C \uBE44\uAD50\uD55C \uC138\uADF8\uBA3C\uD2B8: ${smallRated.map((s) => `${s.name}(n=${s.n}, ${s.rate}%)`).join(", ")} \u2192 \uBE44\uC728 \uB300\uC2E0 \uAC74\uC218\uB85C \uD45C\uAE30`);
  if (p3.length) note("3", "\uAC78\uB9BC", p3.join(". "));
  else if (smallSegs.length) note("3", "\uD655\uC778\uD568", `n<10 \uC138\uADF8\uBA3C\uD2B8(${smallSegs.map((s) => s.name).join(", ")})\uAC00 \uC788\uC73C\uB098 \uBE44\uC728 \uBE44\uAD50\uB294 \uC5C6\uC74C. \uAC74\uC218\uB85C\uB9CC \uC11C\uC220`);
  else note("3", "\uD655\uC778\uD568", `\uAD00\uCE21\uCE58 ${n}\uAC1C${args.segments ? `, \uC138\uADF8\uBA3C\uD2B8 \uBAA8\uB450 n\u226510` : ""}`);
  if (gap !== null && Math.abs(gap) > 0.1 || outliers.length)
    note("4", "\uAC78\uB9BC", `\uD3C9\uADE0 ${round(mean)} vs \uC911\uC559\uAC12 ${round(median)} (\uCC28\uC774 ${gap === null ? "\uACC4\uC0B0 \uBD88\uAC00" : round(gap * 100, 1) + "%"}), IQR \uC774\uC0C1\uCE58 ${outliers.length}\uAC1C \u2192 \uC911\uC559\uAC12\uC744 \uD568\uAED8 \uC4F0\uACE0 \uC774\uC0C1\uCE58\uB97C \uD310\uC815\uD558\uC138\uC694`);
  else note("4", "\uD655\uC778\uD568", `\uD3C9\uADE0 ${round(mean)} \u2248 \uC911\uC559\uAC12 ${round(median)}, IQR \uC774\uC0C1\uCE58 \uC5C6\uC74C`);
  const roundCaps = [100, 200, 500, 1e3, 2e3, 5e3, 1e4];
  if (parsed) {
    const order = parsed.idx.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
    const span = order[n - 1][0] - order[0][0] + 1;
    const uniq = new Set(parsed.idx).size;
    const missing = span - uniq;
    const capHit = roundCaps.includes(n);
    if (missing > 0 || uniq < n || capHit)
      note("9", "\uAC78\uB9BC", [missing > 0 && `${dates[order[0][1]]}~${dates[order[n - 1][1]]} \uC0AC\uC774 ${parsed.unit} \uB2E8\uC704\uB85C ${missing}\uAC1C \uAD6C\uAC04\uC774 \uBE44\uC5B4 \uC788\uC74C`, uniq < n && `\uAC19\uC740 \uB0A0\uC9DC\uAC00 ${n - uniq}\uBC88 \uC911\uBCF5`, capHit && `\uAC74\uC218\uAC00 \uC815\uD655\uD788 ${n}\uAC1C\uB77C API \uAC74\uC218 \uC0C1\uD55C\uC5D0 \uAC78\uB838\uC744 \uC218 \uC788\uC74C`].filter(Boolean).join(". "));
    else note("9", "\uD655\uC778\uD568", `${dates[order[0][1]]}~${dates[order[n - 1][1]]} ${parsed.unit} \uB2E8\uC704 \uBE48 \uAD6C\uAC04 \uC5C6\uC74C`);
    const series = order.map(([, i]) => values[i]);
    const sdates = order.map(([, i]) => dates[i]);
    const base = series[0];
    if (base === Math.min(...series) || base === Math.max(...series))
      note("1", "\uAC78\uB9BC", `\uAE30\uC900 \uC2DC\uC810 ${sdates[0]}\uC758 \uAC12(${base})\uC774 \uC804\uCCB4 ${base === Math.min(...series) ? "\uCD5C\uC800" : "\uCD5C\uACE0"}\uAC12\uC785\uB2C8\uB2E4. \uBE44\uC815\uC0C1 \uC2DC\uC810(\uBA85\uC808\xB7\uBE44\uC218\uAE30\xB7\uC774\uBCA4\uD2B8)\uC778\uC9C0 \uD655\uC778\uD558\uACE0 \uC815\uC0C1 \uAE30\uAC04 \uD3C9\uADE0\uACFC \uB2E4\uC2DC \uBE44\uAD50\uD558\uC138\uC694`);
    else note("1", "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", `\uAE30\uC900 \uC2DC\uC810 ${sdates[0]}\uC758 \uAC12(${base})\uC740 \uADF9\uB2E8\uAC12\uC774 \uC544\uB2D8. \uADF8 \uC2DC\uC810\uC5D0 \uBA85\uC808\xB7\uC774\uBCA4\uD2B8\uAC00 \uC788\uC5C8\uB294\uC9C0\uB294 \uC0AC\uB78C\uC774 \uD655\uC778`);
    let best = null;
    for (let k = 1; k < series.length; k++) {
      const prev = series[k - 1];
      const ch = prev !== 0 ? (series[k] - prev) / Math.abs(prev) : null;
      if (ch !== null && (!best || Math.abs(ch) > Math.abs(best.ch))) best = { k, ch };
    }
    if (best) {
      const pre = series.slice(0, best.k);
      const pm = pre.reduce((a, b) => a + b, 0) / pre.length;
      const pcv = pre.length >= 3 && pm !== 0 ? Math.sqrt(pre.reduce((a, v) => a + (v - pm) ** 2, 0) / (pre.length - 1)) / Math.abs(pm) : null;
      const flat = pcv !== null && pcv < 0.1;
      note("5", "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", `\uAC00\uC7A5 \uD070 \uBCC0\uD654: ${sdates[best.k - 1]}\u2192${sdates[best.k]} ${round(best.ch * 100, 1)}%. \uADF8 \uC804 \uAD6C\uAC04(${pre.length}\uAC1C) \uBCC0\uB3D9\uACC4\uC218 ${pcv === null ? "\uACC4\uC0B0 \uBD88\uAC00(3\uAC1C \uBBF8\uB9CC)" : round(pcv * 100, 1) + "%"} \u2192 baseline ${pcv === null ? "\uD310\uB2E8 \uBD88\uAC00" : flat ? "\uD3C9\uD3C9\uD568(\uC870\uAC74 1 \uCDA9\uC871)" : "\uD3C9\uD3C9\uD558\uC9C0 \uC54A\uC74C(\uC870\uAC74 1 \uBD88\uCDA9\uC871)"}. \uAC1C\uC785 \uC2DC\uC810 \uC77C\uCE58(\uC870\uAC74 2)\uC640 \uB2E4\uB978 \uBCC0\uD654 \uC5C6\uC74C(\uC870\uAC74 3)\uC740 \uC0AC\uB78C\uC774 \uD655\uC778. \uC14B \uC911 \uD558\uB098\uB77C\uB3C4 \uBE60\uC9C0\uBA74 "\uB3D9\uC2DC \uBC1C\uC0DD"\uC73C\uB85C\uB9CC \uC11C\uC220`);
    }
  } else {
    note("9", roundCaps.includes(n) ? "\uAC78\uB9BC" : "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", roundCaps.includes(n) ? `\uAC74\uC218\uAC00 \uC815\uD655\uD788 ${n}\uAC1C\uB77C \uCD94\uCD9C\xB7API \uC0C1\uD55C\uC5D0 \uAC78\uB838\uC744 \uC218 \uC788\uC74C` : "\uB0A0\uC9DC\uAC00 \uC5C6\uC5B4 \uAE30\uAC04 \uACF5\uBC31\uC740 \uACC4\uC0B0\uD558\uC9C0 \uBABB\uD568. \uCD94\uCD9C \uC870\uAC74\uACFC \uC0C1\uD55C\uC744 \uD655\uC778");
    note("1", "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", "\uB0A0\uC9DC\uAC00 \uC5C6\uC5B4 \uAE30\uC900 \uC2DC\uC810\uC744 \uACC4\uC0B0\uD558\uC9C0 \uBABB\uD568");
    note("5", "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", "\uB0A0\uC9DC\uAC00 \uC5C6\uC5B4 \uAE09\uBCC0\uC810\uC744 \uACC4\uC0B0\uD558\uC9C0 \uBABB\uD568. \uC2DC\uC810\uC774 \uACB9\uCE5C\uB2E4\uB294 \uC774\uC720\uB9CC\uC73C\uB85C \uC6D0\uC778\uC744 \uB2E8\uC815\uD558\uC9C0 \uB9C8\uC138\uC694");
  }
  const rows = parseTraps().map((t) => {
    const r = verdict[t.id] || { v: "\uC0AC\uB78C \uD310\uC815 \uD544\uC694", why: t.question };
    return `| ${t.id} | ${t.name} | ${r.v} | ${String(r.why).replace(/\|/g, "/")} |`;
  });
  return `# ${metric}: \uC22B\uC790 \uC758\uC2EC \uC810\uAC80 (\uC790\uB3D9 \uACC4\uC0B0 \uCD08\uC548)

| \uD56D\uBAA9 | \uAC12 |
|---|---|
| \uAC1C\uC218 | ${n} |
| \uD3C9\uADE0 / \uC911\uC559\uAC12 | ${round(mean)} / ${round(median)} |
| \uD45C\uC900\uD3B8\uCC28 | ${round(sd)} |
| \uCD5C\uC18C / \uCD5C\uB300 | ${sorted[0]} / ${sorted[n - 1]} |
| Q1 / Q3 (IQR \uACBD\uACC4) | ${round(q1)} / ${round(q3)} (${round(lowB)} ~ ${round(highB)}) |
| IQR \uC774\uC0C1\uCE58 | ${outliers.length ? outliers.map(({ i, v }) => `${label(i)}=${v}`).join(", ") : "\uC5C6\uC74C"} |

## traps_check.md \uCD08\uC548

| # | \uD568\uC815 | \uD310\uC815 | \uADFC\uAC70 / \uC870\uCE58 |
|---|---|---|---|
${rows.join("\n")}

> \uC790\uB3D9 \uD310\uC815\uC740 \uACC4\uC0B0\uC73C\uB85C \uD655\uC778\uD560 \uC218 \uC788\uB294 \uD56D\uBAA9(1, 3, 4, 5\uC758 \uC77C\uBD80, 9)\uB9CC \uCC44\uC6B4 **\uCD08\uC548**\uC785\uB2C8\uB2E4. "\uC0AC\uB78C \uD310\uC815 \uD544\uC694" \uCE78\uC740 \uBD84\uC11D\uAC00\uAC00 \uC9C1\uC811 \uD574\uB2F9\uC5C6\uC74C/\uD655\uC778\uD568/\uAC78\uB9BC\uC73C\uB85C \uBC14\uAFD4\uC57C traps_check.md\uAC00 \uC644\uC131\uB429\uB2C8\uB2E4. \uC774\uC0C1\uCE58\uB294 \uC9C0\uC6B0\uC9C0 \uB9D0\uACE0 \uD310\uC815\uD558\uC138\uC694.`;
}
__name(suspectNumbers, "suspectNumbers");

// worker.js
var SERVER_NAME = "datahub-mcp-server";
var SERVER_VERSION = "0.4.0";
var NEIS_BASE_URL = "https://open.neis.go.kr/hub";
var SERVER_INSTRUCTIONS = "\uAC1C\uC778 \uB370\uC774\uD130\uD5C8\uBE0C(datapopcorn)\uB97C \uB178\uCD9C\uD558\uB294 MCP \uC11C\uBC84. \uCC98\uC74C \uC0AC\uC6A9\uD558\uAC70\uB098 \uC5B4\uB5A4 \uD234\uC744 \uC368\uC57C \uD560\uC9C0 \uBAA8\uB974\uBA74 \uBA3C\uC800 `guide` \uD234\uC744 \uD638\uCD9C\uD574\uC11C \uC0AC\uC6A9\uBC95\uACFC \uD604\uC7AC \uB4F1\uB85D\uB41C \uB370\uC774\uD130 \uC18C\uC2A4 \uBAA9\uB85D\uC744 \uD655\uC778\uD560 \uAC83.";
var GUIDE_TEXT = `# datahub-mcp-server \uC0AC\uC6A9 \uAC00\uC774\uB4DC

\uC774 \uC11C\uBC84\uB294 \uAC1C\uC778 \uB370\uC774\uD130\uD5C8\uBE0C(datapopcorn)\uB97C MCP \uB3C4\uAD6C\uB85C \uB178\uCD9C\uD558\uB294 \uC11C\uBC84. \uB370\uC774\uD130 \uC18C\uC2A4\uBCC4\uB85C \uD234\uC774 \uBB36\uC5EC \uC788\uACE0,
\uC0C8 \uC18C\uC2A4\uAC00 \uC0DD\uAE30\uBA74 \uC5EC\uAE30 \uACC4\uC18D \uCD94\uAC00\uB428. \uCC98\uC74C\uC774\uBA74 \uC774 \uAC00\uC774\uB4DC\uBD80\uD130 \uC77D\uACE0 \uC2DC\uC791\uD560 \uAC83.

## \uC9C0\uAE08 \uC4F8 \uC218 \uC788\uB294 \uC18C\uC2A4: NEIS (\uD559\uAD50/\uAE09\uC2DD, \uACF5\uAC1C \uB370\uC774\uD130) \u2014 \uD234 \uC774\uB984 \uC804\uBD80 \`neis_\` \uC811\uB450\uC5B4

- \`neis_list_office_codes\` \u2014 \uC9C0\uC5ED\uBA85(\uC11C\uC6B8/\uBD80\uC0B0/\uC81C\uC8FC \uB4F1) -> \uC2DC\uB3C4\uAD50\uC721\uCCAD \uCF54\uB4DC \uB9E4\uD551. \uB2E4\uB978 \uD234 \uC4F0\uAE30 \uC804\uC5D0 \uCF54\uB4DC \uBAA8\uB974\uBA74 \uBA3C\uC800 \uD638\uCD9C.
- \`neis_search_schools\` \u2014 \uD559\uAD50 \uAC80\uC0C9. \`officeCode\`(\uD544\uC218, \uC608: B10) + \`schoolName\`(\uC120\uD0DD, \uBD80\uBD84 \uC77C\uCE58)\uC73C\uB85C \uD559\uAD50\uCF54\uB4DC(SD_SCHUL_CODE) \uCC3E\uAE30.
- \`neis_get_meals\` \u2014 \uAE09\uC2DD \uC815\uBCF4 \uC870\uD68C. \`officeCode\` + \`schoolCode\`(neis_search_schools\uB85C \uCC3E\uC740 \uAC12) + \uB0A0\uC9DC \uC870\uAC74(\`date\` \uB610\uB294 \`fromDate\`/\`toDate\`)\uC73C\uB85C \uC870\uD68C, \uC5EC\uB7EC \uD398\uC774\uC9C0 \uC790\uB3D9 \uCC98\uB9AC.

\uC77C\uBC18\uC801\uC778 \uD750\uB984: neis_list_office_codes\uB85C \uC9C0\uC5ED \uCF54\uB4DC \uD655\uC778 \u2192 neis_search_schools\uB85C \uD559\uAD50\uCF54\uB4DC \uD655\uC778 \u2192 neis_get_meals\uB85C \uAE09\uC2DD \uC870\uD68C.
\uD559\uAD50\uCF54\uB4DC\uB97C \uC774\uBBF8 \uC54C\uACE0 \uC788\uC73C\uBA74 \uC55E \uB2E8\uACC4 \uC0DD\uB7B5 \uAC00\uB2A5.

\uC0C8 \uC18C\uC2A4\uAC00 \uCD94\uAC00\uB418\uBA74 \uADF8 \uC18C\uC2A4\uB3C4 \uC790\uAE30 \uC811\uB450\uC5B4(\uC608: \`haerapy_\`, \`golf_\`)\uB97C \uC500 \u2014 \uC774\uB984\uC774 \uACB9\uCE58\uAC70\uB098 \uD5F7\uAC08\uB9B4 \uC77C \uC5C6\uAC8C \uD558\uAE30 \uC704\uD568.

## \uB370\uC774\uD130 \uBD84\uC11D \uC2A4\uD0AC (\uB370\uC774\uD130\uD31D\uCF58 \uBD84\uC11D 4\uB2E8\uACC4) \u2014 \uD234 \uC774\uB984 \uC804\uBD80 \`analysis_\` \uC811\uB450\uC5B4

\u2460 \uAC00\uC124 \u2192 \u2461 \uC218\uC9D1 \u2192 \u2462 \uC758\uC2EC \u2192 \u2463 \uC815\uB9AC \uC21C\uC11C\uB85C \uBD84\uC11D\uC744 \uC9C4\uD589\uD558\uAC8C \uB3D5\uB294 \uC9C0\uCE68\uACFC \uC810\uAC80 \uB3C4\uAD6C.

- \`analysis_get_skill\` \u2014 \uB2E8\uACC4\uBCC4 \uC791\uC5C5 \uC9C0\uCE68. \`stage\`: pipeline / 1-hypothesis / 2-collect / 3-suspect / 4-report. \uBD84\uC11D \uC2DC\uC791 \uC2DC pipeline\uBD80\uD130.
- \`analysis_traps_checklist\` \u2014 \uACB0\uB860 \uC804\uC5D0 \uD1B5\uACFC\uD560 \uD568\uC815 10\uAC1C(\uD2B8\uB80C\uB4DC \uBD84\uC11D\uC774\uBA74 \`trend: true\`\uB85C 6\uAC1C \uCD94\uAC00) traps_check.md \uC591\uC2DD.
- \`analysis_suspect_numbers\` \u2014 \uC22B\uC790 \uBC30\uC5F4(+\uB0A0\uC9DC\xB7\uC138\uADF8\uBA3C\uD2B8 \uAC74\uC218)\uC744 \uB123\uC73C\uBA74 \uD45C\uBCF8 \uD06C\uAE30, \uD3C9\uADE0 vs \uC911\uC559\uAC12, \uC774\uC0C1\uCE58, \uAE30\uAC04 \uACF5\uBC31, \uAE30\uC900 \uAE30\uAC04, \uAE09\uBCC0\uC810\uC744 \uACC4\uC0B0\uD574 traps_check.md \uCD08\uC548\uC744 \uC90C.
- \uAC19\uC740 \uC9C0\uCE68\uC744 MCP \uD504\uB86C\uD504\uD2B8(\`analysis_pipeline\`, \`analysis_1_hypothesis\` ~ \`analysis_4_report\`)\uC640 \uB9AC\uC18C\uC2A4(\`datapopcorn://skills/...\`)\uB85C\uB3C4 \uC81C\uACF5.

## \uC0AC\uC6A9 \uC608\uC2DC (\uC790\uC5F0\uC5B4\uB85C \uADF8\uB0E5 \uBB3C\uC5B4\uBCF4\uBA74 \uB428)

- "\uC11C\uC6B8 \uC9C0\uC5ED \uD559\uAD50 \uCF54\uB4DC \uC54C\uB824\uC918"
- "\uC11C\uC6B8 B10, \uAC00\uB77D\uACE0\uB4F1\uD559\uAD50 \uD559\uAD50\uCF54\uB4DC \uCC3E\uC544\uC918"
- "\uC11C\uC6B8 B10, \uD559\uAD50\uCF54\uB4DC 7010057 \uD559\uAD50 \uC774\uBC88 \uB2EC \uAE09\uC2DD \uC54C\uB824\uC918"
- "\uC6B0\uB9AC \uAC00\uAC8C \uC6D4 \uB9E4\uCD9C\uC774 \uC65C \uB5A8\uC5B4\uC9C0\uB294\uC9C0 \uBD84\uC11D\uD558\uACE0 \uC2F6\uC5B4. \uB370\uC774\uD130\uD31D\uCF58 4\uB2E8\uACC4\uB85C \uC2DC\uC791\uD574\uC918"
- "\uC6D4\uBCC4 \uBC29\uBB38\uC790 [120, 118, 125, 240, 230]\uC778\uB370 4\uC6D4 \uAE09\uC99D \uBBFF\uC5B4\uB3C4 \uB3FC?"

## \uCC38\uACE0

- \uB370\uC774\uD130\uD31D\uCF58 \uACC4\uC815(Google \uB85C\uADF8\uC778)\uC73C\uB85C \uAC00\uC785\xB7\uB85C\uADF8\uC778\uD55C \uC0AC\uC6A9\uC790\uB9CC \uD638\uCD9C\uD560 \uC218 \uC788\uC74C. MCP \uD074\uB77C\uC774\uC5B8\uD2B8\uC5D0 \uC8FC\uC18C\uB9CC \uB123\uC73C\uBA74
  \uCC98\uC74C \uC5F0\uACB0\uD560 \uB54C \uB85C\uADF8\uC778 \uCC3D\uC774 \uB738. \uBAA8\uB4E0 \uB3C4\uAD6C\uB294 \uC77D\uAE30 \uC804\uC6A9.
`;
var JSON_RPC_VERSION = "2.0";
var LATEST_PROTOCOL_VERSION = "2025-11-25";
var SUPPORTED_PROTOCOL_VERSIONS = /* @__PURE__ */ new Set([
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07"
]);
var ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603
};
var OFFICE_CODES = {
  \uC11C\uC6B8: "B10",
  \uBD80\uC0B0: "C10",
  \uB300\uAD6C: "D10",
  \uC778\uCC9C: "E10",
  \uAD11\uC8FC: "F10",
  \uB300\uC804: "G10",
  \uC6B8\uC0B0: "H10",
  \uC138\uC885: "I10",
  \uACBD\uAE30: "J10",
  \uAC15\uC6D0: "K10",
  \uCDA9\uBD81: "M10",
  \uCDA9\uB0A8: "N10",
  \uC804\uBD81: "P10",
  \uC804\uB0A8: "Q10",
  \uACBD\uBD81: "R10",
  \uACBD\uB0A8: "S10",
  \uC81C\uC8FC: "T10"
};
var READ_ONLY = { readOnlyHint: true, openWorldHint: true };
var TOOL_DEFINITIONS_BASE = [
  {
    name: "guide",
    description: "\uC774 MCP \uC11C\uBC84\uB97C \uCC98\uC74C \uC4F0\uB294 \uACBD\uC6B0 \uAC00\uC7A5 \uBA3C\uC800 \uD638\uCD9C\uD560 \uAC83. \uC11C\uBC84 \uBAA9\uC801, \uD604\uC7AC \uB4F1\uB85D\uB41C \uB370\uC774\uD130 \uC18C\uC2A4, \uAC01 \uD234 \uC0AC\uC6A9\uBC95\uACFC \uC608\uC2DC\uB97C \uC548\uB0B4\uD569\uB2C8\uB2E4.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "neis_list_office_codes",
    description: "[NEIS] \uC9C0\uC5ED\uBA85(\uC11C\uC6B8/\uBD80\uC0B0/\uC81C\uC8FC \uB4F1) -> NEIS \uC2DC\uB3C4\uAD50\uC721\uCCAD \uCF54\uB4DC(ATPT_OFCDC_SC_CODE) \uB9E4\uD551\uC744 \uBC18\uD658\uD569\uB2C8\uB2E4.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: "neis_search_schools",
    description: "[NEIS] schoolInfo API\uB85C \uD559\uAD50\uB97C \uAC80\uC0C9\uD569\uB2C8\uB2E4. \uC2DC\uB3C4\uAD50\uC721\uCCAD \uCF54\uB4DC\uC640 \uD559\uAD50\uBA85(\uBD80\uBD84 \uC77C\uCE58)\uC73C\uB85C \uD544\uD130\uB9C1\uD569\uB2C8\uB2E4. \uC608: '\uC11C\uC6B8 \uAC00\uB77D\uACE0\uB4F1\uD559\uAD50 \uD559\uAD50\uCF54\uB4DC \uCC3E\uC544\uC918'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: { type: "string", description: "\uC2DC\uB3C4\uAD50\uC721\uCCAD \uCF54\uB4DC, \uC608: B10 (\uC11C\uC6B8). neis_list_office_codes\uB85C \uC870\uD68C \uAC00\uB2A5" },
        schoolName: { type: "string", description: "\uD559\uAD50\uBA85 \uBD80\uBD84 \uC77C\uCE58 \uAC80\uC0C9\uC5B4" },
        pIndex: { type: "integer", minimum: 1, default: 1 },
        pSize: { type: "integer", minimum: 1, maximum: 100, default: 20 }
      },
      required: ["officeCode"]
    },
    annotations: READ_ONLY
  },
  {
    name: "neis_get_meals",
    description: "[NEIS] mealServiceDietInfo API\uB85C \uD2B9\uC815 \uD559\uAD50\uC758 \uAE09\uC2DD \uC815\uBCF4\uB97C \uC870\uD68C\uD569\uB2C8\uB2E4. \uD544\uC694 \uC2DC \uC5EC\uB7EC \uD398\uC774\uC9C0\uB97C \uC790\uB3D9\uC73C\uB85C \uC774\uC5B4\uBD99\uC5EC \uBC18\uD658\uD569\uB2C8\uB2E4. \uC608: '\uD559\uAD50\uCF54\uB4DC 7010057 \uC774\uBC88 \uB2EC \uAE09\uC2DD \uC54C\uB824\uC918'",
    inputSchema: {
      type: "object",
      properties: {
        officeCode: { type: "string", description: "\uC2DC\uB3C4\uAD50\uC721\uCCAD \uCF54\uB4DC, \uC608: B10" },
        schoolCode: { type: "string", description: "\uD45C\uC900\uD559\uAD50\uCF54\uB4DC SD_SCHUL_CODE" },
        date: { type: "string", description: "\uD2B9\uC815 \uAE09\uC2DD\uC77C\uC790 YYYYMMDD" },
        fromDate: { type: "string", description: "\uAC80\uC0C9 \uC2DC\uC791\uC77C YYYYMMDD" },
        toDate: { type: "string", description: "\uAC80\uC0C9 \uC885\uB8CC\uC77C YYYYMMDD" },
        mealCode: { type: "string", description: "\uAE09\uC2DD \uCF54\uB4DC (1:\uC870\uC2DD, 2:\uC911\uC2DD, 3:\uC11D\uC2DD)" }
      },
      required: ["officeCode", "schoolCode"]
    },
    annotations: READ_ONLY
  }
];
var JsonRpcError = class extends Error {
  static {
    __name(this, "JsonRpcError");
  }
  constructor(code, message) {
    super(message);
    this.code = code;
  }
};
var TOOL_DEFINITIONS = [...TOOL_DEFINITIONS_BASE, ...ANALYSIS_TOOLS];
var mcpService = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(LANDING_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/health") {
      return jsonResponse({
        status: "ok",
        server: SERVER_NAME,
        runtime: "cloudflare-workers",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
    if (url.pathname !== "/mcp") {
      return jsonResponse(
        {
          status: "ok",
          server: SERVER_NAME,
          endpoint: "/mcp",
          runtime: "cloudflare-workers"
        },
        { status: url.pathname === "/" ? 200 : 404 }
      );
    }
    if (request.method === "GET") {
      return new Response("This MCP endpoint uses Streamable HTTP over POST.", {
        status: 405,
        headers: {
          ...corsHeaders(),
          allow: "POST, OPTIONS",
          "content-type": "text/plain; charset=utf-8"
        }
      });
    }
    if (request.method === "DELETE") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return jsonRpcErrorResponse(null, ERROR_CODES.INVALID_REQUEST, "Only POST is supported.", 405);
    }
    let payload;
    try {
      payload = await request.json();
    } catch (_error) {
      return jsonRpcErrorResponse(null, ERROR_CODES.PARSE_ERROR, "Invalid JSON body.");
    }
    const messages = Array.isArray(payload) ? payload : [payload];
    const responses = [];
    for (const message of messages) {
      const response = await handleMessage(message, env);
      if (response) {
        responses.push(response);
      }
    }
    if (responses.length === 0) {
      return new Response(null, {
        status: 202,
        headers: {
          ...corsHeaders(),
          "mcp-session-id": getOrCreateSessionId(request)
        }
      });
    }
    return jsonResponse(Array.isArray(payload) ? responses : responses[0], {
      headers: {
        "mcp-session-id": getOrCreateSessionId(request)
      }
    });
  }
};
async function handleMessage(message, env) {
  if (!isJsonRpcMessage(message)) {
    return jsonRpcError(null, ERROR_CODES.INVALID_REQUEST, "Invalid JSON-RPC message.");
  }
  if (message.id === void 0) {
    await handleNotification(message);
    return null;
  }
  try {
    const result = await handleRequest(message, env);
    return {
      jsonrpc: JSON_RPC_VERSION,
      id: message.id,
      result
    };
  } catch (error) {
    const code = error instanceof JsonRpcError ? error.code : ERROR_CODES.INTERNAL_ERROR;
    const messageText = error instanceof Error ? error.message : String(error);
    return jsonRpcError(message.id, code, messageText);
  }
}
__name(handleMessage, "handleMessage");
function isJsonRpcMessage(message) {
  return message && typeof message === "object" && message.jsonrpc === JSON_RPC_VERSION && typeof message.method === "string";
}
__name(isJsonRpcMessage, "isJsonRpcMessage");
async function handleNotification(message) {
  if (message.method === "notifications/initialized" || message.method?.startsWith("notifications/")) {
    return;
  }
  throw new JsonRpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unknown notification: ${message.method}`);
}
__name(handleNotification, "handleNotification");
async function handleRequest(message, env) {
  switch (message.method) {
    case "initialize":
      return initializeResult(message.params);
    case "ping":
      return {};
    case "tools/list":
      return { tools: TOOL_DEFINITIONS };
    case "tools/call":
      return callTool(message.params, env);
    case "prompts/list":
      return { prompts: listPrompts() };
    case "prompts/get": {
      const p = getPrompt(message.params?.name, message.params?.arguments || {});
      if (!p) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown prompt: ${message.params?.name}`);
      return p;
    }
    case "resources/list":
      return { resources: listResources() };
    case "resources/templates/list":
      return { resourceTemplates: [] };
    case "resources/read": {
      const r = readResource(message.params?.uri);
      if (!r) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown resource: ${message.params?.uri}`);
      return r;
    }
    default:
      throw new JsonRpcError(ERROR_CODES.METHOD_NOT_FOUND, `Unknown method: ${message.method}`);
  }
}
__name(handleRequest, "handleRequest");
function initializeResult(params = {}) {
  const requestedVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : "";
  const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.has(requestedVersion) ? requestedVersion : LATEST_PROTOCOL_VERSION;
  return {
    protocolVersion,
    capabilities: { tools: {}, prompts: {}, resources: {} },
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    instructions: SERVER_INSTRUCTIONS
  };
}
__name(initializeResult, "initializeResult");
function asText(value) {
  return { content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
__name(asText, "asText");
async function neisGet(env, endpoint, params) {
  const url = new URL(`${NEIS_BASE_URL}/${endpoint}`);
  url.searchParams.set("KEY", env.NEIS_API_KEY || "sample");
  url.searchParams.set("Type", "json");
  for (const [key, value] of Object.entries(params)) {
    if (value !== void 0 && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NEIS API HTTP ${res.status}`);
  return res.json();
}
__name(neisGet, "neisGet");
function neisResultMessage(data) {
  const r = data.RESULT;
  return r ? `NEIS: ${r.CODE} - ${r.MESSAGE}` : data;
}
__name(neisResultMessage, "neisResultMessage");
async function callTool(params, env) {
  if (!params || typeof params !== "object" || typeof params.name !== "string") {
    throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "tools/call params.name is required.");
  }
  const args = params.arguments || {};
  if (ANALYSIS_TOOL_NAMES.has(params.name)) {
    try {
      return asText(callAnalysisTool(params.name, args));
    } catch (error) {
      return { content: [{ type: "text", text: `\uC785\uB825 \uC624\uB958: ${error.message}` }], isError: true };
    }
  }
  switch (params.name) {
    case "guide":
      return asText(GUIDE_TEXT);
    case "neis_list_office_codes":
      return asText(OFFICE_CODES);
    case "neis_search_schools": {
      if (!args.officeCode) throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "officeCode is required.");
      const data = await neisGet(env, "schoolInfo", {
        ATPT_OFCDC_SC_CODE: args.officeCode,
        SCHUL_NM: args.schoolName,
        pIndex: args.pIndex ?? 1,
        pSize: Math.min(args.pSize ?? 20, 100)
      });
      if (!data.schoolInfo) return asText(neisResultMessage(data));
      return asText(data.schoolInfo[1]?.row ?? []);
    }
    case "neis_get_meals": {
      if (!args.officeCode || !args.schoolCode) {
        throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, "officeCode and schoolCode are required.");
      }
      const rows = [];
      let pIndex = 1;
      while (pIndex <= 20) {
        const data = await neisGet(env, "mealServiceDietInfo", {
          ATPT_OFCDC_SC_CODE: args.officeCode,
          SD_SCHUL_CODE: args.schoolCode,
          MLSV_YMD: args.date,
          MLSV_FROM_YMD: args.fromDate,
          MLSV_TO_YMD: args.toDate,
          MMEAL_SC_CODE: args.mealCode,
          pIndex,
          pSize: 100
        });
        if (!data.mealServiceDietInfo) return asText(neisResultMessage(data));
        const total = data.mealServiceDietInfo[0].head[0].list_total_count;
        const pageRows = data.mealServiceDietInfo[1]?.row ?? [];
        rows.push(...pageRows);
        if (pageRows.length === 0 || rows.length >= total) break;
        pIndex += 1;
      }
      return asText(rows);
    }
    default:
      throw new JsonRpcError(ERROR_CODES.INVALID_PARAMS, `Unknown tool: ${params.name}`);
  }
}
__name(callTool, "callTool");
function getOrCreateSessionId(request) {
  const existingSessionId = request.headers.get("mcp-session-id");
  return existingSessionId || crypto.randomUUID();
}
__name(getOrCreateSessionId, "getOrCreateSessionId");
function jsonRpcError(id, code, message) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    error: {
      code,
      message
    }
  };
}
__name(jsonRpcError, "jsonRpcError");
function jsonRpcErrorResponse(id, code, message, status = 400) {
  return jsonResponse(jsonRpcError(id, code, message), { status });
}
__name(jsonRpcErrorResponse, "jsonRpcErrorResponse");
function jsonResponse(body, options = {}) {
  return new Response(JSON.stringify(body), {
    status: options.status || 200,
    headers: {
      ...corsHeaders(),
      "content-type": "application/json; charset=utf-8",
      ...options.headers || {}
    }
  });
}
__name(jsonResponse, "jsonResponse");
function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id, MCP-Protocol-Version, Mcp-Session-Id",
    "access-control-expose-headers": "mcp-session-id, Mcp-Session-Id"
  };
}
__name(corsHeaders, "corsHeaders");
var publicService = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const auth = await handleAuthRoutes(request, env);
    if (auth) return auth;
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(LANDING_PAGE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok", server: SERVER_NAME, version: SERVER_VERSION, auth: "oauth2.1", runtime: "cloudflare-workers", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    return jsonResponse({ error: "not_found", endpoint: "/mcp" }, { status: 404 });
  }
};
var ORIGIN = "https://api.datapopcorn.ai";
var worker_default = new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: mcpService,
  defaultHandler: publicService,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp", "offline_access"],
  requiredScopes: ["mcp"],
  resourceMetadata: {
    resource: `${ORIGIN}/mcp`,
    authorization_servers: [ORIGIN],
    resource_name: "DataPopcorn Data MCP"
  },
  clientIdMetadataDocumentEnabled: true,
  accessTokenTTL: 3600,
  refreshTokenTTL: 60 * 60 * 24 * 30
});

// ../../../../../.aside/runtime/tmp/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../.aside/runtime/tmp/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-gT66CY/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../../../.aside/runtime/tmp/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-gT66CY/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
