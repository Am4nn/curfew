import { sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, activityTypes } from "@/db/schema";
import { resolveAt, registeredKeys, getActivityType } from "@/domain";
import { invalidateAppConfig, type AppSettingKey } from "./app-config";
import { publishNotice } from "./notices";

// What admin Controls reads and writes (decision 56). Nothing here saves on the
// flip: the screen collects pending changes, the sheet spells out what each one
// does, and this module writes them in one go.
//
// Every write is an INSERT. A switch hides a system, it never deletes anything,
// and switching back restores what was hidden.

export interface ControlsState {
  settings: Record<AppSettingKey, unknown>;
  types: { key: string; name: string; icon: string; enabled: boolean; tracking: number }[];
}

const SETTING_DEFAULTS: Record<AppSettingKey, unknown> = {
  money: true,
  photo_evidence: true,
  new_groups: true,
  invites: true,
  signups: false,
  retention_days: 30,
};

export async function getControlsState(): Promise<ControlsState> {
  const now = new Date();

  const [settingRows, typeRows, counts] = await Promise.all([
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
    // How many people track each type right now: the latest row per user per
    // type, counted where it is enabled. Written as SQL because DISTINCT ON is
    // the whole point and the builder obscures it. Admin counts behaviour and
    // never reads it (decision 60), so this is a number and nothing else.
    db.execute(sql`
      SELECT type_key, count(*)::int AS tracking
        FROM (
          SELECT DISTINCT ON (user_id, type_key) type_key, enabled
            FROM user_activities
           ORDER BY user_id, type_key, effective_at DESC, id DESC
        ) latest
       WHERE enabled
       GROUP BY type_key
    `),
  ]);

  const settings: Record<AppSettingKey, unknown> = { ...SETTING_DEFAULTS };
  for (const key of Object.keys(SETTING_DEFAULTS) as AppSettingKey[]) {
    const row = resolveAt(settingRows.filter((r) => r.key === key), now);
    if (row) settings[key] = row.value;
  }

  const countRows = (counts as unknown as { rows?: unknown[] }).rows ?? counts;
  const trackingByType = new Map(
    (countRows as { type_key: string; tracking: number }[]).map((c) => [
      c.type_key,
      Number(c.tracking),
    ]),
  );

  // Every registered module appears, because sync:activities guarantees a row
  // for each (decision 63). There is no add-a-type button: a type is code
  // (decision 82).
  const types = registeredKeys()
    .map((key) => {
      const module = getActivityType(key);
      const row = resolveAt(typeRows.filter((r) => r.typeKey === key), now);
      return {
        key,
        name: module.name,
        icon: module.icon,
        enabled: row?.enabled === true,
        tracking: trackingByType.get(key) ?? 0,
      };
    })
    .sort((a, b) => b.tracking - a.tracking || a.name.localeCompare(b.name));

  return { settings, types };
}

export interface PendingChange {
  kind: "setting" | "type";
  key: string;
  value: unknown;
}

/**
 * Apply every pending change as new rows, then invalidate the cached config so
 * "immediate" is actually immediate rather than waiting out the TTL.
 *
 * `noticeBody` is written only when the admin ticked "Tell users what changed",
 * which is unticked by default (decision 57).
 */
export async function saveControls(
  changes: PendingChange[],
  adminId: string,
  noticeBody?: string,
): Promise<void> {
  if (changes.length === 0) return;

  const settings = changes.filter((c) => c.kind === "setting");
  const types = changes.filter((c) => c.kind === "type");

  // Stamped by the application, not by the database's now().
  //
  // The two clocks are not the same. Neon in Singapore measured ~400ms ahead of
  // a laptop here, and a row the database stamps is then briefly in the FUTURE
  // as far as resolveAt is concerned, so it gets skipped. An admin who saved a
  // switch and reloaded would see nothing happen, which is the opposite of
  // "takes effect immediately". One clock for the write and the read removes
  // the race entirely, and it is the app server's, which is what invariant 8
  // means by a server timestamp.
  const effectiveAt = new Date();

  if (settings.length > 0) {
    await db.insert(appSettings).values(
      settings.map((c) => ({
        key: c.key,
        value: c.value,
        changedBy: adminId,
        effectiveAt,
      })),
    );
  }

  if (types.length > 0) {
    await db.insert(activityTypes).values(
      types.map((c) => ({
        typeKey: c.key,
        enabled: c.value === true,
        changedBy: adminId,
        effectiveAt,
      })),
    );
  }

  if (noticeBody && noticeBody.trim().length > 0) {
    await publishNotice(noticeBody.trim(), adminId);
  }

  invalidateAppConfig();
}
