"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, ShoppingCart, TrendingUp, Activity } from "lucide-react";

interface DashboardData {
  totalTenants: number;
  activeTenants: number;
  monthlyRevenue: number;
  totalSellers: number;
  totalOrders: number;
  recentTenants: {
    id: string;
    name: string;
    slug: string;
    status: string;
    createdAt: string;
    plan: { displayName: string };
    owner: { name: string; email: string };
  }[];
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  SUSPENDED: "destructive",
  EXPIRED: "secondary",
};

const statusLabel: Record<string, string> = {
  ACTIVE: "활성",
  SUSPENDED: "정지",
  EXPIRED: "만료",
};

export default function SuperAdminDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/super-admin/dashboard")
      .then((res) => res.json())
      .then((json) => { if (json.data) setData(json.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">플랫폼 운영 대시보드</h1>
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">플랫폼 운영 대시보드</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">총 테넌트</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalTenants ?? 0}</div>
            <p className="text-xs text-muted-foreground">전체 업체</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">활성 테넌트</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.activeTenants ?? 0}</div>
            <p className="text-xs text-muted-foreground">운영 중</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">이번달 매출</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(data?.monthlyRevenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">원 (구독 결제)</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">총 셀러</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalSellers ?? 0}</div>
            <p className="text-xs text-muted-foreground">명</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">총 주문</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalOrders ?? 0}</div>
            <p className="text-xs text-muted-foreground">건</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">최근 가입 테넌트</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.recentTenants.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">가입된 테넌트가 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>업체명</TableHead>
                  <TableHead>slug</TableHead>
                  <TableHead>요금제</TableHead>
                  <TableHead>대표자</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>가입일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.recentTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.name}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-500">{tenant.slug}</TableCell>
                    <TableCell className="text-sm">{tenant.plan.displayName}</TableCell>
                    <TableCell className="text-sm">{tenant.owner.name}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[tenant.status] || "outline"}>
                        {statusLabel[tenant.status] || tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">
                      {new Date(tenant.createdAt).toLocaleDateString("ko-KR")}
                    </TableCell>
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
