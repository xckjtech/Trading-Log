import { getCloudflareAccessUser, isTradingLogOwner } from "../../auth";

export async function GET() {
  const user = await getCloudflareAccessUser();
  if (!user || !isTradingLogOwner(user)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, displayName: user.displayName });
}
