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
import { Search } from "lucide-react";
import { toast } from "sonner";

interface Claim {
  id: string;
  type: string;
  status: string;
  reason: string;
  amount: string | null;
  adminNote: string | null;
  newTrackingNo: string | null;
  processedAt: string | null;
  createdAt: string;
  order: { orderNumber: string; recipientName: string; totalAmount: string; seller: { name: string } };
}

const typeLabel: Record<string, string> = { RETURN: "반품", REFUND: "환불", EXCHANGE: "교환" };
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  REQUESTED: { label: "요청", variant: "outline" },
  APPROVED: { label: "승인", variant: "default" },
  PROCESSING: { label: "처리중", variant: "secondary" },
  COMPLETED: { label: "완료", variant: "default" },
  REJECTED: { label: "거절", variant: "destructive" },
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "REQUESTED", label: "요청" },
  { value: "APPROVED", label: "승인" },
  { value: "PROCESSING", label: "처리중" },
  { value: "COMPLETED", label: "완료" },
  { value: "REJECTED", label: "거절" },
];

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Claim | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [newTrackingNo, setNewTrackingNo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/claims?${params}`);
      const json = await res.json();
      if (res.ok) {
        setClaims(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("클레임 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, search]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const openDetail = (claim: Claim) => {
    setSelected(claim);
    setNewStatus(claim.status);
    setAdminNote(claim.adminNote || "");
    setNewTrackingNo(claim.newTrackingNo || "");
    setDetailOpen(true);
  };

  const handleUpdate = async () => {
    if (!selected || !newStatus) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/claims/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          adminNote,
          ...(selected.type === "EXCHANGE" && newTrackingNo && { newTrackingNo }),
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "처리 실패");
        return;
      }
      toast.success("클레임이 처리되었습니다");
      setDetailOpen(false);
      fetchClaims();
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">클레임 관리</h1>

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
                placeholder="주문번호, 수령자 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-52"
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
          ) : claims.length === 0 ? (
            <div className="py-8 text-center text-gray-500">클레임이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>주문번호</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>요청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => {
                    const st = statusConfig[claim.status] || statusConfig.REQUESTED;
                    return (
                      <TableRow key={claim.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(claim)}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>{typeLabel[claim.type] || claim.type}</TableCell>
                        <TableCell className="font-mono text-sm">{claim.order.orderNumber}</TableCell>
                        <TableCell>{claim.order.seller.name}</TableCell>
                        <TableCell className="max-w-48 truncate">{claim.reason}</TableCell>
                        <TableCell className="text-sm text-gray-500">{new Date(claim.createdAt).toLocaleDateString("ko-KR")}</TableCell>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>클레임 상세</DialogTitle>
            <DialogDescription>{selected?.order.orderNumber} - {selected?.order.recipientName}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">유형:</span> {typeLabel[selected.type]}</div>
                <div><span className="text-gray-500">셀러:</span> {selected.order.seller.name}</div>
                <div><span className="text-gray-500">주문금액:</span> {Number(selected.order.totalAmount).toLocaleString()}원</div>
                {selected.amount && <div><span className="text-gray-500">요청금액:</span> {Number(selected.amount).toLocaleString()}원</div>}
              </div>

              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">사유</div>
                <div className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{selected.reason}</div>
              </div>

              <div className="space-y-2">
                <Label>상태 변경</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="REQUESTED">요청</SelectItem>
                    <SelectItem value="APPROVED">승인</SelectItem>
                    <SelectItem value="PROCESSING">처리중</SelectItem>
                    <SelectItem value="COMPLETED">완료</SelectItem>
                    <SelectItem value="REJECTED">거절</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selected.type === "EXCHANGE" && (
                <div className="space-y-2">
                  <Label>교환 송장번호</Label>
                  <Input value={newTrackingNo} onChange={(e) => setNewTrackingNo(e.target.value)} placeholder="교환 재배송 송장번호 입력" />
                </div>
              )}

              <div className="space-y-2">
                <Label>관리자 메모</Label>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="처리 내용을 메모하세요" rows={3} />
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
