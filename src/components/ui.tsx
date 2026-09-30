import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Logo({ small }: { small?: boolean }) {
  return (
    <span className={`flex items-center gap-2.5 font-display ${small ? "text-lg" : "text-xl"} text-ink`}>
      <i aria-hidden className="relative block size-[26px] rounded-full border-2 border-ink bg-tag">
        <i className="absolute inset-[4px] rounded-full border-[1.5px] border-coil" />
      </i>
      Napfpost
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[22px] border border-line bg-card/90 p-5 shadow-[0_20px_50px_-28px_var(--shadow)] backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function Button({ variant = "solid", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "solid" | "ghost" | "danger" }) {
  const styles = {
    solid: "bg-ink text-on-ink border-ink",
    ghost: "bg-transparent text-ink border-ink",
    danger: "bg-transparent text-warn border-warn",
  }[variant];
  return (
    <button
      {...p}
      className={`inline-flex items-center justify-center gap-2 rounded-full border-2 px-5 py-3 font-extrabold disabled:opacity-50 ${styles} ${className}`}
    />
  );
}

export function Field({ label, id, className = "", ...p }: InputHTMLAttributes<HTMLInputElement> & { label: string; id: string }) {
  return (
    <label htmlFor={id} className="grid gap-1.5">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        id={id}
        {...p}
        className={`w-full min-w-0 rounded-2xl border-[1.5px] border-line bg-card px-4 py-3 text-base text-ink outline-none focus:border-ink ${className}`}
      />
    </label>
  );
}

export function Chip({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-line bg-card px-2.5 py-1.5 font-mono text-[0.74rem] font-semibold leading-none text-muted ${className}`}>
      {children}
    </span>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="rounded-2xl border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-warn">{children}</p>;
}
