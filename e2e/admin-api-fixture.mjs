import { createServer } from "node:http";

const session = "fixture-admin-session";
const csrf = "fixture-admin-csrf";
let loggedOut = false;
const evidence = {
  setCookie: [],
  authenticatedMeRequests: 0,
  logout: null,
};

function send(response, status, data, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
    "x-request-id": "req_proxy_fixture",
    ...headers,
  });
  response.end(
    JSON.stringify({
      success: status < 400,
      ...(status < 400 ? { data } : { error: data }),
      request_id: "req_proxy_fixture",
    }),
  );
}

function hasCookie(header, name, expected) {
  return header.split(";").some((part) => part.trim() === `${name}=${expected}`);
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:5000");
  if (url.pathname === "/healthz") {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("ready");
    return;
  }
  if (url.pathname === "/fixture/state") {
    send(response, 200, evidence);
    return;
  }
  if (url.pathname === "/admin/v1/auth/login" && request.method === "POST") {
    loggedOut = false;
    evidence.setCookie = [
      `hv_admin_sess=${session}; Path=/admin/v1; Max-Age=86400; Secure; HttpOnly; SameSite=Strict`,
      `hv_admin_csrf=${csrf}; Path=/; Max-Age=86400; Secure; SameSite=Strict`,
    ];
    send(
      response,
      200,
      {
        admin_user_id: "adm_fixture",
        roles: ["ROOT"],
        mfa_enrollment_required: false,
        idle_expires_at: "2026-09-24T00:00:00.000Z",
        absolute_expires_at: "2026-09-24T16:00:00.000Z",
      },
      {
        "set-cookie": evidence.setCookie,
        "x-csrf-token": csrf,
      },
    );
    return;
  }
  if (url.pathname === "/admin/v1/auth/me" && request.method === "GET") {
    if (loggedOut || !hasCookie(request.headers.cookie ?? "", "hv_admin_sess", session)) {
      send(response, 401, {
        code: "ADMIN_SESSION_EXPIRED",
        message: "Expired",
        retryable: false,
        documentation_url: "https://docs.havenerr.com/errors/ADMIN_SESSION_EXPIRED",
      });
      return;
    }
    send(
      response,
      200,
      {
        id: "adm_fixture",
        email: "operator@example.com",
        roles: ["ROOT"],
        permissions: ["*"],
        assignable_roles: [
          "ROOT",
          "PLATFORM_ADMIN",
          "SUPPORT_OPERATOR",
          "BILLING_ADMIN",
          "INFRA_ADMIN",
          "ANALYST",
        ],
        mfa_enabled: true,
        mfa_satisfied: true,
        session_id: "ase_fixture",
      },
      { "x-csrf-token": csrf },
    );
    evidence.authenticatedMeRequests += 1;
    return;
  }
  if (url.pathname === "/admin/v1/auth/logout" && request.method === "POST") {
    const sessionPresent = hasCookie(request.headers.cookie ?? "", "hv_admin_sess", session);
    const csrfCookiePresent = hasCookie(request.headers.cookie ?? "", "hv_admin_csrf", csrf);
    const csrfHeaderMatches = request.headers["x-csrf-token"] === csrf;
    evidence.logout = {
      sessionPresent,
      csrfCookiePresent,
      csrfHeaderMatches,
      cookieHeader: request.headers.cookie ?? "",
      csrfHeader: request.headers["x-csrf-token"] ?? null,
    };
    if (!sessionPresent || !csrfCookiePresent || !csrfHeaderMatches) {
      send(response, 403, {
        code: "ADMIN_CSRF_TOKEN_INVALID",
        message: "Invalid token",
        retryable: false,
        documentation_url: "https://docs.havenerr.com/errors/ADMIN_CSRF_TOKEN_INVALID",
      });
      return;
    }
    loggedOut = true;
    send(
      response,
      200,
      { logged_out: true },
      {
        "set-cookie": [
          "hv_admin_sess=; Path=/admin/v1; Max-Age=0; Secure; HttpOnly; SameSite=Strict",
          "hv_admin_csrf=; Path=/; Max-Age=0; Secure; SameSite=Strict",
        ],
      },
    );
    return;
  }
  if (url.pathname === "/admin/v1/usage" && request.method === "GET") {
    send(response, 200, {
      total_users: 1,
      total_projects: 1,
      failed_resources: 0,
      confidence: "exact",
    });
    return;
  }
  if (url.pathname === "/admin/v1/system/health" && request.method === "GET") {
    send(response, 200, {
      status: "ready",
      dependencies: { mysql: true, redis: true },
      queues: {},
      audit_chain: { healthy: true },
    });
    return;
  }
  if (url.pathname === "/admin/v1/audit" && request.method === "GET") {
    send(response, 200, { audit: [], next_cursor: null });
    return;
  }
  send(response, 404, {
    code: "ROUTE_NOT_FOUND",
    message: "Missing",
    retryable: false,
    documentation_url: "https://docs.havenerr.com/errors/ROUTE_NOT_FOUND",
  });
});

server.listen(5000, "127.0.0.1");
