import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { isLocalStore, localPathFor, verifyLocalUrl } from "@/server/r2";
import { MAX_UPLOAD_BYTES } from "@/server/evidence";

// The LOCAL_MODE stand-in for an R2 bucket: a PUT writes the body to disk, a
// GET reads it back. Both are authorised by the same signed query presign()
// produced, so the browser code path is byte for byte the one that runs against
// the real bucket.
//
// This route refuses to exist outside LOCAL_MODE. It is a file server keyed by
// a URL parameter, which is exactly the shape of thing that must never be
// reachable in production, so the guard is first and unconditional rather than
// left to routing.

export const runtime = "nodejs";

function keyFrom(parts: string[]): string {
  return parts.map(decodeURIComponent).join("/");
}

const CONTENT_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  // Uploads are only ever webp or jpeg, but the seed writes PNG placeholders
  // so the fixture tiles show something.
  ".png": "image/png",
};

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!isLocalStore()) return new NextResponse("Not found", { status: 404 });

  const key = keyFrom((await params).key);
  const url = new URL(request.url);
  if (!verifyLocalUrl(key, "PUT", url.searchParams.get("expires"), url.searchParams.get("signature"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const file = localPathFor(key);
  if (!file) return new NextResponse("Bad key", { status: 400 });

  const body = Buffer.from(await request.arrayBuffer());
  // The same ceiling the presign was issued under. A signed URL is for one
  // object, not for one object of any size.
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return new NextResponse("Bad size", { status: 400 });
  }

  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return new NextResponse(null, { status: 200 });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!isLocalStore()) return new NextResponse("Not found", { status: 404 });

  const key = keyFrom((await params).key);
  const url = new URL(request.url);
  if (!verifyLocalUrl(key, "GET", url.searchParams.get("expires"), url.searchParams.get("signature"))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const file = localPathFor(key);
  if (!file) return new NextResponse("Bad key", { status: 400 });

  try {
    const body = await readFile(file);
    return new NextResponse(new Uint8Array(body), {
      headers: {
        "content-type": CONTENT_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
        "cache-control": "private, max-age=300",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
