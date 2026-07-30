const USERNAME = "owner";

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AI Investment Operating System", charset="UTF-8"',
      "Cache-Control": "no-store"
    }
  });
}

function timingSafeEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function parseBasicAuth(request) {
  const header = request.headers.get("Authorization") || "";
  const [scheme, value] = header.split(" ");

  if (scheme !== "Basic" || !value) {
    return null;
  }

  try {
    const decoded = atob(value);
    const separator = decoded.indexOf(":");
    if (separator === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export default {
  async fetch(request, env) {
    const password = env.AIOS_DASHBOARD_PASSWORD;
    if (!password) {
      return new Response("Dashboard password is not configured.", {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      });
    }

    const credentials = parseBasicAuth(request);
    if (
      !credentials ||
      !timingSafeEqual(credentials.username, USERNAME) ||
      !timingSafeEqual(credentials.password, password)
    ) {
      return unauthorized();
    }

    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "private, no-store");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
