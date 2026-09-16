import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DecisionForm } from "@/components/console/decision-form";
import type { DecisionSpec } from "@/lib/content/schema";
import type { RecordedDecision } from "@/lib/session/replay";

const selectSpec: DecisionSpec = {
  key: "severity",
  prompt: "What severity do you assign?",
  type: "select",
  help_md: "Consider impact, not certainty.",
  options: [
    { value: "critical", label: "Critical", description: "Widespread impact" },
    { value: "high", label: "High", description: "Contained blast radius" },
  ],
  expected: "high",
  points: 10,
  rationale_md: "High is the right call because...",
  require_rationale: false,
};

const multiSpec: DecisionSpec = {
  ...selectSpec,
  key: "attack_techniques",
  prompt: "Which techniques?",
  type: "multi_select",
  options: [
    { value: "T1566.001", label: "T1566.001 - Spearphishing Attachment" },
    { value: "T1059.001", label: "T1059.001 - PowerShell" },
  ],
  expected: ["T1566.001", "T1059.001"],
};

describe("DecisionForm", () => {
  it("records the selected option", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DecisionForm spec={selectSpec} submitted={undefined} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText(/High/));
    await user.click(screen.getByRole("button", { name: /record decision/i }));

    expect(onSubmit).toHaveBeenCalledWith("high", undefined);
  });

  it("cannot be submitted before an option is chosen", () => {
    render(<DecisionForm spec={selectSpec} submitted={undefined} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /record decision/i })).toBeDisabled();
  });

  it("collects several values for a multi-select", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(<DecisionForm spec={multiSpec} submitted={undefined} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText(/Spearphishing Attachment/));
    await user.click(screen.getByLabelText(/PowerShell/));
    await user.click(screen.getByRole("button", { name: /record decision/i }));

    expect(onSubmit).toHaveBeenCalledWith(["T1566.001", "T1059.001"], undefined);
  });

  it("holds back submission until a required rationale is substantive", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const spec = { ...selectSpec, require_rationale: true };

    render(<DecisionForm spec={spec} submitted={undefined} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText(/High/));
    const submit = screen.getByRole("button", { name: /record decision/i });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText(/Why\?/), "too short");
    expect(submit).toBeDisabled();

    await user.type(
      screen.getByLabelText(/Why\?/),
      " but this sentence is now long enough to count",
    );
    expect(submit).toBeEnabled();

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith("high", expect.stringContaining("long enough"));
  });

  it("does not reveal whether the answer was right", async () => {
    const user = userEvent.setup();
    render(<DecisionForm spec={selectSpec} submitted={undefined} onSubmit={vi.fn()} />);

    await user.click(screen.getByLabelText(/Critical/));
    await user.click(screen.getByRole("button", { name: /record decision/i }));

    // The model answer belongs in the report, read against the whole incident -
    // not in the console, where it would be used to guess the next click.
    expect(screen.queryByText(selectSpec.rationale_md)).not.toBeInTheDocument();
    expect(screen.queryByText(/correct/i)).not.toBeInTheDocument();
  });

  it("locks an already-recorded decision", () => {
    const submitted: RecordedDecision = {
      decision_key: "severity",
      decision_value: "high",
      phase: "triage",
      submitted_at: "2025-01-01T09:00:00.000Z",
    };

    render(<DecisionForm spec={selectSpec} submitted={submitted} onSubmit={vi.fn()} />);

    expect(screen.queryByRole("button", { name: /record decision/i })).not.toBeInTheDocument();
    expect(screen.getByText(/decisions are final within a session/i)).toBeInTheDocument();
  });

  it("keeps guidance collapsed until it is asked for", async () => {
    const user = userEvent.setup();
    render(<DecisionForm spec={selectSpec} submitted={undefined} onSubmit={vi.fn()} />);

    expect(screen.queryByText(/Consider impact, not certainty/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /what should i be weighing/i }));
    expect(screen.getByText(/Consider impact, not certainty/)).toBeInTheDocument();
  });

  it("associates the prompt with the group for screen readers", () => {
    render(<DecisionForm spec={selectSpec} submitted={undefined} onSubmit={vi.fn()} />);
    expect(
      screen.getByRole("radiogroup", { name: /what severity do you assign/i }),
    ).toBeInTheDocument();
  });
});
