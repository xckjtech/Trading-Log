import { getCurrentUser, isTradingLogOwner } from "../../chatgpt-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isTradingLogOwner(user)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, displayName: user.displayName });
}
