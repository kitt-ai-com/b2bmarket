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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Search, Plus, Minus, History, Check, X } from "lucide-react";
import { toast } from "sonner";

interface SellerDeposit {
  id: string;
  name: string;
  email: string;
  businessName: string;
  gradeName: string;
  balance: number | string;
}

interface Transaction {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  description: string | null;
  createdAt: string;
}

interface DepositRequestItem {
  id: string;
  sellerId: string;
  amount: string;
  depositorName: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  seller: {
    name: string;
    email: string;
    sellerProfile?: { businessName: string };
  };
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

export default function AdminDepositsPage() {
  // 탭
  const [activeTab, setActiveTab] = useState<"sellers" | "requests">("sellers");

  // === 셀러 예치금 ===
  const [sellers, setSellers] = useState<SellerDeposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 충전/차감 다이얼로그
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [txSeller, setTxSeller] = useState<SellerDeposit | null>(null);
  const [txType, setTxType] = useState<string>("CHARGE");
  const [txAmount, setTxAmount] = useState("");
  const [txDescription, setTxDescription] = useState("");
  const [txSaving, setTxSaving] = useState(false);

  // 거래내역 다이얼로그
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historySeller, setHistorySeller] = useState<SellerDeposit | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [historyBalance, setHistoryBalance] = useState<number>(0);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // === 충전 신청 ===
  const [requests, setRequests] = useState<DepositRequestItem[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [reqStatusFilter, setReqStatusFilter] = useState("");
  const [reqPagination, setReqPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 거절 다이얼로그
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<DepositRequestItem | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);

  // === 셀러 예치금 fetch ===
  const fetchSellers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(pagination.page));

      const res = await fetch(`/api/admin/deposits?${params}`);
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
      toast.error("목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [search, pagination.page]);

  useEffect(() => {
    if (activeTab === "sellers") fetchSellers();
  }, [fetchSellers, activeTab]);

  // === 충전 신청 fetch ===
  const fetchRequests = useCallback(async () => {
    setReqLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(reqPagination.page));
      if (reqStatusFilter) params.set("status", reqStatusFilter);

      const res = await fetch(`/api/admin/deposits/requests?${params}`);
      const json = await res.json();
      if (res.ok) {
        setRequests(json.data);
        setReqPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("신청 목록을 불러오지 못했습니다");
    } finally {
      setReqLoading(false);
    }
  }, [reqPagination.page, reqStatusFilter]);

  useEffect(() => {
    if (activeTab === "requests") fetchRequests();
  }, [fetchRequests, activeTab]);

  // === 충전/차감 ===
  const openTxDialog = (seller: SellerDeposit, type: string) => {
    setTxSeller(seller);
    setTxType(type);
    setTxAmount("");
    setTxDescription("");
    setTxDialogOpen(true);
  };

