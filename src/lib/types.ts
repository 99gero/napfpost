import type { Completion, Schedule } from "./schedule";

export type Area = "dog" | "child" | "household" | "pet";
export type TaskKind = "feed" | "walk" | "water" | "meds" | "custom";

export type Household = { id: string; name: string; timezone: string; invite_code: string };
export type Member = { user_id: string; role: "owner" | "member"; display_name: string };
export type Dog = { id: string; household_id: string; name: string; emoji: string; sort: number };

export type Task = {
  id: string;
  household_id: string;
  area: Area;
  dog_id: string | null;
  kind: TaskKind;
  title: string;
  emoji: string;
  done_aux: string;
  done_word: string;
  sort: number;
  active: boolean;
  task_schedules: Schedule[];
};

export type TaskToken = { id: string; task_id: string; token: string; created_at: string; revoked_at: string | null };

export type { Completion, Schedule };
