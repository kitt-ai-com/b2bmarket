"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Wallet, Plus } from "lucide-react";
import { toast } from "sonner";

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

interface DepositRequest {
  id: string;
  amount: string;
  depositorName: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
}

const typeConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  CHARGE: { label: "충전", variant: "default" },
  DEDUCT: { label: "차감", variant: "destructive" },
  REFUND: { label: "환불", variant: "secondary" },
};

const requestStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기중", variant: "outline" },
  APPROVED: { label: "승인", variant: "default" },
  REJECTED: { label: "거절", variant: "destructive" },
};

// 관리자 입금 계좌 (실제 운영 시 설정에서 관리)
const ADMIN_BANK_INFO = {
  bank: "국민은행",
  account: "123-456-789012",
  holder: "네놈마켓",
};

export default function SellerDepositsPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 충전 신청
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [depositorName, setDepositorName] = useState("");
  const [requesting, setRequesting] = useState(false);

  // 충전 신청 내역
  const [requests, setRequests] = useState<DepositRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [requestsPagination, setRequestsPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 탭
  const [activeTab, setActiveTab] = useState<"history" | "requests">("history");

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/seller/deposits?page=${pagination.page}`);
      const json = await res.json();
      if (res.ok) {
        setBalance(Number(json.data.balance));
        setTransactions(json.data.transactions);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("예치금 정보를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page]);

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const res = await fetch(`/api/seller/deposits/requests?page=${requestsPagination.page}`);
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data);
        setRequestsPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("신청 내역을 불러오지 못했습니다");
    } finally {
      setRequestsLoading(false);
    }
  }, [requestsPagination.page]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const openRequestDialog = () => {
    setRequestAmount("");
    setDepositorName("");
    setRequestDialogOpen(true);
  };

  const handleRequest = async () => {
    if (!requestAmount || !depositorName) return;
    setRequesting(true);
    try {
      const res = await fetch("/api/seller/deposits/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(requestAmount),
          depositorName,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "신청 실패");
        return;
      }
      toast.success("충전 신청이 완료되었습니다. 입금 후 관리자 승인을 기다려주세요.");
      setRequestDialogOpen(false);
      fetchRequests();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">예치금</h1>
        <Button onClick={openRequestDialog}>
          <Plus className="mr-2 h-4 w-4" />
          충전 신청
        </Button>
      </div>

      {/* 잔액 카드 */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">예치금 잔액</CardTitle>
          <Wallet className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {loading ? "-" : `${balance.toLocaleString()}원`}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            주문 시 예치금으로 결제할 수 있습니다
          </p>
        </CardContent>
      </Card>

      {/* 입금 계좌 안내 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 text-sm">
            <span className="font-medium text-gray-700">입금 계좌:</span>
            <span>{ADMIN_BANK_INFO.bank} {ADMIN_BANK_INFO.account}</span>
            <span className="text-gray-500">예금주: {ADMIN_BANK_INFO.holder}</span>
          </div>
        </CardContent>
      </Card>

      {/* 탭 */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "history" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("history")}
        >
          거래내역
        </Button>
        <Button
          variant={activeTab === "requests" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("requests")}
        >
          충전 신청 내역
        </Button>
      </div>

      {/* 거래내역 */}
      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">거래내역</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-gray-500">로딩 중...</div>
            ) : transactions.length === 0 ? (
              <div className="py-8 text-center text-gray-500">거래내역이 없습니다</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead className="text-right">잔액</TableHead>
                      <TableHead>사유</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => {
                      const cfg = typeConfig[tx.type] || typeConfig.CHARGE;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell className="text-sm">
                            {new Date(tx.createdAt).toLocaleString("ko-KR")}
                          </TableCell>
                          <TableCell>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${tx.type === "DEDUCT" ? "text-red-500" : "text-blue-600"}`}>
                            {tx.type === "DEDUCT" ? "-" : "+"}
                            {Number(tx.amount).toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(tx.balanceAfter).toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {tx.description || "-"}
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
      )}

      {/* 충전 신청 내역 */}
      {activeTab === "requests" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">충전 신청 내역</CardTitle>
          </CardHeader>
          <CardContent>
            {requestsLoading ? (
              <div className="py-8 text-center text-gray-500">로딩 중...</div>
            ) : requests.length === 0 ? (
              <div className="py-8 text-center text-gray-500">충전 신청 내역이 없습니다</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>신청일</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead>입금자명</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((req) => {
                      const stCfg = requestStatusConfig[req.status] || requestStatusConfig.PENDING;
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="text-sm">
                            {new Date(req.createdAt).toLocaleString("ko-KR")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {Number(req.amount).toLocaleString()}원
                          </TableCell>
                          <TableCell>{req.depositorName}</TableCell>
                          <TableCell>
                            <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {req.adminNote || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {requestsPagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={requestsPagination.page <= 1}
                      onClick={() => setRequestsPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    >
                      이전
                    </Button>
                    <span className="text-sm text-gray-500">
                      {requestsPagination.page} / {requestsPagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={requestsPagination.page >= requestsPagination.totalPages}
                      onClick={() => setRequestsPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    >
                      다음
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 충전 신청 다이얼로그 */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예치금 충전 신청</DialogTitle>
            <DialogDescription>
              아래 계좌로 입금 후 신청해주세요. 관리자 확인 후 예치금이 충전됩니다.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-blue-50 p-4 text-sm">
            <div className="font-medium text-blue-700 mb-1">입금 계좌</div>
            <div>{ADMIN_BANK_INFO.bank} {ADMIN_BANK_INFO.account}</div>
            <div>예금주: {ADMIN_BANK_INFO.holder}</div>
          </div>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="requestAmount">충전 금액 (원)</Label>
              <Input
                id="requestAmount"
                type="number"
                value={requestAmount}
                onChange={(e) => setRequestAmount(e.target.value)}
                placeholder="충전할 금액을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="depositorName">입금자명</Label>
              <Input
                id="depositorName"
                value={depositorName}
                onChange={(e) => setDepositorName(e.target.value)}
                placeholder="실제 입금하신 분의 이름"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleRequest}
              disabled={requesting || !requestAmount || Number(requestAmount) <= 0 || !depositorName}
            >
              {requesting ? "처리 중..." : "충전 신청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
