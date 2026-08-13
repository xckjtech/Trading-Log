import { redirect } from "next/navigation";
import { getCloudflareAccessUser, isTradingLogOwner } from "../../auth";

export async function GET() {
  const user = await getCloudflareAccessUser();
  if (isTradingLogOwner(user)) redirect("/");
  return new Response("Cloudflare Access authentication required.", { status: 401 });
}
