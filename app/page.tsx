import { chatGPTSignInPath, getChatGPTUser, isTradingLogOwner } from "./chatgpt-auth";
import TradeJournal from "./trade-journal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user =
    process.env.NODE_ENV === "development"
      ? { displayName: "Joe", email: "local@preview", userId: "local-preview", fullName: "Joe" }
      : await getChatGPTUser();

  return (
    <TradeJournal
      displayName={user?.displayName ?? "访客"}
      canWrite={isTradingLogOwner(user)}
      signInHref={!user ? chatGPTSignInPath("/") : undefined}
    />
  );
}
