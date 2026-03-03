"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Search, Upload, Download, Save } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface Grade {
  id: string;
  name: string;
  level: number;
}

interface GradePrice {
  id: string;
  gradeId: string;
  price: string;
  grade: { id: string; name: string; level: number };
}

interface Product {
  id: string;
  code: string;
  name: string;
  basePrice: string;
  costPrice: string | null;
  status: string;
  category: Category | null;
  gradePrices: GradePrice[];
}

export default function AdminPricesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, totalPages: 0 });

  // 인라인 편집
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>({});
  const [editedGradePrices, setEditedGradePrices] = useState<Record<string, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 벌크 변경 다이얼로그
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkPriceMode, setBulkPriceMode] = useState<"set" | "percent">("set");
  const [bulkPriceValue, setBulkPriceValue] = useState("");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // 등급 가격 토글
  const [showGradePrices, setShowGradePrices] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      params.set("page", String(pagination.page));
      params.set("limit", String(pagination.limit));

      const res = await fetch(`/api/admin/products?${params}`);
      const json = await res.json();
      if (res.ok) {
        setProducts(json.data);
        setPagination((prev) => ({
          ...prev,
          total: json.pagination.total,
          totalPages: json.pagination.totalPages,
        }));
      }
    } catch {
      toast.error("상품 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, pagination.page, pagination.limit]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();
      if (res.ok) setCategories(json.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchGrades = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/grades");
      const json = await res.json();
      if (res.ok) setGrades((json.data || []).sort((a: Grade, b: Grade) => a.level - b.level));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { fetchCategories(); fetchGrades(); }, [fetchCategories, fetchGrades]);

  // 검색
  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  // 전체 선택
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(products.map((p) => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 가격 변경 여부 확인
  const hasChange = (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return false;
    const edited = editedPrices[productId];
    if (edited !== undefined && edited !== String(Number(product.basePrice))) return true;
    // 등급 가격 변경 여부
    if (editedGradePrices[productId]) {
      for (const [gradeId, val] of Object.entries(editedGradePrices[productId])) {
        const existing = product.gradePrices.find((gp) => gp.gradeId === gradeId);
        const existingVal = existing ? String(Number(existing.price)) : "";
        if (val !== existingVal) return true;
      }
    }
    return false;
  };

  // 개별 가격 저장
  const savePrice = async (productId: string) => {
    setSavingId(productId);
    try {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      // 기본가 저장
      const newBasePrice = editedPrices[productId];
      if (newBasePrice !== undefined && newBasePrice !== String(Number(product.basePrice))) {
        const res = await fetch(`/api/admin/products/${productId}/quick`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ field: "basePrice", value: newBasePrice }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error?.message || "기본가 변경 실패");
          return;
        }
      }

      // 등급 가격 저장
      if (showGradePrices && editedGradePrices[productId]) {
        const gradePriceData = grades
          .map((g) => {
            const editedVal = editedGradePrices[productId]?.[g.id];
            const existing = product.gradePrices.find((gp) => gp.gradeId === g.id);

            if (editedVal !== undefined) {
              if (editedVal === "") return null; // 빈 값은 제거
              return { gradeId: g.id, price: Number(editedVal) };
            }
            if (existing) {
              return { gradeId: g.id, price: Number(existing.price) };
            }
            return null;
          })
          .filter(Boolean);

        const res = await fetch(`/api/admin/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ gradePrices: gradePriceData }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error?.message || "등급 가격 변경 실패");
          return;
        }
      }

      toast.success("가격이 변경되었습니다");
      // 로컬 상태 초기화
      setEditedPrices((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setEditedGradePrices((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      fetchProducts();
    } catch {
      toast.error("가격 변경 중 오류가 발생했습니다");
    } finally {
      setSavingId(null);
    }
  };

  // 벌크 가격 변경
  const handleBulkPriceChange = async () => {
    if (selectedIds.size === 0) return;
    const amount = Number(bulkPriceValue);
    if (isNaN(amount)) {
      toast.error("유효한 숫자를 입력해주세요");
      return;
    }
    if (bulkPriceMode === "set" && amount < 0) {
      toast.error("가격은 0 이상이어야 합니다");
      return;
    }

    setBulkProcessing(true);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: "basePrice",
          value: { mode: bulkPriceMode, amount },
        }),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success(`${json.data.updated}개 상품 가격이 변경되었습니다`);
        setBulkDialogOpen(false);
        setBulkPriceValue("");
        setSelectedIds(new Set());
        setEditedPrices({});
        fetchProducts();
      } else {
        toast.error(json.error?.message || "일괄 변경 실패");
      }
    } catch {
      toast.error("일괄 변경 중 오류가 발생했습니다");
    } finally {
      setBulkProcessing(false);
    }
  };

  // 엑셀 다운로드
  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);

      const res = await fetch(`/api/admin/prices/excel?${params}`);
      if (!res.ok) { toast.error("다운로드 실패"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prices_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("엑셀 다운로드 완료");
    } catch {
      toast.error("다운로드 중 오류가 발생했습니다");
    }
  };

  // 엑셀 업로드
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/prices/excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (res.ok) {
        const { updated, errors } = json.data;
        toast.success(`${updated}개 상품 가격이 변경되었습니다`);
        if (errors.length > 0) {
          toast.error(`${errors.length}건 오류: ${errors.slice(0, 3).join(", ")}`);
        }
        setEditedPrices({});
        fetchProducts();
      } else {
        toast.error(json.error?.message || "업로드 실패");
      }
    } catch {
      toast.error("업로드 중 오류가 발생했습니다");
    }
  };

  // 변경된 항목 일괄 저장
  const saveAllChanges = async () => {
    const changedIds = products.filter((p) => hasChange(p.id)).map((p) => p.id);
    if (changedIds.length === 0) return;

    for (const id of changedIds) {
      await savePrice(id);
    }
  };

  const changedCount = products.filter((p) => hasChange(p.id)).length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">가격 관리</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExcelDownload}>
            <Download className="mr-1 h-4 w-4" />
            가격 엑셀
          </Button>
          <Button variant="outline" size="sm" asChild>
            <label className="cursor-pointer">
              <Upload className="mr-1 h-4 w-4" />
              엑셀 업로드
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleExcelUpload}
              />
            </label>
          </Button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 카테고리</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder="상품명, 코드 검색"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Switch checked={showGradePrices} onCheckedChange={setShowGradePrices} />
          <Label className="text-sm">등급별 가격</Label>
        </div>
      </div>

      {/* 선택 액션바 */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-blue-700">
              {selectedIds.size}개 상품 선택됨
            </span>
            <Button size="sm" onClick={() => setBulkDialogOpen(true)}>
              일괄 가격 변경
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 변경사항 알림 */}
      {changedCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium text-yellow-700">
              {changedCount}개 상품의 가격이 변경되었습니다 (저장 필요)
            </span>
            <Button size="sm" variant="outline" onClick={saveAllChanges}>
              <Save className="mr-1 h-4 w-4" />
              전체 저장
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 상품 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">상품 가격 목록 ({pagination.total}개)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-gray-500">상품이 없습니다</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={products.length > 0 && selectedIds.size === products.length}
                          onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                        />
                      </TableHead>
                      <TableHead className="w-28">상품코드</TableHead>
                      <TableHead>상품명</TableHead>
                      <TableHead className="w-24">카테고리</TableHead>
                      <TableHead className="text-right w-28">현재 기본가</TableHead>
                      <TableHead className="text-right w-36">새 기본가</TableHead>
                      {showGradePrices && grades.map((g) => (
                        <TableHead key={g.id} className="text-right w-28">
                          {g.name}
                        </TableHead>
                      ))}
                      <TableHead className="w-20">저장</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => {
                      const changed = hasChange(product.id);
                      return (
                        <TableRow
                          key={product.id}
                          className={changed ? "bg-yellow-50" : ""}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={() => toggleSelect(product.id)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">{product.code}</TableCell>
                          <TableCell className="font-medium">
                            {product.name}
                            {product.status !== "ACTIVE" && (
                              <Badge
                                variant={product.status === "OUT_OF_STOCK" ? "secondary" : "destructive"}
                                className="ml-2"
                              >
                                {product.status === "OUT_OF_STOCK" ? "품절" : "단종"}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {product.category?.name || "-"}
                          </TableCell>
                          <TableCell className="text-right text-gray-500">
                            {Number(product.basePrice).toLocaleString()}원
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              value={editedPrices[product.id] ?? String(Number(product.basePrice))}
                              onChange={(e) =>
                                setEditedPrices((prev) => ({
                                  ...prev,
                                  [product.id]: e.target.value,
                                }))
                              }
                              className="h-8 w-32 text-right ml-auto"
                            />
                          </TableCell>
                          {showGradePrices && grades.map((g) => {
                            const existing = product.gradePrices.find(
                              (gp) => gp.gradeId === g.id
                            );
                            return (
                              <TableCell key={g.id} className="text-right">
                                <Input
                                  type="number"
                                  value={
                                    editedGradePrices[product.id]?.[g.id] ??
                                    (existing ? String(Number(existing.price)) : "")
                                  }
                                  onChange={(e) =>
                                    setEditedGradePrices((prev) => ({
                                      ...prev,
                                      [product.id]: {
                                        ...(prev[product.id] || {}),
                                        [g.id]: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="기본가"
                                  className="h-8 w-24 text-right ml-auto"
                                />
                              </TableCell>
                            );
                          })}
                          <TableCell>
                            {changed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7"
                                disabled={savingId === product.id}
                                onClick={() => savePrice(product.id)}
                              >
                                {savingId === product.id ? "..." : "저장"}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={pagination.page <= 1}
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                    }
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
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                    }
                  >
                    다음
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* 벌크 가격 변경 다이얼로그 */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>일괄 가격 변경</DialogTitle>
            <DialogDescription>
              선택된 {selectedIds.size}개 상품의 기본가를 변경합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={bulkPriceMode === "set" ? "default" : "outline"}
                size="sm"
                onClick={() => setBulkPriceMode("set")}
              >
                금액 지정
              </Button>
              <Button
                variant={bulkPriceMode === "percent" ? "default" : "outline"}
                size="sm"
                onClick={() => setBulkPriceMode("percent")}
              >
                비율 변경
              </Button>
            </div>
            <div>
              <Label className="text-sm">
                {bulkPriceMode === "set" ? "변경할 금액 (원)" : "변경 비율 (%) — 양수: 인상, 음수: 인하"}
              </Label>
              <Input
                type="number"
                value={bulkPriceValue}
                onChange={(e) => setBulkPriceValue(e.target.value)}
                placeholder={bulkPriceMode === "set" ? "예: 15000" : "예: 10 (10% 인상) 또는 -5 (5% 인하)"}
                className="mt-1"
              />
              {bulkPriceMode === "percent" && bulkPriceValue && (
                <p className="mt-1 text-sm text-gray-500">
                  {Number(bulkPriceValue) > 0
                    ? `${Math.abs(Number(bulkPriceValue))}% 인상`
                    : Number(bulkPriceValue) < 0
                    ? `${Math.abs(Number(bulkPriceValue))}% 인하`
                    : "변경 없음"}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleBulkPriceChange} disabled={bulkProcessing || !bulkPriceValue}>
              {bulkProcessing ? "처리 중..." : "변경 적용"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
