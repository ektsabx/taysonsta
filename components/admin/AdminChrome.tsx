"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import type { NavGroup } from "@/lib/bos/nav";
import type { ClockProps } from "@/components/bos/ClockWidget";
import type { BosLocale, BosTheme } from "@/lib/bos/i18n/core";

const COLLAPSE_KEY = "admin-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

interface AdminChromeProps {
  name: string;
  ui: { locale: BosLocale; theme: BosTheme };
  email: string;
  roleNames: string[];
  navigation: NavGroup[];
  unreadNotifications: number;
  clock: ClockProps | null;
  systemTime: { ms: number; timezone: string };
  children: ReactNode;
}

export function AdminChrome({ name, ui, email, roleNames, navigation, unreadNotifications, clock, systemTime, children }: AdminChromeProps) {
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // ignore storage access issues
      }
      return next;
    });
  }

  return (
    <div className="admin-layout">
      <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} navigation={navigation} />
      <div className="admin-content-col">
        <AdminHeader
          name={name}
          ui={ui}
          email={email}
          roleNames={roleNames}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onToggleMobile={() => setMobileOpen((v) => !v)}
          unreadNotifications={unreadNotifications}
          clock={clock}
          systemTime={systemTime}
        />
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
