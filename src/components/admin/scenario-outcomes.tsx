"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";

export interface ScenarioOutcomeRow {
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  attempts: number;
  averagePercent: number | null;
  medianDuration: string | null;
}

/**
 * Average score per scenario.
 *
 * Deliberately paired with a table rather than shown alone: a bar chart is
 * quick to read and useless to a screen reader, and an instructor may well need
 * the exact numbers for a moderation meeting. The table is the data; the chart
 * is the glance.
 */
export function ScenarioOutcomes({ rows }: { rows: ScenarioOutcomeRow[] }) {
  const withData = rows.filter((r) => r.averagePercent !== null);

  const chartData = withData.map((r) => ({
    name: r.title.split(":")[0],
    value: r.averagePercent ?? 0,
    difficulty: r.difficulty,
  }));

  const COLORS: Record<string, string> = {
    beginner: "var(--chart-5)",
    intermediate: "var(--chart-1)",
    advanced: "var(--chart-4)",
  };

  return (
    <div className="space-y-5">
      {chartData.length > 0 ? (
        <div className="h-56" aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                unit="%"
              />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--popover-foreground)",
                }}
                formatter={(value: number) => [`${value}%`, "Average score"]}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={COLORS[entry.difficulty] ?? "var(--chart-1)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Average score and median duration per scenario</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                Scenario
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Difficulty
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Attempts
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                Average score
              </th>
              <th scope="col" className="py-2 font-medium">
                Median time
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-b border-border/60">
                <td className="py-2 pr-4">{row.title}</td>
                <td className="py-2 pr-4">
                  <Badge variant="outline" className="capitalize">
                    {row.difficulty}
                  </Badge>
                </td>
                <td className="py-2 pr-4 tabular-nums">{row.attempts}</td>
                <td className="py-2 pr-4 tabular-nums">
                  {row.averagePercent === null ? "—" : `${row.averagePercent}%`}
                </td>
                <td className="py-2 tabular-nums">{row.medianDuration ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {withData.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No completed attempts yet. Numbers appear here once students submit.
        </p>
      ) : null}
    </div>
  );
}
