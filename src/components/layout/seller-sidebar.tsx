"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  Truck,
  FileText,
  BarChart3,
  MessageSquare,
  LayoutDashboard,
  Wallet,
  Megaphone,
  Bell,
} from "lucide-react";

const menuItems = [
  { href: "/seller/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/seller/products", label: "상품 조회", icon: Package },
  { href: "/seller/orders", label: "내 주문", icon: ShoppingCart },
  { href: "/seller/claims", label: "클레임", icon: Truck },
  { href: "/seller/deposits", label: "예치금", icon: Wallet },
  { href: "/seller/settlements", label: "정산 내역", icon: FileText },
  { href: "/seller/stats", label: "내 통계", icon: BarChart3 },
  { href: "/seller/inquiries", label: "문의", icon: MessageSquare },
  { href: "/seller/notices", label: "공지사항", icon: Megaphone },
  { href: "/seller/notifications", label: "알림", icon: Bell },
];

export function SellerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-60 flex-col border-r bg-white">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/seller/dashboard" className="text-lg font-bold">
          네놈마켓 <span className="text-sm font-normal text-gray-500">셀러</span>
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
