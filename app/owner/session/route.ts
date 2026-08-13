import { getCurrentUser, isTradingLogOwner } from "../../chatgpt-auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!isTradingLogOwner(user)) {
    return Response.json({ authenticated: false }, { status: 401 });
  }
  return Response.json({ authenticated: true, displayName: user.displayName });
}
