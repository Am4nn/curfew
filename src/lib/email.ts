import { Resend } from "resend";
import { env } from "./env";

const resend = new Resend(env.RESEND_API_KEY);

export type EmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(input: EmailInput): Promise<string | null> {
  const { data, error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export function dashboardUrl(): string {
  return new URL("/", env.BETTER_AUTH_URL).toString();
}
