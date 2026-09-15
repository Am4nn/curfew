"use client";

import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient();

// `useSession` came out of here too and nothing ever called it. Who is signed
// in is answered on the server, by `getSessionUser`, so a client hook for it
// would be a second answer to a question that already has one.
export const { signIn, signOut } = authClient;
