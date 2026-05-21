import { BASE_URL, TOKEN as CONFIG_TOKEN } from '../../config/config.js';

export function apiHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function login(baseUrl, email, password) {
  const res = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Login failed HTTP ${res.status}: ${body.message || JSON.stringify(body)}`
    );
  }
  if (!body.token) {
    throw new Error('Login OK but no token in response');
  }
  return body.token;
}

export async function resolveToken() {
  const email = process.env.PMS_EMAIL || process.env.LOGIN_EMAIL;
  const password = process.env.PMS_PASSWORD || process.env.LOGIN_PASSWORD;

  if (email && password) {
    return login(BASE_URL, email, password);
  }

  const probe = await fetch(`${BASE_URL}/projects`, {
    headers: apiHeaders(CONFIG_TOKEN),
  });
  if (probe.ok) {
    return CONFIG_TOKEN;
  }

  throw new Error(
    'Token in config/config.js is invalid. Refresh TOKEN or set PMS_EMAIL / PMS_PASSWORD.'
  );
}

export async function apiJson(method, path, token, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: apiHeaders(token),
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: res.ok, status: res.status, data };
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function pickId(row) {
  return row?.id ?? row?.user_id ?? row?.userId;
}
