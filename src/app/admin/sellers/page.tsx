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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle,
  XCircle,
  Eye,
  Search,
  LinkIcon,
  Copy,
  Plus,
  Trash2,
} from "lucide-react";
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

interface Invite {
  id: string;
  code: string;
  type: "LINK" | "CODE";
  expiresAt: string | null;
  maxUses: number;
  currentUses: number;
  isActive: boolean;
  createdAt: string;
  createdBy: { name: string; email: string };
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
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
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 0,
  });

  // 초대 관리
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [newInviteType, setNewInviteType] = useState<"LINK" | "CODE">("LINK");
  const [newInviteMaxUses, setNewInviteMaxUses] = useState("");
  const [newInviteExpiry, setNewInviteExpiry] = useState("");
  const [creating, setCreating] = useState(false);

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

  const fetchInvites = useCallback(async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/admin/invites");
      const json = await res.json();
      if (res.ok) setInvites(json.data);
    } catch {
      toast.error("초대 목록을 불러오지 못했습니다");
    } finally {
      setInviteLoading(false);
    }
  }, []);

  useEffect(() => {
    if (inviteOpen) fetchInvites();
  }, [inviteOpen, fetchInvites]);

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

  const handleCreateInvite = async () => {
    setCreating(true);
    try {
      const body: Record<string, unknown> = { type: newInviteType };
      if (newInviteMaxUses) body.maxUses = Number(newInviteMaxUses);
      if (newInviteExpiry) body.expiresAt = newInviteExpiry;

      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "생성 실패");
        return;
      }

      toast.success("초대가 생성되었습니다");
      setNewInviteMaxUses("");
      setNewInviteExpiry("");
      fetchInvites();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleInvite = async (invite: Invite) => {
    try {
      const res = await fetch(`/api/admin/invites/${invite.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !invite.isActive }),
      });

      if (!res.ok) {
        toast.error("변경 실패");
        return;
      }

      toast.success(invite.isActive ? "비활성화되었습니다" : "활성화되었습니다");
      fetchInvites();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const copyToClipboard = (invite: Invite) => {
    const text =
      invite.type === "LINK"
        ? `${window.location.origin}/invite/${invite.code}`
        : invite.code;
    navigator.clipboard.writeText(text);
    toast.success("클립보드에 복사되었습니다");
  };

  const getInviteStatus = (invite: Invite) => {
    if (!invite.isActive) return { label: "비활성", variant: "secondary" as const };
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date())
      return { label: "만료됨", variant: "destructive" as const };
    if (invite.maxUses > 0 && invite.currentUses >= invite.maxUses)
      return { label: "소진", variant: "destructive" as const };
    return { label: "활성", variant: "default" as const };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">셀러 관리</h1>
        <Button onClick={() => setInviteOpen(true)}>
          <LinkIcon className="mr-2 h-4 w-4" />
          초대 코드 관리
        </Button>
      </div>

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
                    const cfg =
                      statusConfig[seller.status] || statusConfig.PENDING;
                    const feeRate =
                      seller.sellerProfile?.customFeeRate ||
                      seller.sellerProfile?.grade.feeRate;
                    return (
                      <TableRow key={seller.id}>
                        <TableCell className="font-medium">
                          {seller.name}
                        </TableCell>
                        <TableCell>
                          {seller.sellerProfile?.businessName || "-"}
                        </TableCell>
                        <TableCell>{seller.email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {seller.sellerProfile?.grade.name || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {feeRate ? `${feeRate}%` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(seller.createdAt).toLocaleDateString(
                            "ko-KR"
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            {seller.status === "PENDING" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-800"
                                  onClick={() =>
                                    handleStatusChange(seller.id, "ACTIVE")
                                  }
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-500 hover:text-red-700"
                                  onClick={() =>
                                    handleStatusChange(seller.id, "REJECTED")
                                  }
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
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page - 1,
                      }))
                    }
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
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: prev.page + 1,
                      }))
                    }
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 초대 코드 관리 다이얼로그 */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>초대 코드 관리</DialogTitle>
            <DialogDescription>
              셀러를 초대할 링크 또는 코드를 생성하고 관리합니다
            </DialogDescription>
          </DialogHeader>

          {/* 새 초대 생성 */}
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-medium text-sm">새 초대 생성</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">유형</Label>
                <Select
                  value={newInviteType}
                  onValueChange={(v) => setNewInviteType(v as "LINK" | "CODE")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LINK">링크</SelectItem>
                    <SelectItem value="CODE">코드</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">최대 사용 횟수</Label>
                <Input
                  type="number"
                  placeholder="0 = 무제한"
                  value={newInviteMaxUses}
                  onChange={(e) => setNewInviteMaxUses(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">만료일</Label>
                <Input
                  type="date"
                  value={newInviteExpiry}
                  onChange={(e) => setNewInviteExpiry(e.target.value)}
                />
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleCreateInvite}
              disabled={creating}
            >
              <Plus className="mr-1 h-4 w-4" />
              {creating ? "생성 중..." : "생성"}
            </Button>
          </div>

          {/* 초대 목록 */}
          <div className="max-h-80 overflow-y-auto">
            {inviteLoading ? (
              <div className="py-6 text-center text-gray-500">로딩 중...</div>
            ) : invites.length === 0 ? (
              <div className="py-6 text-center text-gray-500">
                생성된 초대가 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>유형</TableHead>
                    <TableHead>코드</TableHead>
                    <TableHead>사용</TableHead>
                    <TableHead>만료</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((invite) => {
                    const st = getInviteStatus(invite);
                    return (
                      <TableRow key={invite.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {invite.type === "LINK" ? "링크" : "코드"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {invite.code}
                        </TableCell>
                        <TableCell>
                          {invite.currentUses}
                          {invite.maxUses > 0 ? `/${invite.maxUses}` : ""}
                        </TableCell>
                        <TableCell className="text-sm">
                          {invite.expiresAt
                            ? new Date(invite.expiresAt).toLocaleDateString(
                                "ko-KR"
                              )
                            : "없음"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(invite)}
                              title="복사"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleInvite(invite)}
                              title={
                                invite.isActive ? "비활성화" : "활성화"
                              }
                            >
                              <Trash2
                                className={`h-4 w-4 ${
                                  invite.isActive
                                    ? "text-red-500"
                                    : "text-green-600"
                                }`}
                              />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
