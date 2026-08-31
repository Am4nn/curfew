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

export function groupInviteEmail(to: string, groupName: string): EmailInput {
  const url = dashboardUrl();
  const safeGroupName = escapeHtml(groupName);
  return {
    to,
    subject: "Curfew group invitation",
    text: `${groupName} invited you to Curfew. Sign in with Google at ${url}. Once your account is approved, accept the invite from your dashboard.`,
    html: `<p>${safeGroupName} invited you to Curfew.</p><p>Sign in with Google at <a href="${url}">Curfew</a>. Once your account is approved, accept the invite from your dashboard.</p>`,
  };
}

export function approvalEmail(to: string, approved: boolean): EmailInput {
  const url = dashboardUrl();
  if (approved) {
    return {
      to,
      subject: "Curfew account approved",
      text: `Your Curfew account has been approved. Sign in with Google at ${url}.`,
      html: `<p>Your Curfew account has been approved.</p><p>Sign in with Google at <a href="${url}">Curfew</a>.</p>`,
    };
  }
  return {
    to,
    subject: "Curfew account decision",
    text: "Your Curfew account request was not approved.",
    html: "<p>Your Curfew account request was not approved.</p>",
  };
}

export function accountDisabledEmail(to: string): EmailInput {
  return {
    to,
    subject: "Curfew access ended",
    text: "Your access to Curfew has ended. Any balance recorded before removal still stands.",
    html: "<p>Your access to Curfew has ended.</p><p>Any balance recorded before removal still stands.</p>",
  };
}
