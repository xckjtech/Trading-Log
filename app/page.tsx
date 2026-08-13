import { getCloudflareAccessUser, isTradingLogOwner } from "./auth";
import TradeJournal from "./trade-journal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user =
    process.env.NODE_ENV === "development"
      ? { displayName: "Joe", email: "local@preview", userId: "local-preview" }
      : await getCloudflareAccessUser();

  return (
    <TradeJournal
      displayName={user?.displayName ?? "访客"}
      canWrite={isTradingLogOwner(user)}
      signInHref={!user ? "/owner/login" : undefined}
      ownerSessionHref="/owner/session"
    />
  );
}
