/** Shapes returned by the `ctf_*` database functions (see the ctf migration). */

export type CtfCategory = "web" | "crypto" | "forensics" | "misc";

export type CtfEventStatus = "upcoming" | "live" | "ended" | "inactive" | "unscheduled";

export const CTF_CATEGORIES: { key: CtfCategory; label: string; blurb: string }[] = [
  { key: "web", label: "Web", blurb: "Recon and broken access control" },
  { key: "crypto", label: "Crypto", blurb: "Classical ciphers and XOR" },
  { key: "forensics", label: "Forensics", blurb: "Files, metadata and logs" },
  { key: "misc", label: "Misc", blurb: "Frameworks and steganography" },
];

export interface CtfEvent {
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  status: CtfEventStatus;
  requires_passcode: boolean;
  server_now: string;
}

export interface CtfChallengeSummary {
  slug: string;
  category: CtfCategory;
  title: string;
  points: number;
  hint_count: number;
  hints_revealed: number;
  solved: boolean;
  solved_at: string | null;
  attempts: number;
  solve_count: number;
  has_file: boolean;
}

export interface CtfPlayerState {
  player: {
    handle: string;
    team_name: string | null;
    score: number;
    solves: number;
    hint_cost: number;
    rank: number;
    player_count: number;
  };
  event: CtfEvent;
  challenges: CtfChallengeSummary[];
}

export interface CtfHint {
  index: number;
  cost: number;
  text: string | null;
}

export interface CtfChallengeDetail {
  slug: string;
  category: CtfCategory;
  title: string;
  points: number;
  prompt_md: string;
  file_path: string | null;
  solved: boolean;
  solved_at: string | null;
  attempts: number;
  retry_after: number;
  solve_count: number;
  explanation_md: string | null;
  hints: CtfHint[];
  event: CtfEvent;
}

export type CtfSubmitResult =
  | { result: "correct"; points: number; first_blood: boolean }
  | { result: "incorrect"; attempts_left: number; retry_after: number }
  | { result: "locked"; retry_after: number }
  | { result: "already_solved" }
  | { result: "closed" }
  | { result: "error"; message: string };

export interface CtfScoreRow {
  handle: string;
  team_name: string | null;
  score: number;
  solves: number;
  last_solve_at: string | null;
  first_bloods: number;
}

export interface CtfScoreboard {
  event: CtfEvent;
  rows: CtfScoreRow[];
  challenges: {
    title: string;
    category: CtfCategory;
    points: number;
    solves: number;
    first_blood: string | null;
    first_blood_at: string | null;
  }[];
}
