"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck, TrendingUp, Wallet, AlertCircle, Megaphone } from "lucide-react";

interface DashboardData {
  totalOrders: number;
  shippingOrders: number;
  monthlySales: string;
  depositBalance: string;
  pendingClaims: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    recipientName: string;
    createdAt: string;
  }[];
  recentNotices: {
    id: string;
    title: string;
    isImportant: boolean;
    createdAt: string;
  }[];
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기", variant: "outline" },
  PREPARING: { label: "준비중", variant: "secondary" },
  SHIPPING: { label: "배송중", variant: "default" },
  DELIVERED: { label: "배송완료", variant: "default" },
  CANCELLED: { label: "취소", variant: "destructive" },
};

export default function SellerDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/seller/dashboard")
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">셀러 대시보드</h1>
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">셀러 대시보드</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">내 주문</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground">전체 주문</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">배송 중</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.shippingOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground">건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">이번달 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(data?.monthlySales || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">원</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">예치금 잔액</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(data?.depositBalance || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">원</p>
          </CardContent>
        </Card>
      </div>

      {(data?.pendingClaims ?? 0) > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="flex flex-row items-center gap-2 pb-0">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <CardTitle className="text-sm font-medium text-orange-800">
              처리 대기 중인 클레임 {data?.pendingClaims}건이 있습니다
            </CardTitle>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 주문</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentOrders.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">주문이 없습니다</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>수령자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentOrders.map((order) => {
                    const st = statusLabel[order.status] || statusLabel.PENDING;
                    return (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                        <TableCell className="text-sm">{order.recipientName}</TableCell>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-right text-sm">{Number(order.totalAmount).toLocaleString()}원</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" /> 최근 공지
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentNotices.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">공지사항이 없습니다</div>
            ) : (
              <div className="space-y-3">
                {data?.recentNotices.map((notice) => (
                  <div key={notice.id} className="flex items-start gap-2 rounded border p-3">
                    {notice.isImportant && <Badge variant="destructive" className="shrink-0 text-xs">중요</Badge>}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{notice.title}</div>
                      <div className="text-xs text-gray-500">{new Date(notice.createdAt).toLocaleDateString("ko-KR")}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
