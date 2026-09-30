"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Dog, Household, Member } from "@/lib/types";

type Ctx = { userId: string; myName: string; household: Household; members: Member[]; dogs: Dog[] };
const HouseholdContext = createContext<Ctx | null>(null);

export function HouseholdProvider({ value, children }: { value: Ctx; children: ReactNode }) {
  return <HouseholdContext.Provider value={value}>{children}</HouseholdContext.Provider>;
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold außerhalb des Haushalts");
  const nameOf = (id: string | null) =>
    id === ctx.userId ? ctx.myName : ctx.members.find((m) => m.user_id === id)?.display_name ?? "Jemand";
  return { ...ctx, nameOf };
}
