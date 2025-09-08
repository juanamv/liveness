function toUint8(str: string) {
  return new TextEncoder().encode(str);
}

function base64url(input: Uint8Array): string {
  let binary = "";
  for (const b of input) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function hmac256(key: string, msg: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toUint8(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, toUint8(msg));
  return base64url(new Uint8Array(sig));
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  const parts = header.split(/;\s*/);
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i)] = decodeURIComponent(p.slice(i + 1));
  }
  return out;
}

export function serializeCookie(name: string, value: string, opts: {
  httpOnly?: boolean;
  secure?: boolean;
  path?: string;
  sameSite?: "Lax" | "Strict" | "None";
  maxAge?: number;
  expires?: Date;
} = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (opts.maxAge != null) parts.push(`Max-Age=${Math.floor(opts.maxAge)}`);
  if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
  parts.push(`Path=${opts.path ?? "/"}`);
  if (opts.httpOnly ?? true) parts.push("HttpOnly");
  if (opts.secure ?? true) parts.push("Secure");
  parts.push(`SameSite=${opts.sameSite ?? "Lax"}`);
  return parts.join("; ");
}

export async function createSessionCookie(userId: string, secret: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  const payload = `${userId}`;
  const sig = await hmac256(secret, payload);
  const value = `${payload}.${sig}`;
  return serializeCookie("session", value, { maxAge: maxAgeSeconds, httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
}

export async function verifySessionCookie(
  cookieHeader: string | null,
  secret: string
): Promise<string | null> {
  const cookies = parseCookies(cookieHeader);
  const v = cookies["session"];
  if (!v) return null;
  const idx = v.lastIndexOf(".");
  if (idx <= 0) return null;
  const userId = v.slice(0, idx);
  const sig = v.slice(idx + 1);
  const expected = await hmac256(secret, userId);
  if (sig !== expected) return null;
  return userId;
}
