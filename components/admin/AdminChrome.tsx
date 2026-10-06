"use client";

import { useState, type ReactNode } from "react";
import { COLLAPSE_COOKIE } from "@/lib/admin/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import type { NavGroup } from "@/lib/bos/nav";
import type { ClockProps } from "@/components/bos/ClockWidget";
import type { BosLocale, BosTheme } from "@/lib/bos/i18n/core";


interface AdminChromeProps {
  name: string;
  ui: { locale: BosLocale; theme: BosTheme };
  email: string;
  roleNames: string[];
  navigation: NavGroup[];
  unreadNotifications: number;
  clock: ClockProps | null;
  systemTime: { ms: number; timezone: string };
  initialCollapsed: boolean;
  children: ReactNode;
}

export function AdminChrome({ name, ui, email, roleNames, navigation, unreadNotifications, clock, systemTime, initialCollapsed, children }: AdminChromeProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `${COLLAPSE_COOKIE}=${next ? "1" : "0"}; path=/admin; max-age=31536000; samesite=lax`;
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
