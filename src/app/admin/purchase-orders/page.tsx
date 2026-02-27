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
import { Plus, Search, Trash2, Download, Upload, X } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
}

interface POItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  trackingNumber: string | null;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  status: string;
  totalAmount: string | null;
  sentAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  createdAt: string;
  supplier: { name: string };
  items: POItem[];
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "초안", variant: "secondary" },
  SENT: { label: "발송", variant: "outline" },
  CONFIRMED: { label: "확인", variant: "default" },
  SHIPPED: { label: "배송중", variant: "outline" },
  RECEIVED: { label: "입고완료", variant: "default" },
};

const statusTabs = [
  { value: "", label: "전체" },
  { value: "DRAFT", label: "초안" },
  { value: "SENT", label: "발송" },
  { value: "CONFIRMED", label: "확인" },
  { value: "SHIPPED", label: "배송중" },
  { value: "RECEIVED", label: "입고완료" },
];

interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Product {
  id: string;
  code: string;
  name: string;
  costPrice: string | null;
  basePrice: string;
}

export default function AdminPurchaseOrdersPage() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // 상세 다이얼로그
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailPO, setDetailPO] = useState<PurchaseOrder | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 생성 다이얼로그
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poNotes, setPONotes] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [creating, setCreating] = useState(false);

  // 상품 검색 (발주 생성용)
  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (statusFilter) params.set("status", statusFilter);
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/purchase-orders?${params}`);
      const json = await res.json();
      if (res.ok) {
        setPOs(json.data);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("발주 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, statusFilter, supplierFilter, search]);

  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/suppliers?limit=100");
        const json = await res.json();
        if (res.ok) setSuppliers(json.data);
      } catch { /* ignore */ }
    })();
  }, []);

  // === 상세 ===
  const openDetail = async (po: PurchaseOrder) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const res = await fetch(`/api/admin/purchase-orders/${po.id}`);
      const json = await res.json();
      if (res.ok) setDetailPO(json.data);
    } catch {
      toast.error("발주 상세를 불러오지 못했습니다");
    } finally {
      setDetailLoading(false);
    }
  };

  // === 상태 변경 ===
  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "상태 변경 실패");
        return;
      }
      toast.success("상태가 변경되었습니다");
      setDetailPO(json.data);
      fetchPOs();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  // === 삭제 ===
  const handleDelete = async (id: string) => {
    if (!confirm("이 발주를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/purchase-orders/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "삭제 실패");
        return;
      }
      toast.success("발주가 삭제되었습니다");
      setDetailOpen(false);
      fetchPOs();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  // === 생성 ===
  const openCreateDialog = () => {
    setSelectedSupplierId("");
    setPONotes("");
    setCart([]);
    setProductSearch("");
    setProducts([]);
    setCreateOpen(true);
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (!q || q.length < 1) {
      setProducts([]);
      return;
    }
    try {
      const res = await fetch(`/api/admin/products?search=${encodeURIComponent(q)}&limit=10`);
      const json = await res.json();
      if (res.ok) setProducts(json.data);
    } catch { /* ignore */ }
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.productId === product.id);
      if (existing) {
        return prev.map((c) =>
          c.productId === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        unitPrice: Number(product.costPrice || product.basePrice),
      }];
    });
    setProductSearch("");
    setProducts([]);
  };

  const updateCartItem = (productId: string, field: string, value: number) => {
    if (field === "quantity" && value <= 0) {
      setCart((prev) => prev.filter((c) => c.productId !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.productId === productId ? { ...c, [field]: value } : c))
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);

  const handleCreate = async () => {
    if (!selectedSupplierId) {
      toast.error("공급사를 선택해주세요");
      return;
    }
    if (cart.length === 0) {
      toast.error("상품을 추가해주세요");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          notes: poNotes || undefined,
          items: cart,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "생성 실패");
        return;
      }
      toast.success("발주가 생성되었습니다");
      setCreateOpen(false);
      fetchPOs();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setCreating(false);
    }
  };

  // === 엑셀 ===
  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter);

      const res = await fetch(`/api/admin/purchase-orders/excel?${params}`);
      if (!res.ok) {
        toast.error("다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("엑셀 다운로드 완료");
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/purchase-orders/excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "업로드 실패");
        return;
      }
      const { created, errors } = json.data;
      toast.success(`발주 ${created}건 생성 완료${errors?.length ? ` (오류 ${errors.length}건)` : ""}`);
      fetchPOs();
    } catch {
      toast.error("업로드 중 오류가 발생했습니다");
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  // 다음 상태 버튼 매핑
  const nextStatus: Record<string, { status: string; label: string }> = {
    DRAFT: { status: "SENT", label: "발송으로 변경" },
    SENT: { status: "CONFIRMED", label: "확인으로 변경" },
    CONFIRMED: { status: "SHIPPED", label: "배송중으로 변경" },
    SHIPPED: { status: "RECEIVED", label: "입고완료로 변경" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">발주 관리</h1>
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
            <Plus className="mr-1 h-4 w-4" />
            발주 생성
          </Button>
        </div>
      </div>

      {/* 상태 탭 + 필터 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 flex-wrap">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setStatusFilter(tab.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select value={supplierFilter} onValueChange={(v) => {
            setSupplierFilter(v);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="공급사 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">공급사 전체</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="발주번호, 공급사명"
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

      {/* 발주 목록 */}
      <Card>
        <CardHeader>
          <div className="text-sm text-gray-500">총 {pagination.total}건</div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : pos.length === 0 ? (
            <div className="py-8 text-center text-gray-500">발주가 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>발주번호</TableHead>
                    <TableHead>공급사</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>품목수</TableHead>
                    <TableHead className="text-right">총액</TableHead>
                    <TableHead>발주일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pos.map((po) => {
                    const stCfg = statusConfig[po.status] || statusConfig.DRAFT;
                    return (
                      <TableRow
                        key={po.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => openDetail(po)}
                      >
                        <TableCell className="font-medium">{po.poNumber}</TableCell>
                        <TableCell>{po.supplier.name}</TableCell>
                        <TableCell>
                          <Badge variant={stCfg.variant}>{stCfg.label}</Badge>
                        </TableCell>
                        <TableCell>{po.items.length}건</TableCell>
                        <TableCell className="text-right font-medium">
                          {po.totalAmount ? Number(po.totalAmount).toLocaleString() + "원" : "-"}
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(po.createdAt).toLocaleDateString("ko-KR")}
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

      {/* 발주 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>발주 상세</DialogTitle>
            <DialogDescription>{detailPO?.poNumber}</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : detailPO ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500">공급사:</span> {detailPO.supplier.name}
                </div>
                <div>
                  <span className="text-gray-500">상태:</span>{" "}
                  <Badge variant={statusConfig[detailPO.status]?.variant || "secondary"}>
                    {statusConfig[detailPO.status]?.label || detailPO.status}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-500">발주일:</span>{" "}
                  {new Date(detailPO.createdAt).toLocaleString("ko-KR")}
                </div>
                <div>
                  <span className="text-gray-500">총액:</span>{" "}
                  <span className="font-semibold">
                    {detailPO.totalAmount ? Number(detailPO.totalAmount).toLocaleString() + "원" : "-"}
                  </span>
                </div>
              </div>

              {detailPO.notes && (
                <div className="text-sm">
                  <span className="text-gray-500">메모:</span> {detailPO.notes}
                </div>
              )}

              <div>
                <div className="text-sm font-medium mb-2">발주 품목</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>상품명</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">소계</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailPO.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.productName}</TableCell>
                        <TableCell className="text-right text-sm">
                          {Number(item.unitPrice).toLocaleString()}원
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {(Number(item.unitPrice) * item.quantity).toLocaleString()}원
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 상태 변경 버튼 */}
              <div className="flex gap-2">
                {nextStatus[detailPO.status] && (
                  <Button
                    onClick={() => handleStatusChange(detailPO.id, nextStatus[detailPO.status].status)}
                  >
                    {nextStatus[detailPO.status].label}
                  </Button>
                )}
                {detailPO.status === "DRAFT" && (
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(detailPO.id)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    삭제
                  </Button>
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 발주 생성 다이얼로그 */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 발주</DialogTitle>
            <DialogDescription>공급사를 선택하고 발주할 상품을 추가하세요</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 공급사 선택 */}
            <div className="space-y-2">
              <Label>공급사 *</Label>
              <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="공급사 선택" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 상품 검색 */}
            <div className="space-y-2">
              <Label>상품 검색</Label>
              <Input
                placeholder="상품명 또는 코드로 검색"
                value={productSearch}
                onChange={(e) => searchProducts(e.target.value)}
              />
              {products.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border">
                  {products.map((p: Product) => (
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
                        {Number(p.costPrice || p.basePrice).toLocaleString()}원
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 장바구니 */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <Label>발주 품목</Label>
                <div className="rounded border">
                  {cart.map((c) => (
                    <div key={c.productId} className="flex items-center justify-between border-b px-3 py-2 last:border-0">
                      <div className="flex-1 text-sm font-medium">{c.productName}</div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={c.quantity}
                          onChange={(e) => updateCartItem(c.productId, "quantity", Number(e.target.value))}
                          className="w-20 text-center"
                        />
                        <span className="text-xs text-gray-400">x</span>
                        <Input
                          type="number"
                          min={0}
                          value={c.unitPrice}
                          onChange={(e) => updateCartItem(c.productId, "unitPrice", Number(e.target.value))}
                          className="w-28 text-right"
                        />
                        <span className="w-24 text-right text-sm font-medium">
                          {(c.unitPrice * c.quantity).toLocaleString()}원
                        </span>
                        <Button variant="ghost" size="sm" onClick={() =>
                          setCart((prev) => prev.filter((item) => item.productId !== c.productId))
                        }>
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
              </div>
            )}

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Input value={poNotes} onChange={(e) => setPONotes(e.target.value)} placeholder="발주 메모" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !selectedSupplierId || cart.length === 0}
            >
              {creating ? "생성 중..." : `발주 생성 (${cartTotal.toLocaleString()}원)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
