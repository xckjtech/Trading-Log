import { redirect } from "next/navigation";
import { getCurrentUser, isTradingLogOwner } from "../../chatgpt-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (isTradingLogOwner(user)) redirect("/");
  return new Response("Owner sign-in is not available yet.", { status: 401 });
}
