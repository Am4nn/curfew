// The house button, as class names only. No hooks, no "use client": Home is a
// server component and wants the same primary and secondary as every client
// form, and a style token is not a reason to make a screen interactive.
//
// ui.tsx re-exports all of this, so a client component can keep importing from
// one place.

export type ButtonVariant = "primary" | "secondary" | "destructive" | "quiet";
export type ButtonSize = "lg" | "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "border border-fg bg-fg font-semibold text-bg",
  secondary: "border border-rule text-fg",
  destructive: "border border-rule text-penalty",
  quiet: "text-fg",
};

const SIZE: Record<ButtonSize, string> = {
  lg: "h-11 px-4 text-[14px]",
  md: "h-[38px] px-3 text-[13px]",
  sm: "h-[30px] px-[10px] text-[11.5px]",
};

// `active:` is the whole point of the pressed state: a press that is waiting on
// a round trip has to look different from one that never registered.
const BASE =
  "inline-flex items-center justify-center whitespace-nowrap active:opacity-70 " +
  "disabled:opacity-40 disabled:active:opacity-40";

export function buttonClass(
  variant: ButtonVariant = "secondary",
  size: ButtonSize = "lg",
  extra?: string,
): string {
  return [BASE, VARIANT[variant], SIZE[size], extra ?? ""].join(" ").trim();
}
