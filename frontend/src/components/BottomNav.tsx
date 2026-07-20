"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/tasks", label: "TASKS" },
  { href: "/chat", label: "CHAT" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-10 bg-paper border-t border-line pb-[env(safe-area-inset-bottom)]"
      aria-label="Primary"
    >
      <ul className="flex">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 font-heading text-[0.6875rem] tracking-wide outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-inset ${
                  active ? "text-signal" : "text-text-muted"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute top-0 inset-x-6 h-0.5 bg-signal shadow-[0_0_6px_var(--signal)]" />
                )}
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
