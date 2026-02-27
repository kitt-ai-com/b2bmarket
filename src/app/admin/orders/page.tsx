"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string; code: string; imageUrl?: string | null; unit?: string };
}

interface Order {
  id: string;
  orderNumber: string;
  sellerId: string;
  salesChannel: string;
  channelOrderNo: string | null;
  status: string;
  totalAmount: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddr: string;
  postalCode: string | null;
  courier: string | null;
  trackingNumber: string | null;
  notes: string | null;
  createdAt: string;
  seller: { name: string; email: string; sellerProfile?: { businessName: string } };
  items: OrderItem[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기", variant: "secondary" },
  PREPARING: { label: "배송준비", variant: "default" },
  SHIPPING: { label: "배송중", variant: "outline" },
  DELIVERED: { label: "배송완료", variant: "default" },
  CANCELLED: { label: "취소", variant: "destructive" },
  RETURNED: { label: "반품", variant: "destructive" },
  EXCHANGED: { label: "교환", variant: "secondary" },
};

const channelConfig: Record<string, string> = {
  COUPANG: "쿠팡",
  SMARTSTORE: "스마트스토어",
  OWN_MALL: "자사몰",
  OTHER: "기타",
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "PENDING", label: "대기" },
  { value: "PREPARING", label: "배송준비" },
  { value: "SHIPPING", label: "배송중" },
  { value: "DELIVERED", label: "배송완료" },
  { value: "CANCELLED", label: "취소" },
  { value: "RETURNED", label: "반품" },
  { value: "EXCHANGED", label: "교환" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 상세 필터
  const [showFilters, setShowFilters] = useState(false);
  const [channelFilter, setChannelFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 상세/수정 다이얼로그
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 상태 변경
  const [newStatus, setNewStatus] = useState("");
  const [courier, setCourier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (amountMin) params.set("amountMin", amountMin);
      if (amountMax) params.set("amountMax", amountMax);

      const res = await fetch(`/api/admin/orders?${params}`);
      const json = await res.json();
      if (res.ok) {
        setOrders(json.data);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("주문 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, search, channelFilter, dateFrom, dateTo, amountMin, amountMax]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // 선택 초기화
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, search, pagination.page, channelFilter, dateFrom, dateTo]);

  // === 체크박스 ===
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(orders.map((o) => o.id)));
    }
  };

