import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { required } from "@/lib/env";

// Cloudflare R2, evidence photos (decision 71). No image ever passes through a
// serverless function: the browser PUTs straight to R2 with a presigned URL,
// and reads are short-lived presigned GETs issued only to people entitled to
// see the photo.
//
// Presigning is a pure string operation, so this is hand-rolled SigV4 rather
// than the AWS SDK. It is about sixty lines against a megabyte of dependency
// that would run on every cold start, and there is nothing else here we would
// use it for.
//
// LOCAL_MODE swaps the whole thing for a directory on disk. `.env.local` has no
// R2 credentials by convention, so before this existed every local upload threw
// inside presign(), the route answered 500 with HTML, and the check-in screen
// reported "Network failed" for what was really a missing key. Evidence could
// not be exercised locally at all, which is how three camera bugs survived to
// be found by hand. The stub keeps the shape exactly: a URL the browser PUTs
// to, a URL it GETs from, and a delete. Everything above it, the pending row,
// the confirm and the orphan sweep included, runs unchanged.

const LOCAL = process.env.LOCAL_MODE === "1";

/** Where LOCAL_MODE keeps objects. Gitignored, wiped by hand. */
export const LOCAL_STORE = path.join(process.cwd(), ".r2-local");

/**
 * Object keys we will touch on disk. Deliberately narrower than R2 would
 * accept: no dot segments, so a key can never climb out of LOCAL_STORE.
 */
const LOCAL_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

export function isLocalStore(): boolean {
  return LOCAL;
}

/** Resolve a key to a path inside LOCAL_STORE, or null if it is not one. */
export function localPathFor(key: string): string | null {
  if (!LOCAL_KEY.test(key) || key.includes("..")) return null;
  const full = path.join(LOCAL_STORE, key);
  const root = path.resolve(LOCAL_STORE);
  return path.resolve(full).startsWith(root + path.sep) ? full : null;
}

function localSignature(key: string, method: string, expires: number): string {
  return createHmac("sha256", required("BETTER_AUTH_SECRET"))
    .update(`${method}\n${key}\n${expires}`)
    .digest("hex");
}

/**
 * The local stand-in for a presigned URL. Relative, so it resolves against
 * whatever origin the page is on and no base URL has to be configured.
 */
function localUrl(key: string, method: string, expiresIn: number): string {
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = localSignature(key, method, expires);
  return `/api/evidence/local/${encodePath(key)}?expires=${expires}&signature=${signature}`;
}

/** Whether a local URL's query still authorises this key and method. */
export function verifyLocalUrl(
  key: string,
  method: string,
  expires: string | null,
  signature: string | null,
): boolean {
  if (!LOCAL || !expires || !signature) return false;
  const at = Number(expires);
  if (!Number.isFinite(at) || at * 1000 < Date.now()) return false;
  const expected = Buffer.from(localSignature(key, method, at), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const SERVICE = "s3";
const REGION = "auto"; // R2 has one region name for signing, whatever the bucket.

const sha256 = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");

const hmac = (key: Buffer, data: string) =>
  createHmac("sha256", key).update(data).digest();

// Every path segment is encoded, but the separators are not.
const encodePath = (path: string) =>
  path.split("/").map(encodeURIComponent).join("/");

const encodeQuery = (params: Record<string, string>) =>
  Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join("&");

function signingKey(secret: string, date: string): Buffer {
  const k = hmac(Buffer.from(`AWS4${secret}`, "utf8"), date);
  return hmac(hmac(hmac(k, REGION), SERVICE), "aws4_request");
}

/**
 * A presigned URL for one object. PUT to upload, GET to read, DELETE to sweep.
 * `expiresIn` is seconds and must stay short: these URLs are bearer tokens for
 * a single object, so a leaked one is only useful for as long as it lives.
 */
export function presign(options: {
  key: string;
  method: "PUT" | "GET" | "DELETE";
  expiresIn: number;
  bucket?: string;
}): string {
  const { key, method, expiresIn } = options;
  if (LOCAL) return localUrl(key, method, expiresIn);

  const bucket = options.bucket ?? required("R2_BUCKET");
  const accessKeyId = required("R2_ACCESS_KEY_ID");
  const secretAccessKey = required("R2_SECRET_ACCESS_KEY");
  const endpoint = new URL(required("R2_ENDPOINT"));

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const credential = `${accessKeyId}/${date}/${REGION}/${SERVICE}/aws4_request`;
  const canonicalUri = `/${encodePath(bucket)}/${encodePath(key)}`;

  const query = encodeQuery({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": credential,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-SignedHeaders": "host",
  });

  const canonicalRequest = [
    method,
    canonicalUri,
    query,
    `host:${endpoint.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    `${date}/${REGION}/${SERVICE}/aws4_request`,
    sha256(canonicalRequest),
  ].join("\n");

  const signature = createHmac("sha256", signingKey(secretAccessKey, date))
    .update(stringToSign)
    .digest("hex");

  return `${endpoint.origin}${canonicalUri}?${query}&X-Amz-Signature=${signature}`;
}

/** Delete one object. Used by the nightly retention and orphan sweeps. */
export async function deleteObject(key: string, bucket?: string): Promise<void> {
  if (LOCAL) {
    const file = localPathFor(key);
    if (!file) throw new Error(`refusing to delete an unsafe key: '${key}'`);
    // Missing is success, the same as R2's 404 below.
    await (await import("node:fs/promises")).rm(file, { force: true });
    return;
  }

  const url = presign({ key, method: "DELETE", expiresIn: 60, bucket });
  const response = await fetch(url, { method: "DELETE" });
  // R2 answers 204 for a delete, and also for a key that was never there.
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed for '${key}': ${response.status}`);
  }
}
