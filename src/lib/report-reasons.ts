// Why somebody reported a photo. Here rather than in the server module so the
// report control can name them without dragging the database into the browser.
export const REPORT_REASONS = {
  nsfw: "Nudity or sexual content",
  someone_else: "Somebody else is in it, and did not agree",
  personal_info: "Personal information is visible",
  other: "Something else",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
