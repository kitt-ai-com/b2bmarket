"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Settlement {
  id: string;
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

export default function SellerSettlementsPage() {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Settlement | null>(null);

  const fetchSettlements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/seller/settlements?${params}`);
      const json = await res.json();
      if (res.ok) {
        setSettlements(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("정산 내역을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter]);

  useEffect(() => { fetchSettlements(); }, [fetchSettlements]);

  const fmt = (v: string) => Number(v).toLocaleString();
  const fmtDate = (d: string) => new Date(d).toLocaleDateString("ko-KR");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">정산 내역</h1>

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
          ) : settlements.length === 0 ? (
            <div className="py-8 text-center text-gray-500">정산 내역이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
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
                      <TableRow key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => { setSelected(s); setDetailOpen(true); }}>
                        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
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

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>정산 상세</DialogTitle>
            <DialogDescription>{selected && `${fmtDate(selected.periodStart)} ~ ${fmtDate(selected.periodEnd)}`}</DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">상태:</span> <Badge variant={statusConfig[selected.status]?.variant}>{statusConfig[selected.status]?.label}</Badge></div>
                <div><span className="text-gray-500">수수료율:</span> {Number(selected.feeRate)}%</div>
                <div><span className="text-gray-500">매출:</span> {fmt(selected.totalSales)}원</div>
                <div><span className="text-gray-500">수수료:</span> <span className="text-red-500">-{fmt(selected.totalFee)}원</span></div>
                <div><span className="text-gray-500">클레임 공제:</span> <span className="text-red-500">-{fmt(selected.claimDeduct)}원</span></div>
                <div className="col-span-2 border-t pt-2"><span className="text-gray-500">지급액:</span> <span className="text-lg font-bold">{fmt(selected.netAmount)}원</span></div>
                {selected.paidAt && <div className="col-span-2"><span className="text-gray-500">지급일:</span> {fmtDate(selected.paidAt)}</div>}
              </div>
              {selected.notes && (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">메모</div>
                  <div className="whitespace-pre-wrap rounded bg-gray-50 p-3 text-sm">{selected.notes}</div>
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
