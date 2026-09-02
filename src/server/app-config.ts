import { unstable_cache, revalidateTag } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, activityTypes, groupSettings } from "@/db/schema";
import { resolveAt, resolveMoney, getActivityType, registeredKeys } from "@/domain";

// The one cached read (decision 68).
//
// Config is read on nearly every request and changes a few times a year, so it
// must never cost a round trip on a hot path. One query returns the whole
// resolved picture, wrapped in unstable_cache under the tag "app-config" with a
// 60 second TTL.
//
// Admin saves call revalidateTag("app-config"). That is what makes "immediate"
// true without polling; the TTL is only a safety net for a revalidation that
// failed to land.
//
// SCORING DOES NOT USE THIS. It resolves as of the period being scored, reading
// history directly through resolveAppSettingAt below. The cache serves the
// interface, where only "now" matters.

export const APP_CONFIG_TAG = "app-config";

export type AppSettingKey =
  | "money"
  | "photo_evidence"
  | "new_groups"
  | "invites"
  | "signups"
  | "retention_days";

// What the app does when a key has never been written. Every switch ships on
// except signups, which is invite-only until decided otherwise (decision 19).
const DEFAULTS: Record<AppSettingKey, unknown> = {
  money: true,
  photo_evidence: true,
  new_groups: true,
  invites: true,
  signups: false,
  retention_days: 30,
};

export interface AppConfig {
  settings: Record<AppSettingKey, unknown>;
  /** Type keys with a row that is currently enabled. Nothing else is offered. */
  enabledTypes: string[];
}

async function readAppConfig(): Promise<AppConfig> {
  const now = new Date();

  const [settingRows, typeRows] = await Promise.all([
    db
      .select({
        id: appSettings.id,
        key: appSettings.key,
        value: appSettings.value,
        effectiveAt: appSettings.effectiveAt,
      })
      .from(appSettings),
    db
      .select({
        id: activityTypes.id,
        typeKey: activityTypes.typeKey,
        enabled: activityTypes.enabled,
        effectiveAt: activityTypes.effectiveAt,
      })
      .from(activityTypes),
  ]);

  const settings = { ...DEFAULTS } as Record<AppSettingKey, unknown>;
  for (const key of Object.keys(DEFAULTS) as AppSettingKey[]) {
    const row = resolveAt(
      settingRows.filter((r) => r.key === key),
      now,
    );
    if (row) settings[key] = row.value;
  }

  // A type is offered only when it has a row AND that row is enabled
  // (decision 63). No row means the module exists in code but has never been
  // reconciled, so a half-finished module in a branch cannot reach anyone.
  const enabledTypes = registeredKeys().filter((key) => {
    const row = resolveAt(
      typeRows.filter((r) => r.typeKey === key),
      now,
    );
    return row?.enabled === true;
  });

  return { settings, enabledTypes };
}

const cachedAppConfig = unstable_cache(readAppConfig, ["app-config"], {
  tags: [APP_CONFIG_TAG],
  revalidate: 60,
});

/**
 * The whole resolved config, cached inside a request and read directly outside
 * one.
 *
 * unstable_cache needs Next's request store and throws without it, so scripts,
 * seeds and jobs would crash on a read that is perfectly legitimate. There is
 * no cache to consult outside a request anyway: falling back to the query is
 * the same answer, one round trip slower, in a context where that is free.
 */
export async function getAppConfig(): Promise<AppConfig> {
  try {
    return await cachedAppConfig();
  } catch {
    return readAppConfig();
  }
}

/**
 * Call after every admin save. Without it, "immediate" waits out the TTL.
 *
 * revalidateTag only works inside a request, and throws outside one. Scripts,
 * seeds and the nightly job all write settings legitimately and have no cache
 * to invalidate, so outside a request this is a no-op rather than a crash.
 */
export function invalidateAppConfig(): void {
  try {
    revalidateTag(APP_CONFIG_TAG);
  } catch {
    // No request context. Nothing is cached, so nothing needs clearing.
  }
}

// ---------------------------------------------------------------------------
// The uncached path, for scoring.

/**
 * A setting as it stood at `instant`. A period is judged against the settings
 * as they stood when the period CLOSED (decision 65), so pass the period's
 * close, never now().
 */
export async function resolveAppSettingAt(
  key: AppSettingKey,
  instant: Date,
): Promise<unknown> {
  const rows = await db
    .select({
      id: appSettings.id,
      value: appSettings.value,
      effectiveAt: appSettings.effectiveAt,
    })
    .from(appSettings)
    .where(eq(appSettings.key, key));

  return resolveAt(rows, instant)?.value ?? DEFAULTS[key];
}

/** A per-group override as it stood at `instant`, or null if never set. */
export async function resolveGroupSettingAt(
  groupId: string,
  key: string,
  instant: Date,
): Promise<unknown | null> {
  const rows = await db
    .select({
      id: groupSettings.id,
      value: groupSettings.value,
      effectiveAt: groupSettings.effectiveAt,
    })
    .from(groupSettings)
    .where(and(eq(groupSettings.groupId, groupId), eq(groupSettings.key, key)));

  return resolveAt(rows, instant)?.value ?? null;
}

/**
 * Whether a group tracks money for a period that closed at `instant`, in the
 * order app-wide, admin override, owner toggle (decision 66).
 */
export async function moneyOnFor(
  groupId: string,
  ownerToggle: boolean,
  instant: Date,
): Promise<boolean> {
  const [appWide, override] = await Promise.all([
    resolveAppSettingAt("money", instant),
    resolveGroupSettingAt(groupId, "money", instant),
  ]);

  return resolveMoney({
    appWide: appWide === true,
    groupOverride: typeof override === "boolean" ? override : null,
    ownerToggle,
  });
}

/**
 * A type the catalog may offer. Reads the cached config, so this is the
 * interface path and never the scoring one.
 */
export async function offeredTypes() {
  const { enabledTypes } = await getAppConfig();
  return enabledTypes.map((key) => getActivityType(key));
}