  const handleTransaction = async () => {
    if (!txSeller || !txAmount) return;
    setTxSaving(true);
    try {
      const res = await fetch(`/api/admin/deposits/${txSeller.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txType,
          amount: Number(txAmount),
          description: txDescription || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "처리 실패");
        return;
      }
      toast.success(txType === "CHARGE" ? "충전 완료" : "차감 완료");
      setTxDialogOpen(false);
      fetchSellers();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setTxSaving(false);
    }
  };

  // === 거래내역 ===
  const openHistoryDialog = async (seller: SellerDeposit) => {
    setHistorySeller(seller);
    setHistoryDialogOpen(true);
    setHistoryPagination((prev) => ({ ...prev, page: 1 }));
    await fetchHistory(seller.id, 1);
  };

  const fetchHistory = async (sellerId: string, page: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/admin/deposits/${sellerId}?page=${page}`);
      const json = await res.json();
      if (res.ok) {
        setHistoryBalance(Number(json.data.balance));
        setTransactions(json.data.transactions);
        setHistoryPagination((prev) => ({
          ...prev,
          page,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("내역을 불러오지 못했습니다");
    } finally {
      setHistoryLoading(false);
    }
  };

  // === 충전 신청 승인/거절 ===
  const handleApprove = async (req: DepositRequestItem) => {
    try {
      const res = await fetch(`/api/admin/deposits/requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "승인 실패");
        return;
      }
      toast.success(`${req.seller.name}님 ${Number(req.amount).toLocaleString()}원 충전 승인`);
      fetchRequests();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const openRejectDialog = (req: DepositRequestItem) => {
    setRejectTarget(req);
    setRejectNote("");
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      const res = await fetch(`/api/admin/deposits/requests/${rejectTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject", adminNote: rejectNote || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "거절 실패");
        return;
      }
      toast.success("충전 신청이 거절되었습니다");
      setRejectDialogOpen(false);
      fetchRequests();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setRejecting(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">예치금 관리</h1>

      {/* 탭 */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "sellers" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("sellers")}
        >
          셀러별 예치금
        </Button>
        <Button
          variant={activeTab === "requests" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveTab("requests")}
        >
          충전 신청
        </Button>
      </div>

      {/* 셀러별 예치금 탭 */}
      {activeTab === "sellers" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">셀러별 예치금 ({pagination.total}명)</CardTitle>
              <div className="flex gap-2">
                <Input
                  placeholder="셀러명, 상호명 검색"
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
              <div className="py-8 text-center text-gray-500">셀러가 없습니다</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>셀러명</TableHead>
                      <TableHead>상호명</TableHead>
                      <TableHead>등급</TableHead>
                      <TableHead className="text-right">예치금 잔액</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellers.map((seller) => (
                      <TableRow key={seller.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{seller.name}</div>
                            <div className="text-xs text-gray-500">{seller.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>{seller.businessName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{seller.gradeName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {Number(seller.balance).toLocaleString()}원
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" size="sm" onClick={() => openTxDialog(seller, "CHARGE")}>
                              <Plus className="mr-1 h-3 w-3" />충전
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => openTxDialog(seller, "DEDUCT")}>
                              <Minus className="mr-1 h-3 w-3" />차감
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => openHistoryDialog(seller)}>
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {pagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={pagination.page <= 1}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
                    <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 충전 신청 탭 */}
      {activeTab === "requests" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">충전 신청 ({reqPagination.total}건)</CardTitle>
              <div className="flex gap-1">
                {[
                  { value: "", label: "전체" },
                  { value: "PENDING", label: "대기중" },
                  { value: "APPROVED", label: "승인" },
                  { value: "REJECTED", label: "거절" },
                ].map((tab) => (
                  <Button
                    key={tab.value}
                    variant={reqStatusFilter === tab.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setReqStatusFilter(tab.value);
                      setReqPagination((prev) => ({ ...prev, page: 1 }));
                    }}
                  >
                    {tab.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {reqLoading ? (
              <div className="py-8 text-center text-gray-500">로딩 중...</div>
            ) : requests.length === 0 ? (
              <div className="py-8 text-center text-gray-500">충전 신청이 없습니다</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>신청일</TableHead>
                      <TableHead>셀러</TableHead>
                      <TableHead className="text-right">금액</TableHead>
                      <TableHead>입금자명</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>비고</TableHead>
                      <TableHead className="text-right">처리</TableHead>
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
                          <TableCell>
                            <div>
                              <div className="font-medium">{req.seller.name}</div>
                              <div className="text-xs text-gray-400">
                                {req.seller.sellerProfile?.businessName || req.seller.email}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {Number(req.amount).toLocaleString()}원
                          </TableCell>
                          <TableCell>{req.depositorName}</TableCell>
                          <TableCell>
                            <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {req.adminNote || "-"}
                          </TableCell>
                          <TableCell>
                            {req.status === "PENDING" && (
                              <div className="flex justify-end gap-1">
                                <Button size="sm" onClick={() => handleApprove(req)}>
                                  <Check className="mr-1 h-3 w-3" />승인
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => openRejectDialog(req)}>
                                  <X className="mr-1 h-3 w-3" />거절
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {reqPagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={reqPagination.page <= 1}
                      onClick={() => setReqPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
                    <span className="text-sm text-gray-500">{reqPagination.page} / {reqPagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={reqPagination.page >= reqPagination.totalPages}
                      onClick={() => setReqPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* 충전/차감 다이얼로그 */}
      <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>예치금 {txType === "CHARGE" ? "충전" : "차감"}</DialogTitle>
            <DialogDescription>
              {txSeller?.name} ({txSeller?.businessName}) — 현재 잔액: {Number(txSeller?.balance || 0).toLocaleString()}원
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>유형</Label>
              <Select value={txType} onValueChange={setTxType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHARGE">충전</SelectItem>
                  <SelectItem value="DEDUCT">차감</SelectItem>
                  <SelectItem value="REFUND">환불</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="txAmount">금액 (원)</Label>
              <Input id="txAmount" type="number" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="금액을 입력하세요" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="txDescription">사유 (선택)</Label>
              <Input id="txDescription" value={txDescription} onChange={(e) => setTxDescription(e.target.value)} placeholder="충전/차감 사유" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxDialogOpen(false)}>취소</Button>
            <Button onClick={handleTransaction} disabled={txSaving || !txAmount || Number(txAmount) <= 0}
              variant={txType === "DEDUCT" ? "destructive" : "default"}>
              {txSaving ? "처리 중..." : txType === "CHARGE" ? "충전" : txType === "DEDUCT" ? "차감" : "환불"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거래내역 다이얼로그 */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>예치금 거래내역</DialogTitle>
            <DialogDescription>
              {historySeller?.name} ({historySeller?.businessName}) — 현재 잔액: {historyBalance.toLocaleString()}원
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {historyLoading ? (
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
                          <TableCell className="text-sm">{new Date(tx.createdAt).toLocaleString("ko-KR")}</TableCell>
                          <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                          <TableCell className={`text-right font-medium ${tx.type === "DEDUCT" ? "text-red-500" : "text-blue-600"}`}>
                            {tx.type === "DEDUCT" ? "-" : "+"}{Number(tx.amount).toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-right">{Number(tx.balanceAfter).toLocaleString()}원</TableCell>
                          <TableCell className="text-sm text-gray-500">{tx.description || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {historyPagination.totalPages > 1 && (
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" disabled={historyPagination.page <= 1}
                      onClick={() => fetchHistory(historySeller!.id, historyPagination.page - 1)}>이전</Button>
                    <span className="text-sm text-gray-500">{historyPagination.page} / {historyPagination.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={historyPagination.page >= historyPagination.totalPages}
                      onClick={() => fetchHistory(historySeller!.id, historyPagination.page + 1)}>다음</Button>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryDialogOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 거절 다이얼로그 */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>충전 신청 거절</DialogTitle>
            <DialogDescription>
              {rejectTarget?.seller.name} — {Number(rejectTarget?.amount || 0).toLocaleString()}원
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejectNote">거절 사유 (선택)</Label>
              <Input
                id="rejectNote"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="거절 사유를 입력하세요"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejecting}>
              {rejecting ? "처리 중..." : "거절"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
