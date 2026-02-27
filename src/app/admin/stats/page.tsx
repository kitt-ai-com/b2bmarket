"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface StatsData {
  monthlySales: { month: string; sales: number; orders: number }[];
  statusCounts: { status: string; count: number }[];
  topProducts: { productId: string; name: string; code: string; totalQuantity: number; totalSales: number }[];
  topSellers: { sellerId: string; name: string; totalSales: number; orderCount: number }[];
  comparison: {
    thisMonthSales: number;
    lastMonthSales: number;
    thisMonthOrders: number;
    lastMonthOrders: number;
    salesGrowth: string | null;
    ordersGrowth: string | null;
  };
}

const statusLabel: Record<string, string> = {
  PENDING: "대기",
  PREPARING: "준비중",
  SHIPPING: "배송중",
  DELIVERED: "배송완료",
  CANCELLED: "취소",
  RETURNED: "반품",
  EXCHANGED: "교환",
};

export default function AdminStatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">통계</h1>
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const maxSales = Math.max(...(data?.monthlySales.map((m) => m.sales) || [1]), 1);
  const totalStatusCount = data?.statusCounts.reduce((sum, s) => sum + s.count, 0) || 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">통계</h1>

      {data?.comparison && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">이번달 매출 vs 전월</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.comparison.thisMonthSales.toLocaleString()}원</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">전월: {data.comparison.lastMonthSales.toLocaleString()}원</span>
                {data.comparison.salesGrowth && (
                  <span className={`text-sm font-medium ${Number(data.comparison.salesGrowth) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {Number(data.comparison.salesGrowth) >= 0 ? "+" : ""}{data.comparison.salesGrowth}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">이번달 주문수 vs 전월</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.comparison.thisMonthOrders}건</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500">전월: {data.comparison.lastMonthOrders}건</span>
                {data.comparison.ordersGrowth && (
                  <span className={`text-sm font-medium ${Number(data.comparison.ordersGrowth) >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {Number(data.comparison.ordersGrowth) >= 0 ? "+" : ""}{data.comparison.ordersGrowth}%
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">월별 매출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.monthlySales.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">데이터가 없습니다</div>
          ) : (
            <div className="space-y-3">
              {data?.monthlySales.map((m) => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="w-20 text-sm text-gray-500 shrink-0">{m.month}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded transition-all"
                        style={{ width: `${(m.sales / maxSales) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-32 text-right shrink-0">{m.sales.toLocaleString()}원</span>
                  </div>
                  <span className="text-xs text-gray-400 w-16 text-right shrink-0">{m.orders}건</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">주문 상태별</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.statusCounts.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">데이터가 없습니다</div>
            ) : (
              <div className="space-y-2">
                {data?.statusCounts.map((s) => (
                  <div key={s.status} className="flex items-center gap-3">
                    <Badge variant="outline" className="w-20 justify-center">{statusLabel[s.status] || s.status}</Badge>
                    <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded transition-all"
                        style={{ width: `${(s.count / totalStatusCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm w-12 text-right">{s.count}건</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">상위 셀러 (매출순)</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.topSellers.length === 0 ? (
              <div className="py-4 text-center text-sm text-gray-500">데이터가 없습니다</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead className="text-right">주문수</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.topSellers.map((s, i) => (
                    <TableRow key={s.sellerId}>
                      <TableCell className="text-sm">{i + 1}</TableCell>
                      <TableCell className="text-sm font-medium">{s.name}</TableCell>
                      <TableCell className="text-right text-sm">{s.orderCount}건</TableCell>
                      <TableCell className="text-right text-sm">{s.totalSales.toLocaleString()}원</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">상위 상품 (판매 수량순)</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.topProducts.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">데이터가 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>상품코드</TableHead>
                  <TableHead>상품명</TableHead>
                  <TableHead className="text-right">판매수량</TableHead>
                  <TableHead className="text-right">매출</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.topProducts.map((p, i) => (
                  <TableRow key={p.productId}>
                    <TableCell className="text-sm">{i + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{p.code}</TableCell>
                    <TableCell className="text-sm">{p.name}</TableCell>
                    <TableCell className="text-right text-sm">{p.totalQuantity}개</TableCell>
                    <TableCell className="text-right text-sm">{p.totalSales.toLocaleString()}원</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
