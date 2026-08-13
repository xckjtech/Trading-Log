import {
  chatGPTSignInPath,
  getCurrentUser,
  isTradingLogOwner,
} from "./chatgpt-auth";
import TradeJournal from "./trade-journal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user =
    process.env.NODE_ENV === "development"
      ? { displayName: "Joe", email: "local@preview", userId: "local-preview", fullName: "Joe" }
      : await getCurrentUser();
  const usesCloudflareAccess = process.env.TRADING_LOG_AUTH_MODE === "cloudflare_access";

  return (
    <TradeJournal
      displayName={user?.displayName ?? "访客"}
      canWrite={isTradingLogOwner(user)}
      signInHref={!user ? (usesCloudflareAccess ? "/owner/login" : chatGPTSignInPath("/")) : undefined}
      ownerSessionHref={usesCloudflareAccess ? "/owner/session" : undefined}
    />
  );
}
