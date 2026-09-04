"use client";

import { useEffect, useRef, useState } from "react";
import { compressFrame, type Compressed } from "@/lib/compress";

// The camera: full bleed, one shutter, one close, then the frame with Retake
// and Use this photo.
//
// The frame comes off the video stream, never a file. That is what makes "live
// camera" a rule rather than a request: no File object exists here to
// substitute. Forced dark whatever the theme, because a camera screen on a pale
// background is a lamp in your face at 7 AM.

type State =
  | { kind: "starting" }
  | { kind: "live" }
  | { kind: "denied"; message: string }
  | { kind: "captured"; shot: Compressed };

type Facing = "environment" | "user";

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
}: {
  title: string;
  closesLabel: string | null;
  nowLabel: string;
  maxEdge: number;
  quality: number;
  onUse: (shot: Compressed) => void;
  onClose: () => void;
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

    start();
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
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

      <div className="relative flex items-center justify-between p-5">
        {captured ? (
          <span className="w-[18px]" />
        ) : (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the camera"
            className="text-[13px] opacity-80"
          >
            &#10005;
          </button>
        )}
        <span className="text-[11px] tracking-[0.16em] opacity-80">{title}</span>
        {captured ? (
          <span className="text-[11px] text-muted">{nowLabel}</span>
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
          {/* Drawn over the live video, which keeps running underneath so that
              Retake is a state change and not a restart. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={captured.url}
            alt="The frame you just took"
            className="relative mx-5 min-h-0 flex-1 bg-black object-contain"
          />

          <div className="relative flex gap-[10px] p-5">
            <button
              type="button"
              onClick={() => retake(captured)}
              className="h-[46px] flex-1 border border-rule bg-transparent text-[13.5px] text-fg active:opacity-60"
            >
              Retake
            </button>
            <button
              type="button"
              onClick={() => use(captured)}
              className="h-[46px] flex-[1.6] border border-fg bg-fg text-[13.5px] font-semibold text-bg active:opacity-60"
            >
              Use this photo
            </button>
          </div>

          <p className="relative px-5 pb-[30px] text-center text-[11px] leading-[1.55] text-muted">
            Nothing is recorded yet. The check-in happens when you send it.
          </p>
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
            </div>
          )}
        </>
      )}
    </div>
  );
}
