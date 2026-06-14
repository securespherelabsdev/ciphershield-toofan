/*
 * JWT is stored in memory only — never in localStorage or sessionStorage.
 * This prevents XSS exfiltration of the session token.
 * Consequence: session does not survive a page refresh (acceptable for v1).
 * On refresh, the user is redirected to /login with a ?reason=refresh param
 * so the login page can show an explanatory message.
 */

let _token  = null;
let _agency = null;
let _email  = null;

export function setSession(token, agency, email) {
  _token  = token;
  _agency = agency;
  _email  = email;
}

export function clearSession() {
  _token  = null;
  _agency = null;
  _email  = null;
}

export function getToken()  { return _token; }
export function getAgency() { return _agency; }
export function getEmail()  { return _email; }
export function isAuthenticated() { return !!_token; }

export async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`/api/agency${path}`, {
    ...options,
    headers,
    credentials: 'omit',
  });

  if (res.status === 401) {
    clearSession();
    window.location.href = '/portal/login?reason=expired';
    return null;
  }

  return res;
}
