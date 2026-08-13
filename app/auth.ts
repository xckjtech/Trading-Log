import { headers } from "next/headers";

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
};

const ACCESS_EMAIL_HEADER = "cf-access-authenticated-user-email";

export async function getCloudflareAccessUser(): Promise<AuthenticatedUser | null> {
  const requestHeaders = await headers();
  const email = requestHeaders.get(ACCESS_EMAIL_HEADER)?.trim().toLowerCase();
  if (!email) return null;

  return {
    userId: `access:${email}`,
    displayName: email,
    email,
  };
}

export function isTradingLogOwner(user: AuthenticatedUser | null): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const ownerEmail = process.env.TRADING_LOG_OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(user && ownerEmail && user.email === ownerEmail);
}
