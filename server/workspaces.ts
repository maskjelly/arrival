import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Store } from './store.ts';
import { defaultQuestions, credential } from './store.ts';
const scrypt = promisify(scryptCallback);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString('hex')}`;
}
export async function passwordMatches(password: string, stored: string) {
  const [salt, value] = stored.split(':');
  if (!salt || !value) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(value, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export async function createWorkspace(
  store: Store,
  input: { name: string; origin: string; slug: string; password: string },
  existingSiteId?: string,
) {
  const siteId = existingSiteId ?? `site_${credential().slice(0, 18)}`;
  const encoded = await passwordHash(input.password);
  if (!existingSiteId)
    await store.db
      .prepare('INSERT INTO sites(id,name,origin,questions_version,questions) VALUES(?,?,?,?,?)')
      .run(siteId, input.name, new URL(input.origin).origin, 1, JSON.stringify(defaultQuestions));
  try {
    await store.db
      .prepare('INSERT INTO workspaces(site_id,slug,password_hash,created_at) VALUES(?,?,?,?)')
      .run(siteId, input.slug, encoded, new Date().toISOString());
  } catch (error) {
    if (!existingSiteId) await store.db.prepare('DELETE FROM sites WHERE id=?').run(siteId);
    throw error;
  }
  await store.db
    .prepare("INSERT OR IGNORE INTO entry_policies(site_id,mode) VALUES(?,'ask')")
    .run(siteId);
  return store.withSite(siteId, async () => ({
    site: await store.site(),
    key: await store.rotateKey(),
  }));
}
