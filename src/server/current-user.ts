import { cookies } from "next/headers";
import { userFromSession, type UserRow } from "./auth";
import { getDb } from "./db";

export async function currentUser(): Promise<UserRow | null> {
  const jar = await cookies();
  return userFromSession(getDb(), jar.get("narrator_session")?.value ?? null);
}
