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

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setState({ kind: "live" });
      } catch {
        // Denied, no camera, or an in-app browser that blocks it. The rule
        // holds either way (decision 103).
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
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  async function shoot() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const shot = await compressFrame(video, { maxEdge, quality });
    setState({ kind: "captured", shot });
  }

  function retake(shot: Compressed) {
    URL.revokeObjectURL(shot.url);
    setState({ kind: "live" });
  }

  if (state.kind === "captured") {
    return (
      <div
        data-theme="dark"
        className="fixed inset-0 z-50 flex flex-col bg-black font-mono text-fg"
      >
        <div className="flex items-center justify-between p-5">
          <span className="text-[11px] tracking-[0.16em] opacity-80">{title}</span>
          <span className="text-[11px] text-muted">{nowLabel}</span>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={state.shot.url}
          alt="The frame you just took"
          className="mx-5 min-h-0 flex-1 object-contain"
        />

        <div className="flex gap-[10px] p-5">
          <button
            type="button"
            onClick={() => retake(state.shot)}
            className="h-[46px] flex-1 border border-rule bg-transparent text-[13.5px] text-fg"
          >
            Retake
          </button>
          <button
            type="button"
            onClick={() => onUse(state.shot)}
            className="h-[46px] flex-[1.6] border border-fg bg-fg text-[13.5px] font-semibold text-bg"
          >
            Use this photo
          </button>
        </div>

        <p className="px-5 pb-[30px] text-center text-[11px] leading-[1.55] text-muted">
          Nothing is recorded yet. The check-in happens when you send it.
        </p>
      </div>
    );
  }

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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close the camera"
          className="text-[13px] opacity-80"
        >
          &#10005;
        </button>
        <span className="text-[11px] tracking-[0.16em] opacity-80">{title}</span>
        <span className="w-[13px]" />
      </div>

      <div className="flex-1" />

      {state.kind === "denied" ? (
        <div className="relative flex flex-col gap-4 p-5 pb-[34px]">
          <p className="text-[13px] leading-[1.55]">{state.message}</p>
          <p className="text-[11.5px] leading-[1.55] text-muted">
            Allow the camera for this site in your browser settings, then open this
            again.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="h-[46px] w-full border border-rule text-[13.5px] text-fg"
          >
            Back
          </button>
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-[14px] px-5 pb-[34px]">
          {closesLabel ? (
            <span className="text-[11.5px] opacity-65">Window closes {closesLabel}</span>
          ) : null}
          <button
            type="button"
            aria-label="Take the photo"
            disabled={state.kind !== "live"}
            onClick={shoot}
            style={{ borderRadius: "50%" }}
            className="flex h-[70px] w-[70px] items-center justify-center border-2 border-fg disabled:opacity-40"
          >
            {/* The one round thing in the app. */}
            <span style={{ borderRadius: "50%" }} className="h-[56px] w-[56px] bg-fg" />
          </button>
        </div>
      )}
    </div>
  );
}
