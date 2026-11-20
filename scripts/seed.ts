import { grantCredits } from "../src/server/credits";
import { getDb } from "../src/server/db";
import { hashPassword, newId } from "../src/server/ids";
import { createProject } from "../src/server/projects";

const email = (process.env.DEMO_USER_EMAIL || "demo@narrator.local").toLowerCase();
const password = process.env.DEMO_USER_PASSWORD || "narrator-demo-pass";
const db = getDb();
const existing = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email) as { id: string } | undefined;
if (existing) {
  console.log(`Seed user already exists: ${email}`);
  process.exit(0);
}

const now = Date.now();
const userId = newId();
const periodEnd = now + 30 * 24 * 60 * 60 * 1000;
db.prepare(
  `INSERT INTO users (
    id, email, password_hash, email_verified_at, created_at, plan, plan_status, plan_period_end, auto_spend, chargeback_frozen, free_grant_issued
  ) VALUES (?, ?, ?, ?, ?, 'maker', 'active', ?, 0, 0, 1)`,
).run(userId, email, hashPassword(password), now, now - 48 * 60 * 60 * 1000, periodEnd);

grantCredits(db, {
  userId,
  kind: "plan",
  millicredits: 500_000,
  expiresAt: periodEnd,
  sourceId: `seed:maker:${userId}`,
  now,
});

const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(userId) as Parameters<typeof createProject>[1];
await createProject(db, user, {
  brief: "A cat runs down a wet hill at dusk, stops under a street lamp, and listens to the town go quiet.",
  aspect: "16:9",
  look: { filmStock: "35mm", grade: "warm", lensFamily: "spherical", lighting: "practical night" },
});

console.log(`Seeded ${email} / ${password}`);
console.log("Local demo only. Do not run this against a production database.");
