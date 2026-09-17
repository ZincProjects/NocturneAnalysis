import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The CTF organiser screen: passcode sign-in, the session cookie, and every
 * action refusing to run without it. Supabase is replaced by a recorder, so
 * these check what would be written, not that Postgres accepts it (the ctf
 * migration's own rules are exercised against the database separately).
 */

vi.mock("server-only", () => ({}));

const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const calls: { table: string; op: string; payload?: unknown; filter?: [string, unknown] }[] = [];
function fakeTable(table: string) {
  return {
    upsert: async (payload: unknown) => (calls.push({ table, op: "upsert", payload }), { error: null }),
    update: (payload: unknown) => ({
      eq: async (column: string, value: unknown) => (
        calls.push({ table, op: "update", payload, filter: [column, value] }), { error: null }
      ),
    }),
    delete: () => ({
      eq: async (column: string, value: unknown) => (calls.push({ table, op: "delete", filter: [column, value] }), { error: null }),
    }),
  };
}
vi.mock("@/lib/supabase/admin", () => ({
  hasServiceRoleKey: () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  createAdminClient: () => ({ from: fakeTable }),
}));

import {
  adminSignIn,
  adminSignOut,
  removePlayer,
  resetPlayer,
  setChallengeActive,
  updateEvent,
} from "@/app/actions/ctf-admin";
import { adminConfigProblem, isAdmin } from "@/lib/ctf/admin";
import { sha256Hex } from "@/lib/ctf/flag";

const PASS = "organiser-test-passcode";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

async function signIn() {
  return adminSignIn({ error: null }, form({ passcode: PASS }));
}

beforeEach(() => {
  jar.clear();
  calls.length = 0;
  process.env.CTF_ADMIN_PASSCODE = PASS;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

describe("organiser configuration", () => {
  it("is switched off without a passcode of at least 8 characters, or without the service key", () => {
    expect(adminConfigProblem()).toBeNull();
    process.env.CTF_ADMIN_PASSCODE = "short";
    expect(adminConfigProblem()).toBe("no_passcode");
    process.env.CTF_ADMIN_PASSCODE = PASS;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "";
    expect(adminConfigProblem()).toBe("no_service_role");
  });
});

describe("organiser sign-in", () => {
  it("rejects a wrong passcode and sets no cookie", async () => {
    const result = await adminSignIn({ error: null }, form({ passcode: "not-the-passcode" }));
    expect(result.error).toMatch(/not right/);
    expect(jar.size).toBe(0);
    expect(await isAdmin()).toBe(false);
  });

  it("accepts the passcode without storing it in the cookie", async () => {
    expect((await signIn()).error).toBeNull();
    expect(await isAdmin()).toBe(true);
    expect([...jar.values()].join()).not.toContain(PASS);
  });

  it("ends the session when the passcode changes or on sign-out", async () => {
    await signIn();
    process.env.CTF_ADMIN_PASSCODE = "a-rotated-passcode";
    expect(await isAdmin()).toBe(false);
    process.env.CTF_ADMIN_PASSCODE = PASS;
    expect(await isAdmin()).toBe(true);
    await adminSignOut();
    expect(await isAdmin()).toBe(false);
  });

  it("does not accept a forged cookie", async () => {
    jar.set("nocturne_ctf_admin", "0".repeat(64));
    expect(await isAdmin()).toBe(false);
  });
});

describe("organiser actions", () => {
  const eventForm = (extra: Record<string, string> = {}) =>
    form({
      title: "Friday warm-up",
      starts_at: "2026-10-02T01:00:00.000Z",
      ends_at: "2026-10-02T02:30:00.000Z",
      is_active: "on",
      passcode_mode: "keep",
      ...extra,
    });

  it("refuse to run without a session", async () => {
    expect((await updateEvent({ error: null }, eventForm())).error).toMatch(/expired/);
    await expect(setChallengeActive("caesars-ghost", false)).rejects.toThrow();
    await expect(resetPlayer("p1")).rejects.toThrow();
    await expect(removePlayer("p1")).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("saves the event window as absolute instants and leaves the passcode alone by default", async () => {
    await signIn();
    const result = await updateEvent({ error: null }, eventForm());
    expect(result).toEqual({ error: null, ok: "Event saved." });
    const payload = calls[0].payload as Record<string, unknown>;
    expect(payload).toMatchObject({
      id: 1,
      title: "Friday warm-up",
      starts_at: "2026-10-02T01:00:00.000Z",
      ends_at: "2026-10-02T02:30:00.000Z",
      is_active: true,
    });
    expect(payload).not.toHaveProperty("passcode_hash");
  });

  it("stores only a hash when a passcode is set, and null when removed", async () => {
    await signIn();
    await updateEvent({ error: null }, eventForm({ passcode_mode: "set", passcode: " nightowl " }));
    expect((calls[0].payload as { passcode_hash: string }).passcode_hash).toBe(sha256Hex("nightowl"));
    await updateEvent({ error: null }, eventForm({ passcode_mode: "clear" }));
    expect((calls[1].payload as { passcode_hash: null }).passcode_hash).toBeNull();
  });

  it("pauses the event when the active box is unticked", async () => {
    await signIn();
    const data = eventForm();
    data.delete("is_active");
    await updateEvent({ error: null }, data);
    expect((calls[0].payload as { is_active: boolean }).is_active).toBe(false);
  });

  it("rejects an end before the start, missing times and short passcodes", async () => {
    await signIn();
    expect((await updateEvent({ error: null }, eventForm({ ends_at: "2026-10-02T00:00:00.000Z" }))).error).toMatch(/after the start/);
    expect((await updateEvent({ error: null }, eventForm({ starts_at: "" }))).error).toMatch(/start and an end/);
    expect((await updateEvent({ error: null }, eventForm({ passcode_mode: "set", passcode: "abc" }))).error).toMatch(/4 to 64/);
    expect(calls).toHaveLength(0);
  });

  it("toggles challenges, resets and removes players", async () => {
    await signIn();
    await setChallengeActive("caesars-ghost", false);
    await resetPlayer("player-1");
    await removePlayer("player-2");
    expect(calls).toEqual([
      { table: "ctf_challenges", op: "update", payload: { is_active: false }, filter: ["slug", "caesars-ghost"] },
      { table: "ctf_submissions", op: "delete", filter: ["player_id", "player-1"] },
      { table: "ctf_hint_reveals", op: "delete", filter: ["player_id", "player-1"] },
      { table: "ctf_players", op: "delete", filter: ["id", "player-2"] },
    ]);
  });
});
