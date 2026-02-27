"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Eye, Search } from "lucide-react";
import { toast } from "sonner";

interface Seller {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
  sellerProfile: {
    id: string;
    businessName: string;
    businessNumber: string;
    bizLicenseUrl: string;
    customFeeRate: string | null;
    grade: {
      id: string;
      name: string;
      feeRate: string;
    };
  } | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "승인대기", variant: "outline" },
  ACTIVE: { label: "활성", variant: "default" },
  SUSPENDED: { label: "정지", variant: "secondary" },
  REJECTED: { label: "반려", variant: "destructive" },
};

export default function AdminSellersPage() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("page", String(pagination.page));

      const res = await fetch(`/api/admin/sellers?${params}`);
      const json = await res.json();

      if (res.ok) {
        setSellers(json.data);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("셀러 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search, pagination.page]);

  useEffect(() => {
    fetchSellers();
  }, [fetchSellers]);

  const handleStatusChange = async (sellerId: string, status: string) => {
    const actionLabel = status === "ACTIVE" ? "승인" : "반려";
    if (!confirm(`이 셀러를 ${actionLabel}하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/sellers/${sellerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "오류가 발생했습니다");
        return;
      }

      toast.success(`셀러가 ${actionLabel}되었습니다`);
      fetchSellers();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">셀러 관리</h1>

      <Tabs
        value={statusFilter}
        onValueChange={(v) => {
          setStatusFilter(v);
          setPagination((prev) => ({ ...prev, page: 1 }));
        }}
      >
        <TabsList>
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="PENDING">승인대기</TabsTrigger>
          <TabsTrigger value="ACTIVE">활성</TabsTrigger>
          <TabsTrigger value="SUSPENDED">정지</TabsTrigger>
          <TabsTrigger value="REJECTED">반려</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              셀러 목록 ({pagination.total}명)
            </CardTitle>
            <div className="flex gap-2">
              <Input
                placeholder="이름, 이메일, 상호명 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-64"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : sellers.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              조건에 맞는 셀러가 없습니다
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>상호명</TableHead>
                    <TableHead>이메일</TableHead>
                    <TableHead>등급</TableHead>
                    <TableHead>수수료</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>가입일</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((seller) => {
                    const cfg = statusConfig[seller.status] || statusConfig.PENDING;
                    const feeRate = seller.sellerProfile?.customFeeRate || seller.sellerProfile?.grade.feeRate;
                    return (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">{seller.name}</TableCell>
                        <TableCell>{seller.sellerProfile?.businessName || "-"}</TableCell>
                        <TableCell>{seller.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {seller.sellerProfile?.grade.name || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>{feeRate ? `${feeRate}%` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(seller.createdAt).toLocaleDateString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {seller.status === "PENDING" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-800"
                                  onClick={() => handleStatusChange(seller.id, "ACTIVE")}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() => handleStatusChange(seller.id, "REJECTED")}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Link href={`/admin/sellers/${seller.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  >
                    이전
                  </Button>
                  <span className="text-sm text-gray-500">
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
