"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { compressFrame, type Compressed } from "@/lib/compress";

// The camera: full bleed, one shutter, one close, then the frame you took with
// whatever the activity wants answered about it underneath.
//
// The frame comes off the video stream, never a file. That is what makes "live
// camera" a rule rather than a request: no File object exists here to
// substitute. Forced dark whatever the theme, because a camera screen on a pale
// background is a lamp in your face at 7 AM.
//
// One layout serves every type, and it is one sentence: the photograph takes
// every pixel the sheet does not need. That is what the three earlier drafts of
// this screen could not do. Each of them arranged controls around a single
// short number, and this screen is drawn from whatever `fields()` declares, so
// a design that only works at one field is not a design for it.
//
// Three controls, each meaning one thing, because the version before this had
// a cross and a Discard that did the same job and so neither read as anything:
//
//   the cross   leaves, and nothing is recorded
//   Retake      throws this frame away and reopens the shutter
//   Send        records the check-in
//
// A photograph you do not want is one you retake or one you walk away from.
// There was never a third thing for Discard to mean.

type State =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "denied"; message: string }
  | { kind: "captured"; shot: Compressed };

type Facing = "environment" | "user";

function RetakeIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M20 11a8 8 0 1 0-1.6 5.6" />
      <path d="M20 5v6h-6" />
    </svg>
  );
}

function SwitchIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </svg>
  );
}

