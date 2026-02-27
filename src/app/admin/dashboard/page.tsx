"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, TrendingUp, Package, Users, AlertCircle, MessageSquare } from "lucide-react";

interface DashboardData {
  todayOrders: number;
  monthlySales: string;
  totalProducts: number;
  activeSellers: number;
  pendingClaims: number;
  pendingInquiries: number;
  recentOrders: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: string;
    recipientName: string;
    createdAt: string;
    seller: { name: string };
  }[];
  recentClaims: {
    id: string;
    type: string;
    status: string;
    reason: string;
    createdAt: string;
    order: { orderNumber: string; seller: { name: string } };
  }[];
}

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기", variant: "outline" },
  PREPARING: { label: "준비중", variant: "secondary" },
  SHIPPING: { label: "배송중", variant: "default" },
  DELIVERED: { label: "배송완료", variant: "default" },
  CANCELLED: { label: "취소", variant: "destructive" },
};

const claimTypeLabel: Record<string, string> = { RETURN: "반품", REFUND: "환불", EXCHANGE: "교환" };

export default function AdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">관리자 대시보드</h1>
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">관리자 대시보드</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">오늘 주문</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.todayOrders ?? 0}</div>
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
            <CardTitle className="text-sm font-medium">총 상품</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalProducts ?? 0}</div>
            <p className="text-xs text-muted-foreground">활성 상품</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">활성 셀러</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeSellers ?? 0}</div>
            <p className="text-xs text-muted-foreground">명</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> 미처리 클레임
            </CardTitle>
            <Badge variant="outline">{data?.pendingClaims ?? 0}건</Badge>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> 미답변 문의
            </CardTitle>
            <Badge variant="outline">{data?.pendingInquiries ?? 0}건</Badge>
          </CardHeader>
        </Card>
      </div>

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
                    <TableHead>셀러</TableHead>
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
                        <TableCell className="text-sm">{order.seller.name}</TableCell>
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
            <CardTitle className="text-base">대기중 클레임</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentClaims.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">대기중 클레임이 없습니다</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead>요청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.recentClaims.map((claim) => (
                    <TableRow key={claim.id}>
                      <TableCell className="font-mono text-xs">{claim.order.orderNumber}</TableCell>
                      <TableCell>{claimTypeLabel[claim.type] || claim.type}</TableCell>
                      <TableCell className="text-sm">{claim.order.seller.name}</TableCell>
                      <TableCell className="text-xs text-gray-500">{new Date(claim.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
