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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, X, ShoppingCart, Download, Upload } from "lucide-react";
import { toast } from "sonner";

// === 타입 ===
interface Product {
  id: string;
  code: string;
  name: string;
  price: string | number;
  stock: number;
  unit: string;
  imageUrl: string | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  product: { name: string; code: string; imageUrl: string | null; unit?: string };
}

interface Order {
  id: string;
  orderNumber: string;
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
  items: OrderItem[];
}

// === 상수 ===
const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "대기", variant: "secondary" },
  PREPARING: { label: "배송준비", variant: "default" },
  SHIPPING: { label: "배송중", variant: "outline" },
  DELIVERED: { label: "배송완료", variant: "default" },
  CANCELLED: { label: "취소", variant: "destructive" },
  RETURNED: { label: "반품", variant: "destructive" },
  EXCHANGED: { label: "교환", variant: "secondary" },
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

interface CartItem {
  product: Product;
  quantity: number;
}

export default function SellerOrdersPage() {
  // 주문 목록
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 주문 상세
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  // 주문 생성
  const [createOpen, setCreateOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientAddr, setRecipientAddr] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [balance, setBalance] = useState(0);

  // 상품 검색
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productLoading, setProductLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/seller/orders?${params}`);
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
  }, [pagination.page, statusFilter, search]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (!q || q.length < 1) {
      setProducts([]);
      return;
    }
    setProductLoading(true);
    try {
      const res = await fetch(`/api/seller/products?search=${encodeURIComponent(q)}&limit=10`);
      const json = await res.json();
      if (res.ok) setProducts(json.data);
    } catch {
      /* ignore */
    } finally {
      setProductLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const res = await fetch("/api/seller/deposits");
      const json = await res.json();
      if (res.ok) setBalance(Number(json.data.balance));
    } catch {
      /* ignore */
    }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setProductSearch("");
    setProducts([]);
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((c) => c.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity: qty } : c))
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((c) => c.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, c) => sum + Number(c.product.price) * c.quantity, 0);

  const openCreateDialog = () => {
    setCart([]);
    setRecipientName("");
    setRecipientPhone("");
    setRecipientAddr("");
    setPostalCode("");
    setOrderNotes("");
    setProductSearch("");
    setProducts([]);
    setCreateOpen(true);
    fetchBalance();
  };

  const handleCreateOrder = async () => {
    if (cart.length === 0) {
      toast.error("상품을 추가해주세요");
      return;
    }
    if (!recipientName || !recipientPhone || !recipientAddr) {
      toast.error("수령자 정보를 입력해주세요");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/seller/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientPhone,
          recipientAddr,
          postalCode: postalCode || undefined,
          notes: orderNotes || undefined,
          items: cart.map((c) => ({
            productId: c.product.id,
            quantity: c.quantity,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "주문 실패");
        return;
      }
      toast.success("주문이 생성되었습니다");
      setCreateOpen(false);
      fetchOrders();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  const openDetail = (order: Order) => {
    setDetailOrder(order);
    setDetailOpen(true);
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  const handleStatusFilter = (val: string) => {
    setStatusFilter(val);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // === 엑셀 다운로드 ===
  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/seller/orders/excel?${params}`);
      if (!res.ok) {
        toast.error("다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `my_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("엑셀 다운로드 완료");
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다");
    }
  };

  // === 엑셀 업로드 ===
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/seller/orders/excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "업로드 실패");
        return;
      }
      const { created, errors } = json.data;
      toast.success(`주문 ${created}건 생성 완료${errors?.length ? ` (오류 ${errors.length}건)` : ""}`);
      fetchOrders();
    } catch {
      toast.error("업로드 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">내 주문</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelDownload}>
            <Download className="mr-1 h-4 w-4" />
            엑셀 다운로드
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-1 h-4 w-4" />
              엑셀 업로드
              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
            </label>
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-2 h-4 w-4" />
            주문하기
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
                  onClick={() => handleStatusFilter(tab.value)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="주문번호, 수령자명"
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
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-gray-500">주문이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>주문번호</TableHead>
                    <TableHead>상품</TableHead>
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
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => openDetail(order)}
                      >
                        <TableCell className="font-medium">{order.orderNumber}</TableCell>
                        <TableCell>
                          {order.items[0]?.product.name}
                          {order.items.length > 1 && ` 외 ${order.items.length - 1}건`}
                        </TableCell>
                        <TableCell>
                          <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {Number(order.totalAmount).toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
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

      {/* 주문 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 주문</DialogTitle>
            <DialogDescription>
              상품을 선택하고 수령자 정보를 입력하세요. 예치금 잔액: {balance.toLocaleString()}원
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 상품 검색 */}
            <div className="space-y-2">
              <Label>상품 검색</Label>
              <Input
                placeholder="상품명 또는 코드로 검색"
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
              />
              {productLoading && <p className="text-xs text-gray-400">검색 중...</p>}
              {products.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50"
                      onClick={() => addToCart(p)}
                    >
                      <div>
                        <span className="text-sm font-medium">{p.name}</span>
                        <span className="ml-2 text-xs text-gray-400">{p.code}</span>
                      </div>
                      <div className="text-sm">
                        {Number(p.price).toLocaleString()}원
                        <span className="ml-1 text-xs text-gray-400">재고: {p.stock}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 장바구니 */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <Label>선택 상품</Label>
                <div className="rounded border">
                  {cart.map((c) => (
                    <div key={c.product.id} className="flex items-center justify-between border-b px-3 py-2 last:border-0">
                      <div className="flex-1">
                        <span className="text-sm font-medium">{c.product.name}</span>
                        <span className="ml-2 text-xs text-gray-400">
                          @{Number(c.product.price).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={c.product.stock}
                          value={c.quantity}
                          onChange={(e) => updateCartQty(c.product.id, Number(e.target.value))}
                          className="w-20 text-center"
                        />
                        <span className="w-24 text-right text-sm font-medium">
                          {(Number(c.product.price) * c.quantity).toLocaleString()}원
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => removeFromCart(c.product.id)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between bg-gray-50 px-3 py-2 font-semibold">
                    <span>합계</span>
                    <span>{cartTotal.toLocaleString()}원</span>
                  </div>
                </div>
                {cartTotal > balance && (
                  <p className="text-sm text-red-500">예치금 잔액이 부족합니다</p>
                )}
              </div>
            )}

            {/* 수령자 정보 */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">수령자 정보</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="recipientName">이름 *</Label>
                  <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipientPhone">전화번호 *</Label>
                  <Input id="recipientPhone" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="recipientAddr">주소 *</Label>
                  <Input id="recipientAddr" value={recipientAddr} onChange={(e) => setRecipientAddr(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">우편번호</Label>
                  <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orderNotes">메모 (선택)</Label>
                <Input id="orderNotes" value={orderNotes} onChange={(e) => setOrderNotes(e.target.value)} />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button
              onClick={handleCreateOrder}
              disabled={creating || cart.length === 0 || cartTotal > balance}
            >
              <ShoppingCart className="mr-2 h-4 w-4" />
              {creating ? "처리 중..." : `주문하기 (${cartTotal.toLocaleString()}원)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 주문 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>주문 상세</DialogTitle>
            <DialogDescription>
              {detailOrder?.orderNumber}
            </DialogDescription>
          </DialogHeader>

          {detailOrder && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">상태:</span>{" "}
                  <Badge variant={statusConfig[detailOrder.status]?.variant || "secondary"}>
                    {statusConfig[detailOrder.status]?.label || detailOrder.status}
                  </Badge>
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

              {detailOrder.courier && (
                <div className="rounded bg-blue-50 p-3 text-sm">
                  <div className="font-medium text-blue-700">배송 정보</div>
                  <div>택배사: {detailOrder.courier}</div>
                  <div>송장번호: {detailOrder.trackingNumber}</div>
                </div>
              )}

              <div className="text-sm">
                <div className="font-medium mb-1">수령자</div>
                <div>{detailOrder.recipientName} / {detailOrder.recipientPhone}</div>
                <div>{detailOrder.recipientAddr} {detailOrder.postalCode && `(${detailOrder.postalCode})`}</div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">주문 상품</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상품</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">소계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailOrder.items.map((item) => (
                      <TableRow key={item.id}>
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
