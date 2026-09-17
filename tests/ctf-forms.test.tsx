import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const submitFlag = vi.fn();
const refresh = vi.fn();

vi.mock("@/app/actions/ctf", () => ({ submitFlag: (...args: unknown[]) => submitFlag(...args) }));
vi.mock("@/app/actions/ctf-admin", () => ({
  adminSignIn: vi.fn(),
  removePlayer: vi.fn(),
  resetPlayer: vi.fn(),
  setChallengeActive: vi.fn(),
  updateEvent: vi.fn(async () => ({ error: null })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EventForm } from "@/components/ctf/admin-controls";
import { FlagForm } from "@/components/ctf/flag-form";

beforeEach(() => {
  submitFlag.mockReset();
  refresh.mockReset();
});

describe("FlagForm", () => {
  it("submits on Enter and reports how many tries remain", async () => {
    const user = userEvent.setup();
    submitFlag.mockResolvedValue({ result: "incorrect", attempts_left: 3, retry_after: 0 });
    render(<FlagForm slug="caesars-ghost" initialRetryAfter={0} closed={false} />);

    await user.type(screen.getByLabelText("Submit a flag"), "flag{{guess}{Enter}");

    expect(submitFlag).toHaveBeenCalledTimes(1);
    expect(submitFlag).toHaveBeenCalledWith("caesars-ghost", "flag{guess}");
    expect(await screen.findByText(/3 more tries before a one-minute lockout/)).toBeInTheDocument();
    expect(screen.getByLabelText("Submit a flag")).toHaveValue("");
  });

  it("locks the button with a countdown after the fifth wrong guess", async () => {
    const user = userEvent.setup();
    submitFlag.mockResolvedValue({ result: "incorrect", attempts_left: 0, retry_after: 60 });
    render(<FlagForm slug="caesars-ghost" initialRetryAfter={0} closed={false} />);

    await user.type(screen.getByLabelText("Submit a flag"), "flag{{five}{Enter}");

    const button = await screen.findByRole("button", { name: /Locked \d+s/ });
    expect(button).toBeDisabled();
    await user.type(screen.getByLabelText("Submit a flag"), "flag{{six}{Enter}");
    expect(submitFlag).toHaveBeenCalledTimes(1);
  });

  it("starts locked when the page loads mid-lockout", () => {
    render(<FlagForm slug="caesars-ghost" initialRetryAfter={42} closed={false} />);
    expect(screen.getByRole("button", { name: /Locked 4[12]s/ })).toBeDisabled();
  });

  it("waits for the celebration before swapping in the solved view", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      submitFlag.mockResolvedValue({ result: "correct", points: 100, first_blood: true });
      render(<FlagForm slug="caesars-ghost" initialRetryAfter={0} closed={false} />);

      await user.type(screen.getByLabelText("Submit a flag"), "flag{{right}{Enter}");
      await act(async () => {});
      expect(refresh).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(1400));
      expect(refresh).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("is disabled once the round is over", () => {
    render(<FlagForm slug="caesars-ghost" initialRetryAfter={0} closed />);
    expect(screen.getByLabelText("Submit a flag")).toBeDisabled();
    expect(screen.getByText("Submissions are closed.")).toBeInTheDocument();
  });
});

describe("EventForm", () => {
  it("shows the stored window in local time and posts the same instants back", async () => {
    const startsAt = "2026-10-02T01:00:00.000Z";
    const endsAt = "2026-10-02T02:30:00.000Z";
    const { container } = render(
      <EventForm title="Round" startsAt={startsAt} endsAt={endsAt} isActive hasPasscode={false} />,
    );

    const local = (iso: string) => {
      const d = new Date(iso);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    expect(await screen.findByDisplayValue(local(startsAt))).toHaveAttribute("id", "event-start");
    expect(screen.getByLabelText("Ends")).toHaveValue(local(endsAt));
    expect(container.querySelector<HTMLInputElement>('input[name="starts_at"]')!.value).toBe(startsAt);
    expect(container.querySelector<HTMLInputElement>('input[name="ends_at"]')!.value).toBe(endsAt);
  });
});
