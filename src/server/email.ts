import { dashboardUrl, type EmailInput, sendEmail } from "@/lib/email";
import { recordEvent } from "./events";

type EmailKind = "invite" | "approval" | "disabled";

type BestEffortEmail = {
  actorId: string;
  kind: EmailKind;
  email: EmailInput;
  payload: Record<string, unknown>;
};

// Email delivery is a side effect. A delivery failure never changes the result
// of the committed invite, approval, or account-removal action.
export async function sendEmailBestEffort(input: BestEffortEmail): Promise<void> {
  try {
    const emailId = await sendEmail(input.email);
    try {
      await recordEvent({
        userId: input.actorId,
        type: `email.${input.kind}.sent`,
        payload: { ...input.payload, to: input.email.to, email_id: emailId },
      });
    } catch {
      // The action has already committed and the email was sent. Do not surface
      // an event-log failure to the person taking the action.
    }
  } catch (error) {
    try {
      await recordEvent({
        userId: input.actorId,
        type: `email.${input.kind}.failed`,
        payload: {
          ...input.payload,
          to: input.email.to,
          error: error instanceof Error ? error.message : "email delivery failed",
        },
      });
    } catch {
      // Keep the side effect best-effort even if the failure record cannot write.
    }
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]!);
}

// House style, made email-safe: light paper, ink text, IBM Plex Mono falling
// back to the system monospace (email clients do not load web fonts), zero
// border radius, ruled header. Layout is table-based with inline styles because
// mail clients strip <style> and ignore modern CSS.
const INK = "#1a1917";
const PAPER = "#e8e6e1";
const SURFACE = "#dcd8d0";
const MUTED = "#5a5751";
const RULE = "#c4c0b8";
const MONO = "'IBM Plex Mono', ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace";

// The 3a Quorum mark built from table cells: three ink squares, the
// bottom-right seat left empty. Cells, not an image, so it renders in every
// mail client with no image-blocking and no SVG support needed.
function quorumMark(): string {
  const cell = (filled: boolean) =>
    `<td width="9" height="9" style="width:9px;height:9px;font-size:1px;line-height:1px;background:${filled ? INK : "transparent"};">&nbsp;</td>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:2px;">`
    + `<tr>${cell(true)}${cell(true)}</tr>`
    + `<tr>${cell(true)}${cell(false)}</tr></table>`;
}

function layout(bodyHtml: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${PAPER};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:460px;max-width:100%;font-family:${MONO};">
<tr><td style="border-bottom:2px solid ${INK};padding-bottom:10px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td valign="middle" style="padding-right:10px;">${quorumMark()}</td>
    <td valign="middle" style="font-family:${MONO};font-size:15px;font-weight:700;letter-spacing:0.18em;color:${INK};">CURFEW</td>
  </tr></table>
</td></tr>
<tr><td style="padding:22px 0 0 0;font-family:${MONO};font-size:14px;line-height:22px;color:${INK};">${bodyHtml}</td></tr>
<tr><td style="padding:24px 0 0 0;"><div style="border-top:1px solid ${RULE};padding-top:14px;font-family:${MONO};font-size:11px;line-height:18px;color:${MUTED};">Curfew is an invite-only accountability contract. You received this because someone entered your address.</div></td></tr>
</table></td></tr></table></body></html>`;
}

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="border:1px solid ${INK};"><a href="${href}" style="display:inline-block;padding:10px 18px;font-family:${MONO};font-size:13px;font-weight:600;color:${INK};text-decoration:none;">${label}</a></td></tr></table>`;
}

function line(text: string, muted = false): string {
  return `<p style="margin:0 0 10px 0;color:${muted ? MUTED : INK};">${text}</p>`;
}

// Subtle monochrome emphasis for the one word or name that carries the message:
// a surface-tone box and bold weight, no colour.
function mark(text: string): string {
  return `<span style="font-weight:700;background:${SURFACE};padding:1px 6px;color:${INK};">${text}</span>`;
}

export function groupInviteEmail(to: string, groupName: string): EmailInput {
  const url = dashboardUrl();
  const safeGroupName = escapeHtml(groupName);
  return {
    to,
    subject: "Curfew group invitation",
    text: `${groupName} invited you to Curfew. Open ${url} and sign in with Google. Once your account is approved, accept the invite from your dashboard.`,
    html: layout(
      line(`${mark(safeGroupName)} invited you to Curfew.`) +
        button(url, "Open Curfew") +
        line("Sign in with Google. Once your account is approved, accept the invite from your dashboard.", true),
    ),
  };
}

export function approvalEmail(to: string, approved: boolean): EmailInput {
  const url = dashboardUrl();
  if (approved) {
    return {
      to,
      subject: "Curfew account approved",
      text: `Your Curfew account has been approved. Open ${url} and sign in with Google.`,
      html: layout(
        line(`Your Curfew account has been ${mark("approved")}.`) +
          button(url, "Open Curfew") +
          line("Sign in with Google to continue.", true),
      ),
    };
  }
  return {
    to,
    subject: "Curfew account decision",
    text: "Your Curfew account request was not approved.",
    html: layout(line(`Your Curfew account request was ${mark("not approved")}.`)),
  };
}

export function accountDisabledEmail(to: string): EmailInput {
  return {
    to,
    subject: "Curfew access ended",
    text: "Your access to Curfew has ended. Any balance recorded before removal still stands.",
    html: layout(
      line(`Your access to Curfew has ${mark("ended")}.`) +
        line("Any balance recorded before removal still stands.", true),
    ),
  };
}
