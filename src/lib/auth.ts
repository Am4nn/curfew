import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { users, sessions, accounts, verifications, userApprovals } from "@/db/schema";
import { env } from "./env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  database: drizzleAdapter(db, {
    provider: "pg",
    // Plural model names. The default is singular, which creates a table
    // called `user`, a reserved word. Ids stay TEXT (Better Auth default).
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  // Database session strategy, not JWT: events.session_id references a real
  // row and sessions can be revoked. 90-day expiry so there is no login wall
  // at 22:44 (PRD 5).
  session: {
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },

  // Google only. Email/password is deliberately not enabled: Google owns
  // password reset, and the app is invite-only via admin approval.
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Every new account starts pending. The account gate lives in
        // user_approvals, not on the user row. An admin approves by hand.
        after: async (user) => {
          await db
            .insert(userApprovals)
            .values({ userId: user.id, status: "pending" })
            .onConflictDoNothing();
        },
      },
    },
  },
});
