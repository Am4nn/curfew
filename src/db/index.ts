import { drizzle as drizzleHttp, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import { env } from "@/lib/env";
import { previewEnabled } from "@/lib/preview";
import * as schema from "./schema";

// Production talks to Neon over its pooled HTTP endpoint (serverless functions
// open a connection per invocation, so never the direct URL: that is migrations
// only, see PRD 6a). Preview mode talks to a local Postgres over node-postgres
// instead, since the Neon HTTP driver cannot speak to a plain Postgres. The
// Drizzle query API is identical across both drivers, and the app uses no
// interactive transactions, so the preview handle is typed as the production
// one. previewEnabled() is false in production, so pg is imported but never
// connected there (kept out of the bundle via serverExternalPackages).
export const db: NeonHttpDatabase<typeof schema> = previewEnabled()
  ? (drizzlePg(new Pool({ connectionString: env.DATABASE_URL }), {
      schema,
    }) as unknown as NeonHttpDatabase<typeof schema>)
  : drizzleHttp(neon(env.DATABASE_URL), { schema });
