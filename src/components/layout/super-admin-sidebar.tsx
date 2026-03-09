"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Shield,
} from "lucide-react";

const menuItems = [
  { href: "/super-admin/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/super-admin/tenants", label: "테넌트 관리", icon: Building2 },
  { href: "/super-admin/plans", label: "요금제 관리", icon: CreditCard },
  { href: "/super-admin/audit-logs", label: "감사 로그", icon: Shield },
];

export function SuperAdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/super-admin/dashboard" className="text-lg font-bold">
          네놈마켓 <span className="text-sm font-normal text-gray-500">운영</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-gray-100 font-medium text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
