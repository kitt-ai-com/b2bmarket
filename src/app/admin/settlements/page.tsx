"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Download } from "lucide-react";
import { toast } from "sonner";

interface Settlement {
  id: string;
  sellerId: string;
  sellerName: string;
  periodStart: string;
  periodEnd: string;
  totalSales: string;
  totalFee: string;
  claimDeduct: string;
  netAmount: string;
  feeRate: string;
  status: string;
  paidAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface Seller {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기", variant: "outline" },
  CONFIRMED: { label: "확인", variant: "secondary" },
  PAID: { label: "지급완료", variant: "default" },
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "대기" },
  { value: "CONFIRMED", label: "확인" },
  { value: "PAID", label: "지급완료" },
];

export default function AdminSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [createOpen, setCreateOpen] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [creating, setCreating] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/settlements?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSettlements(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("정산 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, search]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  const openCreate = async () => {
    setSelectedSellerId("");
    setPeriodStart("");
    setPeriodEnd("");
    setCreateOpen(true);
    try {
      const res = await fetch("/api/admin/sellers?limit=100");
      const json = await res.json();
      if (res.ok) setSellers(json.data.map((s: any) => ({ id: s.id, name: s.name })));
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!selectedSellerId || !periodStart || !periodEnd) {
      toast.error("모든 항목을 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/settlements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId: selectedSellerId, periodStart, periodEnd }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "생성 실패");
        return;
      }
      toast.success("정산이 생성되었습니다");
      setCreateOpen(false);
      fetchSettlements();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (s: Settlement) => {
    setSelected(s);
    setNewStatus(s.status);
    setNotes(s.notes || "");
    setDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selected || !newStatus) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/settlements/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, notes }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "처리 실패");
        return;
      }
      toast.success("정산이 업데이트되었습니다");
      setDetailOpen(false);
      fetchSettlements();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  const fmt = (v: string) => Number(v).toLocaleString();
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">정산 관리</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const params = new URLSearchParams();
            if (statusFilter) params.set("status", statusFilter);
            window.open(`/api/admin/settlements/excel?${params}`, "_blank");
          }}>
            <Download className="mr-2 h-4 w-4" />
            엑셀 다운로드
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            정산 생성
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 flex-wrap">
              {statusTabs.map((tab) => (
                <Button
                  key={tab.value}
                  variant={statusFilter === tab.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => { setStatusFilter(tab.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="셀러명 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-44"
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
          ) : settlements.length === 0 ? (
            <div className="py-8 text-center text-gray-500">정산 내역이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead>정산기간</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                    <TableHead className="text-right">수수료</TableHead>
                    <TableHead className="text-right">지급액</TableHead>
                    <TableHead>생성일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((s) => {
                    const st = statusConfig[s.status] || statusConfig.PENDING;
                    return (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(s)}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell className="text-sm">{s.sellerName}</TableCell>
                        <TableCell className="text-xs text-gray-500">{fmtDate(s.periodStart)} ~ {fmtDate(s.periodEnd)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(s.totalSales)}원</TableCell>
                        <TableCell className="text-right text-sm text-red-500">-{fmt(s.totalFee)}원</TableCell>
                        <TableCell className="text-right text-sm font-medium">{fmt(s.netAmount)}원</TableCell>
                        <TableCell className="text-xs text-gray-500">{fmtDate(s.createdAt)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
                  <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 정산 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>정산 생성</DialogTitle>
            <DialogDescription>셀러의 기간별 정산을 생성합니다. 매출/수수료가 자동 계산됩니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>셀러 선택</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                <SelectTrigger><SelectValue placeholder="셀러를 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "생성 중..." : "생성"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 정산 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>정산 상세</DialogTitle>
            <DialogDescription>{selected?.sellerName} | {selected && fmtDate(selected.periodStart)} ~ {selected && fmtDate(selected.periodEnd)}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">매출:</span> {fmt(selected.totalSales)}원</div>
                <div><span className="text-gray-500">수수료율:</span> {Number(selected.feeRate)}%</div>
                <div><span className="text-gray-500">수수료:</span> <span className="text-red-500">-{fmt(selected.totalFee)}원</span></div>
                <div><span className="text-gray-500">클레임 공제:</span> <span className="text-red-500">-{fmt(selected.claimDeduct)}원</span></div>
                <div className="col-span-2 border-t pt-2"><span className="text-gray-500">지급액:</span> <span className="text-lg font-bold">{fmt(selected.netAmount)}원</span></div>
                {selected.paidAt && <div className="col-span-2"><span className="text-gray-500">지급일:</span> {fmtDate(selected.paidAt)}</div>}
              </div>

              <div className="space-y-2">
                <Label>상태 변경</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">대기</SelectItem>
                    <SelectItem value="CONFIRMED">확인</SelectItem>
                    <SelectItem value="PAID">지급완료</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>메모</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="메모" rows={2} />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
            <Button onClick={handleUpdate} disabled={submitting}>{submitting ? "처리 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
