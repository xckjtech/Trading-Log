import { requireChatGPTUser } from "./chatgpt-auth";
import TradeJournal from "./trade-journal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user =
    process.env.NODE_ENV === "development"
      ? { displayName: "Joe", email: "local@preview", userId: "local-preview" }
      : await requireChatGPTUser("/");

  return <TradeJournal displayName={user.displayName} />;
}
