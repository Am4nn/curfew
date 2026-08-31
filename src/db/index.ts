import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { env } from "@/lib/env";
import * as schema from "./schema";

// Pooled connection string. Serverless functions open a connection per
// invocation, so the app must never use the direct URL (that is migrations
// only). See PRD 6a.
const sql = neon(env.DATABASE_URL);

export const db = drizzle(sql, { schema });
