import { createHash, createHmac } from "node:crypto";
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
  const url = presign({ key, method: "DELETE", expiresIn: 60, bucket });
  const response = await fetch(url, { method: "DELETE" });
  // R2 answers 204 for a delete, and also for a key that was never there.
  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed for '${key}': ${response.status}`);
  }
}
