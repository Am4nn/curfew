"use client";

import { useState } from "react";
import { ActivityIcon } from "@/app/activity-icon";
import { PhotoViewer } from "@/app/photo-viewer";
import { ReportButton } from "./report-button";

/**
 * One day's photographs in a group, and the way to see any of them whole.
 *
 * The tiles were cropped squares and nothing opened, so a member's evidence
 * could be looked at only at 150 pixels: the one place in the app where seeing
 * the picture is the entire point. The grid holds the viewer for the day it
 * draws, so the arrows move within the day rather than across the whole log,
 * which is what the headings above them promise.
 */

export interface EvidenceCard {
  id: number;
  url: string;
  who: string;
  typeName: string;
  icon: string;
  /** Already in the viewer's zone, formatted by the server (invariant 8). */
  timeLabel: string;
  mine: boolean;
}

export function EvidenceGrid({
  items,
  groupId,
}: {
  items: EvidenceCard[];
  groupId: string;
}) {
  const [at, setAt] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={item.id} className="flex flex-col gap-[6px]">
            <button
              type="button"
              onClick={() => setAt(i)}
              aria-label={`Open ${item.who}, ${item.typeName}`}
              className="active:opacity-70"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={`${item.who}, ${item.typeName}`}
                className="aspect-square w-full border border-rule bg-surface object-cover"
              />
            </button>
            <div className="flex items-center justify-between gap-[6px]">
              <span className="text-[11px]">{item.who}</span>
              <span className="text-[10px] text-muted">{item.timeLabel}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-[5px] text-[10px] text-muted">
                <ActivityIcon name={item.icon} size={11} />
                {item.typeName}
              </span>
              {item.mine ? null : (
                <ReportButton evidenceId={item.id} groupId={groupId} who={item.who} />
              )}
            </div>
          </div>
        ))}
      </div>
      <PhotoViewer
        photos={items.map((item) => ({
          url: item.url,
          alt: `${item.who}, ${item.typeName}`,
          caption: `${item.who} · ${item.typeName} · ${item.timeLabel}`,
        }))}
        at={at}
        onClose={() => setAt(null)}
        onMove={setAt}
      />
    </>
  );
}