export function Camera({
  title,
  closesLabel,
  nowLabel,
  maxEdge,
  quality,
  onUse,
  onClose,
  onSkip,
  useLabel = "Send",
  sheet = null,
  canUse = true,
  busy = false,
  error = null,
}: {
  title: string;
  closesLabel: string | null;
  nowLabel: string;
  maxEdge: number;
  quality: number;
  onUse: (shot: Compressed) => void;
  onClose: () => void;
  /**
   * Offered on the live view when the photo is optional, and never when it is
   * required. The camera opens on arrival now, so without this a type that
   * merely ALLOWS a photograph would be demanding one.
   */
  onSkip?: () => void;
  /** What the confirming button says. */
  useLabel?: string;
  /**
   * Whatever the module wants answered about this frame, drawn by the caller
   * from its own `fields()`. The sheet is as tall as its contents and the
   * photograph takes everything left over, which is the whole layout rule: Gym
   * declares no fields and gets an enormous photograph, Food declares one and
   * gets a slightly smaller one. Nothing here knows which is which.
   */
  sheet?: ReactNode;
  /** False while the sheet is incomplete, so Send cannot record a bad answer. */
  canUse?: boolean;
  /** The send is in flight: every control here is dead until it lands. */
  busy?: boolean;
  error?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>({ kind: "starting" });
  const [facing, setFacing] = useState<Facing>("environment");
  const [canSwitch, setCanSwitch] = useState(false);

  // Re-runs when the camera is switched. The <video> element stays mounted for
  // the whole life of this component (the still is drawn OVER it, not instead
  // of it): it used to be unmounted on capture, which left videoRef null and
  // meant Retake remounted an element nothing ever re-attached the stream to.
  // That is what made Retake hang.
  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState((prev) => (prev.kind === "captured" ? prev : { kind: "live" }));

        // Only offer the switch when there is something to switch to. Labels
        // are empty until permission is granted, which is why this runs after.
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCanSwitch(devices.filter((d) => d.kind === "videoinput").length > 1);
        }
      } catch {
        // Denied, no camera, or an in-app browser that blocks it. The rule
        // holds either way (decision 103).
        if (cancelled) return;
        setState({
          kind: "denied",
          message:
            "Curfew needs the camera for this one. A photo from your gallery cannot show when it was taken.",
        });
      }
    }

    void start();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  // Separate from the effect above, which re-runs on every switch and must not
  // kill the stream it just opened.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function shoot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    try {
      const shot = await compressFrame(video, { maxEdge, quality });
      setState({ kind: "captured", shot });
    } catch {
      // No 2d context, or the encoder refused. Unhandled before this, which
      // left the shutter looking dead.
      setState({
        kind: "denied",
        message: "That frame could not be saved. Close the camera and open it again.",
      });
    }
  }

  function retake(shot: Compressed) {
    URL.revokeObjectURL(shot.url);
    setState({ kind: "live" });
  }

  function use(shot: Compressed) {
    // The stream is stopped by the unmount effect, not here. On the fast path
    // this camera IS the check-in screen, so a failed send leaves it open and
    // Retake has to still have something to retake.
    onUse(shot);
  }

  const captured = state.kind === "captured" ? state.shot : null;

  return (
    <div
      data-theme="dark"
      className="fixed inset-0 z-50 flex flex-col bg-black font-mono text-fg"
    >
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* The video stays mounted and running underneath, so Retake is a state
          change and not a restart. It also has to stop being VISIBLE: the still
          is object-contain, so a portrait frame left the live feed playing down
          both sides of the photo just taken. This sits between the feed and
          everything else, which is why it is here and not in the block below:
          later positioned siblings paint over earlier ones, so a backdrop
          declared after the header covers the header too. */}
      {captured ? <div className="absolute inset-0 bg-black" /> : null}

      <div className="relative flex items-center justify-between p-5">
        <button
          type="button"
          onClick={onClose}
          aria-label={captured ? "Leave without recording" : "Close the camera"}
          className="text-[13px] opacity-80"
        >
          &#10005;
        </button>
        <span className="text-[11px] tracking-[0.16em] opacity-80">{title}</span>
        {captured ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => retake(captured)}
            className="flex items-center gap-[7px] text-[11.5px] opacity-80 active:opacity-50 disabled:opacity-40"
          >
            <RetakeIcon />
            Retake
          </button>
        ) : canSwitch && state.kind === "live" ? (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === "environment" ? "user" : "environment"))}
            aria-label={facing === "environment" ? "Use the front camera" : "Use the back camera"}
            className="flex opacity-80"
          >
            <SwitchIcon />
          </button>
        ) : (
          <span className="w-[18px]" />
        )}
      </div>

      {captured ? (
        <>
          {/* No margin. The photograph takes everything the sheet leaves, and
              `object-contain` keeps the whole frame visible, which is the point
              of a screen you are checking a shot on. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captured.url}
            alt="The frame you just took"
            className="relative min-h-0 flex-1 bg-black object-contain"
          />

          {/* Sized by its contents, never by a fraction of the screen. */}
          <div className="relative flex flex-none flex-col border-t border-rule bg-bg">
            <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-[14px]">
              <span className="text-[13.5px] font-semibold">{title}</span>
              <span className="text-[11px] text-muted">{nowLabel}</span>
            </div>

            {sheet ? <div className="px-5">{sheet}</div> : null}

            {error ? (
              <p className="px-5 pt-3 text-[11.5px] leading-[1.5] text-penalty">
                {error}
              </p>
            ) : null}

            <div className="px-5 pb-[22px] pt-4">
              <button
                type="button"
                disabled={busy || !canUse}
                aria-busy={busy || undefined}
                onClick={() => use(captured)}
                className={
                  "h-[52px] w-full border text-[14.5px] active:opacity-60 " +
                  (canUse
                    ? "border-fg bg-fg font-semibold text-bg disabled:opacity-40"
                    : "cursor-not-allowed border-rule bg-transparent text-muted")
                }
              >
                {busy ? "Sending" : useLabel}
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="flex-1" />

          {state.kind === "denied" ? (
            <div className="relative flex flex-col gap-4 p-5 pb-[34px]">
              <p className="text-[13px] leading-[1.55]">{state.message}</p>
              <p className="text-[11.5px] leading-[1.55] text-muted">
                Allow the camera for this site in your browser settings, then open
                this again.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="h-[46px] w-full border border-rule text-[13.5px] text-fg active:opacity-60"
              >
                Back
              </button>
            </div>
          ) : (
            <div className="relative flex flex-col items-center gap-[14px] px-5 pb-[34px]">
              {closesLabel ? (
                <span className="text-[11.5px] opacity-65">
                  Window closes {closesLabel}
                </span>
              ) : null}
              <button
                type="button"
                aria-label="Take the photo"
                disabled={state.kind !== "live"}
                onClick={shoot}
                style={{ borderRadius: "50%" }}
                className="flex h-[70px] w-[70px] items-center justify-center border-2 border-fg active:opacity-70 disabled:opacity-40"
              >
                {/* The one round thing in the app. */}
                <span style={{ borderRadius: "50%" }} className="h-[56px] w-[56px] bg-fg" />
              </button>
              {/* Only when the photograph is optional. The camera opens on
                  arrival now, so a type that merely allows one would otherwise
                  be demanding it. */}
              {onSkip ? (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-[11.5px] text-muted active:opacity-60"
                >
                  Without a photo
                </button>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  );
}