  // === 일괄 상태 변경 ===
  const handleBulkStatus = async (status: string) => {
    try {
      const res = await fetch("/api/admin/orders/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), status }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "일괄 변경 실패");
        return;
      }
      toast.success(`${json.data.updated}건 상태가 변경되었습니다`);
      setSelectedIds(new Set());
      fetchOrders();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  // === 상세 ===
  const openDetail = async (order: Order) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetailOrder(json.data);
        setNewStatus(json.data.status);
        setCourier(json.data.courier || "");
        setTrackingNumber(json.data.trackingNumber || "");
      }
    } catch {
      toast.error("주문 상세를 불러오지 못했습니다");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!detailOrder || !newStatus) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${detailOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          courier: courier || undefined,
          trackingNumber: trackingNumber || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "상태 변경 실패");
        return;
      }
      toast.success("상태가 변경되었습니다");
      setDetailOrder(json.data);
      fetchOrders();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setUpdating(false);
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setChannelFilter("all");
    setDateFrom("");
    setDateTo("");
    setAmountMin("");
    setAmountMax("");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = channelFilter !== "all" || dateFrom !== "" || dateTo !== "" || amountMin !== "" || amountMax !== "";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">주문 관리</h1>

      {/* 상태 탭 + 검색 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="flex gap-2">
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-1 h-4 w-4" />
            상세 필터
            {hasActiveFilters && <span className="ml-1 rounded-full bg-white px-1.5 text-xs text-blue-600">!</span>}
          </Button>
          <Input
            placeholder="주문번호, 셀러명, 수령자명"
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

      {/* 상세 필터 패널 */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">판매채널</Label>
                <Select value={channelFilter} onValueChange={(v) => { setChannelFilter(v); setPagination((prev) => ({ ...prev, page: 1 })); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="COUPANG">쿠팡</SelectItem>
                    <SelectItem value="SMARTSTORE">스마트스토어</SelectItem>
                    <SelectItem value="OWN_MALL">자사몰</SelectItem>
                    <SelectItem value="OTHER">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">주문일</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
                    className="h-9"
                  />
                  <span className="text-gray-400">~</span>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">금액 범위 (원)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="최소"
                    value={amountMin}
                    onChange={(e) => setAmountMin(e.target.value)}
                    onBlur={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                    className="h-9"
                  />
                  <span className="text-gray-400">~</span>
                  <Input
                    type="number"
                    placeholder="최대"
                    value={amountMax}
                    onChange={(e) => setAmountMax(e.target.value)}
                    onBlur={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  필터 초기화
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 일괄 작업 바 */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size}건 주문 선택됨
            </span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Settings2 className="mr-1 h-4 w-4" />
                    일괄 상태 변경
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {Object.entries(statusConfig).map(([key, cfg]) => (
                    <DropdownMenuItem key={key} onClick={() => handleBulkStatus(key)}>
                      <Badge variant={cfg.variant} className="mr-2">{cfg.label}</Badge>
                      {cfg.label}로 변경
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                선택 해제
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 주문 목록 */}
      <Card>
        <CardHeader>
          <div className="text-sm text-gray-500">
            총 {pagination.total}건
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-gray-500">주문이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={orders.length > 0 && selectedIds.size === orders.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>주문번호</TableHead>
                    <TableHead>셀러</TableHead>
                    <TableHead>상품</TableHead>
                    <TableHead>채널</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead>주문일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => {
                    const stCfg = statusConfig[order.status] || statusConfig.PENDING;
                    return (
                      <TableRow
                        key={order.id}
                        className={`cursor-pointer ${selectedIds.has(order.id) ? "bg-blue-50" : "hover:bg-gray-50"}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(order.id)}
                            onCheckedChange={() => toggleSelect(order.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium" onClick={() => openDetail(order)}>
                          {order.orderNumber}
                        </TableCell>
                        <TableCell onClick={() => openDetail(order)}>
                          <div className="text-sm">{order.seller?.name}</div>
                          <div className="text-xs text-gray-400">{order.seller?.email}</div>
                        </TableCell>
                        <TableCell onClick={() => openDetail(order)}>
                          {order.items[0]?.product.name}
                          {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                        </TableCell>
                        <TableCell onClick={() => openDetail(order)}>
                          {channelConfig[order.salesChannel] || order.salesChannel}
                        </TableCell>
                        <TableCell onClick={() => openDetail(order)}>
                          <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium" onClick={() => openDetail(order)}>
                          {Number(order.totalAmount).toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-sm text-gray-500" onClick={() => openDetail(order)}>
                          {new Date(order.createdAt).toLocaleDateString("ko-KR")}
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

      {/* 주문 상세/상태관리 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>주문 상세</DialogTitle>
            <DialogDescription>
              {detailOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : detailOrder ? (
            <div className="space-y-6 py-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">셀러:</span>{" "}
                  {detailOrder.seller?.name}
                  {detailOrder.seller?.sellerProfile?.businessName &&
                    ` (${detailOrder.seller.sellerProfile.businessName})`}
                </div>
                <div>
                  <span className="text-gray-500">채널:</span>{" "}
                  {channelConfig[detailOrder.salesChannel] || detailOrder.salesChannel}
                  {detailOrder.channelOrderNo && ` (${detailOrder.channelOrderNo})`}
                </div>
                <div>
                  <span className="text-gray-500">주문일:</span>{" "}
                  {new Date(detailOrder.createdAt).toLocaleString("ko-KR")}
                </div>
                <div>
                  <span className="text-gray-500">총액:</span>{" "}
                  <span className="font-semibold">{Number(detailOrder.totalAmount).toLocaleString()}원</span>
                </div>
              </div>

              {/* 수령자 정보 */}
              <div className="text-sm">
                <div className="font-medium mb-1">수령자</div>
                <div>{detailOrder.recipientName} / {detailOrder.recipientPhone}</div>
                <div>{detailOrder.recipientAddr} {detailOrder.postalCode && `(${detailOrder.postalCode})`}</div>
              </div>

              {/* 상품 목록 */}
              <div>
                <div className="text-sm font-medium mb-2">주문 상품</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상품코드</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">소계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrder.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs text-gray-400">{item.product.code}</TableCell>
                        <TableCell className="text-sm">{item.product.name}</TableCell>
                        <TableCell className="text-right text-sm">{Number(item.unitPrice).toLocaleString()}원</TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{Number(item.totalPrice).toLocaleString()}원</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {detailOrder.notes && (
                <div className="text-sm">
                  <span className="text-gray-500">메모:</span> {detailOrder.notes}
                </div>
              )}

              {/* 배송 정보 */}
              {(detailOrder.courier || detailOrder.trackingNumber) && (
                <div className="text-sm rounded-lg bg-gray-50 p-3">
                  <div className="font-medium mb-1">배송 정보</div>
                  {detailOrder.courier && <div>택배사: {detailOrder.courier}</div>}
                  {detailOrder.trackingNumber && <div>송장번호: {detailOrder.trackingNumber}</div>}
                </div>
              )}

              {/* 상태 변경 + 송장 입력 */}
              <div className="rounded-lg border p-4 space-y-4">
                <div className="text-sm font-medium">상태 관리</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>현재 상태</Label>
                    <Badge variant={statusConfig[detailOrder.status]?.variant || "secondary"} className="text-sm">
                      {statusConfig[detailOrder.status]?.label || detailOrder.status}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <Label>변경할 상태</Label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PENDING">대기</SelectItem>
                        <SelectItem value="PREPARING">배송준비</SelectItem>
                        <SelectItem value="SHIPPING">배송중</SelectItem>
                        <SelectItem value="DELIVERED">배송완료</SelectItem>
                        <SelectItem value="CANCELLED">취소</SelectItem>
                        <SelectItem value="RETURNED">반품</SelectItem>
                        <SelectItem value="EXCHANGED">교환</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {(newStatus === "SHIPPING" || detailOrder.status === "SHIPPING") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>택배사</Label>
                      <Input value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="택배사" />
                    </div>
                    <div className="space-y-2">
                      <Label>송장번호</Label>
                      <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="송장번호" />
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleStatusUpdate}
                  disabled={updating || newStatus === detailOrder.status}
                >
                  {updating ? "처리 중..." : "상태 변경"}
                </Button>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
