"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface ModRequest {
  id: string;
  orderId: string;
  sellerId: string;
  changes: Record<string, unknown>;
  reason: string;
  status: string;
  adminNote: string | null;
  processedAt: string | null;
  createdAt: string;
  order: {
    orderNumber: string;
    status: string;
    recipientName: string;
    totalAmount: string;
    totalShippingFee: string;
    seller: { id: string; name: string };
  };
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  PENDING: { label: "대기", variant: "secondary" },
  APPROVED: { label: "승인", variant: "default" },
  REJECTED: { label: "거절", variant: "destructive" },
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "대기" },
  { value: "APPROVED", label: "승인" },
  { value: "REJECTED", label: "거절" },
];

function summarizeChanges(changes: Record<string, unknown>): string {
  const parts: string[] = [];
  if (changes.recipientName) parts.push("수령자명");
  if (changes.recipientPhone) parts.push("전화번호");
  if (changes.recipientAddr) parts.push("주소");
  if (changes.postalCode !== undefined) parts.push("우편번호");
  if (changes.notes !== undefined) parts.push("메모");
  if (changes.items) parts.push("상품변경");
  return parts.join(", ") || "없음";
}

export default function AdminOrderModificationsPage() {
  const [requests, setRequests] = useState<ModRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState<ModRequest | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/order-modifications?${params}`);
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("수정 요청 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openDetail = (req: ModRequest) => {
    setDetail(req);
    setAdminNote("");
    setDetailOpen(true);
  };

  const handleProcess = async (action: "APPROVED" | "REJECTED") => {
    if (!detail) return;
    setProcessing(true);
    try {
      const res = await fetch(`/api/admin/order-modifications/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: action, adminNote: adminNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "처리 실패");
        return;
      }
      toast.success(action === "APPROVED" ? "수정 요청이 승인되었습니다" : "수정 요청이 거절되었습니다");
      setDetailOpen(false);
      fetchRequests();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setProcessing(false);
    }
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주문 수정 요청</h1>

      <Card>
        <CardHeader>
          <div className="flex gap-1 flex-wrap">
            {statusTabs.map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleStatusFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : requests.length === 0 ? (
            <div className="py-8 text-center text-gray-500">수정 요청이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead>변경내용</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>요청일</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((req) => {
                    const stCfg = statusConfig[req.status] || statusConfig.PENDING;
                    return (
                      <TableRow
                        key={req.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => openDetail(req)}
                      >
                        <TableCell className="font-medium">{req.order.orderNumber}</TableCell>
                        <TableCell>{req.order.seller.name}</TableCell>
                        <TableCell className="text-sm">
                          {summarizeChanges(req.changes)}
                        </TableCell>
                        <TableCell className="text-sm max-w-48 truncate">{req.reason}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(req.createdAt).toLocaleString("ko-KR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
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

      {/* 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>수정 요청 상세</DialogTitle>
            <DialogDescription>
              주문 {detail?.order.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">셀러:</span> {detail.order.seller.name}
                </div>
                <div>
                  <span className="text-gray-500">상태:</span>{" "}
                  <Badge variant={statusConfig[detail.status]?.variant || "secondary"}>
                    {statusConfig[detail.status]?.label || detail.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">현재 수령자:</span> {detail.order.recipientName}
                </div>
                <div>
                  <span className="text-gray-500">주문금액:</span>{" "}
                  {Number(detail.order.totalAmount).toLocaleString()}원
                </div>
              </div>

              <div className="text-sm">
                <div className="font-medium mb-1">수정 사유</div>
                <div className="rounded bg-gray-50 p-3">{detail.reason}</div>
              </div>

              <div className="text-sm">
                <div className="font-medium mb-2">변경 요청 내용</div>
                <div className="rounded border p-3 space-y-1">
                  {Object.entries(detail.changes).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      recipientName: "수령자명",
                      recipientPhone: "전화번호",
                      recipientAddr: "주소",
                      postalCode: "우편번호",
                      notes: "메모",
                      items: "상품 변경",
                    };
                    const label = labels[key] || key;

                    if (key === "items" && Array.isArray(value)) {
                      return (
                        <div key={key}>
                          <span className="text-gray-500">{label}:</span>
                          <div className="ml-2">
                            {value.map((item: { productId: string; quantity: number }, idx: number) => (
                              <div key={idx} className="text-xs">
                                상품ID: {item.productId}, 수량: {item.quantity}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={key}>
                        <span className="text-gray-500">{label}:</span> {String(value ?? "(없음)")}
                      </div>
                    );
                  })}
                </div>
              </div>

              {detail.adminNote && (
                <div className="text-sm">
                  <span className="text-gray-500">관리자 메모:</span> {detail.adminNote}
                </div>
              )}

              {detail.status === "PENDING" && (
                <div className="space-y-2">
                  <Label>관리자 메모 (선택)</Label>
                  <Textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="승인/거절 사유를 입력하세요"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            {detail?.status === "PENDING" ? (
              <div className="flex gap-2 w-full justify-end">
                <Button
                  variant="destructive"
                  onClick={() => handleProcess("REJECTED")}
                  disabled={processing}
                >
                  거절
                </Button>
                <Button
                  onClick={() => handleProcess("APPROVED")}
                  disabled={processing}
                >
                  {processing ? "처리 중..." : "승인"}
                </Button>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
