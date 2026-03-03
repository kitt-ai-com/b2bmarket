"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  Truck,
  Users,
  Factory,
  FileText,
  BarChart3,
  MessageSquare,
  Bell,
  BellRing,
  Settings,
  LayoutDashboard,
  ClipboardList,
  Wallet,
} from "lucide-react";

const menuItems = [
  { href: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/admin/products", label: "상품 관리", icon: Package },
  { href: "/admin/orders", label: "주문 관리", icon: ShoppingCart },
  { href: "/admin/purchase-orders", label: "발주 관리", icon: ClipboardList },
  { href: "/admin/suppliers", label: "공급사 관리", icon: Factory },
  { href: "/admin/sellers", label: "셀러 관리", icon: Users },
  { href: "/admin/deposits", label: "예치금 관리", icon: Wallet },
  { href: "/admin/settlements", label: "정산 관리", icon: FileText },
  { href: "/admin/claims", label: "클레임 관리", icon: Truck },
  { href: "/admin/inquiries", label: "문의 관리", icon: MessageSquare },
  { href: "/admin/notices", label: "공지 관리", icon: Bell },
  { href: "/admin/notifications", label: "알림", icon: BellRing },
  { href: "/admin/stats", label: "통계", icon: BarChart3 },
  { href: "/admin/settings", label: "설정", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/admin/dashboard" className="text-lg font-bold">
          네놈마켓 <span className="text-sm font-normal text-gray-500">관리자</span>
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
