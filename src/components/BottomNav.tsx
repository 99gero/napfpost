"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/hund", label: "Haustier", icon: "🐾" },
  { href: "/familie", label: "Familie", icon: "👨‍👩‍👧" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {items.map((it) => {
          const active = path.startsWith(it.href) || (it.href === "/hund" && path.startsWith("/aufgabe"));
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-xs font-bold ${active ? "text-ink" : "text-muted"}`}
              >
                <span aria-hidden className={`text-xl ${active ? "" : "opacity-60 grayscale"}`}>{it.icon}</span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
