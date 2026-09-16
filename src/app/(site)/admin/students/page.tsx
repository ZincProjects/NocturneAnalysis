import type { Metadata } from "next";

import { Badge } from "@/components/ui/badge";
import { InviteStudents } from "@/components/admin/invite-students";
import { requireStaff } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Students",
  robots: { index: false, follow: false },
};

export default async function AdminStudentsPage() {
  const viewer = await requireStaff();
  const supabase = await createClient();

  const [{ data: profiles }, { data: sessions }, { data: onboarding }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, handle, display_name, cohort, role, onboarding_completed_at, created_at")
      .eq("org_id", viewer.profile.org_id)
      .order("cohort", { ascending: true }),
    supabase
      .from("sessions")
      .select("user_id, status, score, max_score")
      .eq("org_id", viewer.profile.org_id),
    supabase.from("onboarding_results").select("user_id, score, max_score"),
  ]);

  const byUser = new Map<string, { completed: number; inProgress: number; totalScore: number }>();
  for (const session of sessions ?? []) {
    const entry = byUser.get(session.user_id) ?? { completed: 0, inProgress: 0, totalScore: 0 };
    if (session.status === "in_progress") entry.inProgress += 1;
    else {
      entry.completed += 1;
      entry.totalScore += session.score ?? 0;
    }
    byUser.set(session.user_id, entry);
  }

  const onboardingByUser = new Map(
    (onboarding ?? []).map((o) => [o.user_id, `${o.score}/${o.max_score}`]),
  );

  const students = (profiles ?? []).filter((p) => p.role === "student");
  const staff = (profiles ?? []).filter((p) => p.role !== "student");

  return (
    <div className="space-y-8">
      <InviteStudents orgName={viewer.org.name} joinCode={viewer.org.join_code} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Students ({students.length})
        </h2>

        {students.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No students enrolled yet.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Handle</th>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Cohort</th>
                  <th className="py-2 pr-4 font-medium">SOC 101</th>
                  <th className="py-2 pr-4 font-medium">In progress</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 font-medium">Total score</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const stats = byUser.get(student.id);
                  return (
                    <tr key={student.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{student.handle}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{student.display_name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{student.cohort ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {onboardingByUser.get(student.id) ? (
                          <Badge variant="success">{onboardingByUser.get(student.id)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 tabular-nums">{stats?.inProgress ?? 0}</td>
                      <td className="py-2 pr-4 tabular-nums">{stats?.completed ?? 0}</td>
                      <td className="py-2 tabular-nums">{stats?.totalScore ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          Real names appear here because you are staff in this organisation. They are never shown on
          the leaderboard, in a generated report, or anywhere a student can see another
          student&apos;s record.
        </p>
      </section>

      {staff.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Staff ({staff.length})
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {staff.map((member) => (
              <li key={member.id}>
                <Badge variant="outline" className="gap-1.5">
                  {member.handle}
                  <span className="text-muted-foreground">{member.role}</span>
                </Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
