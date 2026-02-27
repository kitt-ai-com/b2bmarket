"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Claim {
  id: string;
  type: string;
  status: string;
  reason: string;
  amount: string | null;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
  order: { orderNumber: string; recipientName: string };
}

interface Order {
  id: string;
  orderNumber: string;
  recipientName: string;
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
  { value: "COMPLETED", label: "완료" },
  { value: "REJECTED", label: "거절" },
];

export default function SellerClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [createOpen, setCreateOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [claimType, setClaimType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [creating, setCreating] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Claim | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/seller/claims?${params}`);
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
  }, [pagination.page, statusFilter]);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const openCreate = async () => {
    setSelectedOrderId("");
    setClaimType("");
    setReason("");
    setCreateOpen(true);
    try {
      const res = await fetch("/api/seller/orders?limit=100");
      const json = await res.json();
      if (res.ok) setOrders(json.data.map((o: any) => ({ id: o.id, orderNumber: o.orderNumber, recipientName: o.recipientName })));
    } catch { /* ignore */ }
  };

  const handleCreate = async () => {
    if (!selectedOrderId || !claimType || !reason.trim()) {
      toast.error("모든 항목을 입력해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/seller/claims", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selectedOrderId, type: claimType, reason }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "등록 실패");
        return;
      }
      toast.success("클레임이 등록되었습니다");
      setCreateOpen(false);
      fetchClaims();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">클레임</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          클레임 요청
        </Button>
      </div>

      <Card>
        <CardHeader>
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
                    <TableHead>사유</TableHead>
                    <TableHead>요청일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claims.map((claim) => {
                    const st = statusConfig[claim.status] || statusConfig.REQUESTED;
                    return (
                      <TableRow key={claim.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelected(claim); setDetailOpen(true); }}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        <TableCell>{typeLabel[claim.type] || claim.type}</TableCell>
                        <TableCell className="font-mono text-sm">{claim.order.orderNumber}</TableCell>
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클레임 요청</DialogTitle>
            <DialogDescription>반품/환불/교환을 요청합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>주문 선택</Label>
              <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                <SelectTrigger><SelectValue placeholder="주문을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {orders.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.orderNumber} - {o.recipientName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>유형</Label>
              <Select value={claimType} onValueChange={setClaimType}>
                <SelectTrigger><SelectValue placeholder="유형 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RETURN">반품</SelectItem>
                  <SelectItem value="REFUND">환불</SelectItem>
                  <SelectItem value="EXCHANGE">교환</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>사유</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="클레임 사유를 입력하세요" rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? "등록 중..." : "등록"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>클레임 상세</DialogTitle>
            <DialogDescription>{selected?.order.orderNumber}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">유형:</span> {typeLabel[selected.type]}</div>
                <div><span className="text-gray-500">상태:</span> <Badge variant={statusConfig[selected.status]?.variant}>{statusConfig[selected.status]?.label}</Badge></div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">사유</div>
                <div className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{selected.reason}</div>
              </div>
              {selected.adminNote && (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">관리자 메모</div>
                  <div className="whitespace-pre-wrap rounded bg-blue-50 p-3 text-sm">{selected.adminNote}</div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
