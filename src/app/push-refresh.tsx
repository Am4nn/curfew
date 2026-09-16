"use client";

import { useEffect } from "react";
import { clearBadge, refresh } from "./push";

/**
 * Two things that have to happen when the app is opened, and nowhere else.
 *
 * **Re-register the device.** iOS expires a push subscription silently. There
 * is no event, no error and no way to ask; notifications simply stop, and the
 * switch in Settings goes on reading On because the permission is still
 * granted. The only defence is to re-subscribe on every launch, which costs an
 * upsert on a primary key that has not changed.
 *
 * **Clear the badge.** The number is what was outstanding when the last
 * reminder went out. Somebody looking at the app is about to find out what is
 * actually outstanding, so the count on the icon is stale from this moment on.
 *
 * An effect is right here and is the exception the theme toggle already
 * documents: this is an external system being brought in line with state, not
 * state being derived from a render. Nothing on the page depends on either
 * result, and a failure is silent on purpose, since somebody who has already
 * granted permission has nothing to decide.
 */
export function PushRefresh({ vapidPublicKey }: { vapidPublicKey: string }) {
  useEffect(() => {
    clearBadge();
    void refresh(vapidPublicKey);
  }, [vapidPublicKey]);

  return null;
}
