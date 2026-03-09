"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  displayName: string;
}

interface TenantListItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  plan: Plan;
  _count: { users: number; products: number; orders: number };
}

interface TenantDetail {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  plan: {
    id: string;
    name: string;
    displayName: string;
    maxSellers: number;
    maxMonthlyOrders: number;
    maxProducts: number;
    maxDailyAiChats: number;
  };
  _count: { users: number; products: number; orders: number };
  usage: { monthlyOrders: number; totalAiChats: number };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

export default function SuperAdminTenantsPage() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [selectedTenant, setSelectedTenant] = useState<TenantDetail | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [editPlanId, setEditPlanId] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTenants = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("search", search);
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/super-admin/tenants?${params}`);
      const json = await res.json();
      if (json.data) setTenants(json.data);
      if (json.pagination) setPagination(json.pagination);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchTenants(1);
  }, [fetchTenants]);

  useEffect(() => {
    fetch("/api/super-admin/plans")
      .then((res) => res.json())
      .then((json) => { if (json.data) setPlans(json.data); })
      .catch(() => {});
  }, []);

  const openDetail = async (tenantId: string) => {
    setDialogOpen(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}`);
      const json = await res.json();
      if (json.data) {
        setSelectedTenant(json.data);
        setEditPlanId(json.data.plan.id);
        setEditStatus(json.data.status);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedTenant) return;
    setSaving(true);
    try {
      const body: Record<string, string> = {};
      if (editPlanId !== selectedTenant.plan.id) body.planId = editPlanId;
      if (editStatus !== selectedTenant.status) body.status = editStatus;

      if (Object.keys(body).length === 0) {
        setDialogOpen(false);
        return;
      }

      const res = await fetch(`/api/super-admin/tenants/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setDialogOpen(false);
        fetchTenants(pagination.page);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">테넌트 관리</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">검색 및 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="업체명 또는 slug 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") fetchTenants(1); }}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">전체 상태</SelectItem>
                <SelectItem value="ACTIVE">활성</SelectItem>
                <SelectItem value="SUSPENDED">정지</SelectItem>
                <SelectItem value="EXPIRED">만료</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => fetchTenants(1)}>검색</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-gray-500">로딩 중...</div>
          ) : tenants.length === 0 ? (
            <div className="py-12 text-center text-gray-500">테넌트가 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>업체명</TableHead>
                    <TableHead>slug</TableHead>
                    <TableHead>요금제</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">셀러수</TableHead>
                    <TableHead className="text-right">상품수</TableHead>
                    <TableHead className="text-right">주문수</TableHead>
                    <TableHead>가입일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow
                      key={tenant.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => openDetail(tenant.id)}
                    >
                      <TableCell className="font-medium">{tenant.name}</TableCell>
                      <TableCell className="font-mono text-xs text-gray-500">{tenant.slug}</TableCell>
                      <TableCell className="text-sm">{tenant.plan.displayName}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[tenant.status] || "outline"}>
                          {statusLabel[tenant.status] || tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{tenant._count.users}</TableCell>
                      <TableCell className="text-right">{tenant._count.products}</TableCell>
                      <TableCell className="text-right">{tenant._count.orders}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(tenant.createdAt).toLocaleDateString("ko-KR")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-gray-500">
                    총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page <= 1}
                      onClick={() => fetchTenants(pagination.page - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      {pagination.page} / {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => fetchTenants(pagination.page + 1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>테넌트 상세</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : selectedTenant ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">업체명</span>
                  <p className="font-medium">{selectedTenant.name}</p>
                </div>
                <div>
                  <span className="text-gray-500">slug</span>
                  <p className="font-mono text-xs">{selectedTenant.slug}</p>
                </div>
                <div>
                  <span className="text-gray-500">대표자</span>
                  <p>{selectedTenant.owner.name} ({selectedTenant.owner.email})</p>
                </div>
                <div>
                  <span className="text-gray-500">가입일</span>
                  <p>{new Date(selectedTenant.createdAt).toLocaleDateString("ko-KR")}</p>
                </div>
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <h3 className="text-sm font-medium">사용량 상세</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">셀러 수</span>
                    <p>{selectedTenant._count.users} / {selectedTenant.plan.maxSellers}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">상품 수</span>
                    <p>{selectedTenant._count.products} / {selectedTenant.plan.maxProducts}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">이번 달 주문수</span>
                    <p>{selectedTenant.usage.monthlyOrders} / {selectedTenant.plan.maxMonthlyOrders}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">AI 채팅 사용량 (이번 달)</span>
                    <p>{selectedTenant.usage.totalAiChats}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium">요금제 변경</label>
                  <Select value={editPlanId} onValueChange={setEditPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="요금제 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">상태 변경</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">활성</SelectItem>
                      <SelectItem value="SUSPENDED">정지</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
