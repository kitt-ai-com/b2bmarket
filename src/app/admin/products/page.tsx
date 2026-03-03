"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Search, Plus, Pencil, Trash2, Upload, Download, X, ImageIcon, Filter, ChevronDown, Settings2 } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  parentId: string | null;
  parent: { id: string; name: string } | null;
  _count: { children: number; products: number };
}

interface Grade {
  id: string;
  name: string;
  level: number;
  feeRate: string;
}

interface GradePrice {
  gradeId: string;
  price: string;
  grade: { id: string; name: string; level: number };
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  basePrice: string;
  costPrice: string | null;
  unit: string;
  stock: number;
  minStock: number;
  shippingFee: string;
  status: string;
  source: string;
  imageUrl: string | null;
  images: string[];
  category: { id: string; name: string } | null;
  supplier: { id: string; name: string } | null;
  gradePrices: GradePrice[];
  createdAt: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "판매중", variant: "default" },
  OUT_OF_STOCK: { label: "품절", variant: "secondary" },
  DISCONTINUED: { label: "단종", variant: "destructive" },
};

const sourceConfig: Record<string, string> = {
  SELF: "자체",
  SUPPLIER: "공급사",
};

const emptyForm = {
  name: "",
  code: "",
  description: "",
  basePrice: "",
  costPrice: "",
  unit: "EA",
  stock: "0",
  minStock: "10",
  shippingFee: "0",
  status: "ACTIVE",
  source: "SELF",
  categoryId: "",
  supplierId: "",
  imageUrl: "",
  images: [] as string[],
  gradePrices: [] as { gradeId: string; price: string }[],
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  // 상세 필터
  const [showFilters, setShowFilters] = useState(false);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all, low, zero

  // 체크박스 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 일괄 변경 다이얼로그
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkValue, setBulkValue] = useState<any>("");
  const [bulkPriceMode, setBulkPriceMode] = useState<"set" | "percent">("set");
  const [bulkStockMode, setBulkStockMode] = useState<"set" | "add">("set");
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // 인라인 편집
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editingValue, setEditingValue] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Image upload state
  const [uploading, setUploading] = useState(false);

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("");
  const [savingCategory, setSavingCategory] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (search) params.set("search", search);
      if (priceMin) params.set("priceMin", priceMin);
      if (priceMax) params.set("priceMax", priceMax);
      if (stockFilter === "low") params.set("lowStock", "true");
      if (stockFilter === "zero") params.set("zeroStock", "true");
      params.set("page", String(pagination.page));

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
  }, [statusFilter, categoryFilter, sourceFilter, search, priceMin, priceMax, stockFilter, pagination.page]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const json = await res.json();
      if (res.ok) setCategories(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchGrades = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/grades");
      const json = await res.json();
      if (res.ok) setGrades(json.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
    fetchGrades();
  }, [fetchCategories, fetchGrades]);

  // 선택 초기화 (페이지/필터 변경 시)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter, categoryFilter, sourceFilter, search, pagination.page]);

  // === 체크박스 핸들러 ===
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map((p) => p.id)));
    }
  };

  // === 일괄 변경 ===
  const openBulkDialog = (action: string) => {
    setBulkAction(action);
    setBulkValue("");
    setBulkPriceMode("set");
    setBulkStockMode("set");
    setBulkDialogOpen(true);
  };

  const handleBulkAction = async () => {
    setBulkProcessing(true);
    try {
      let apiValue: any = bulkValue;

      if (bulkAction === "basePrice" || bulkAction === "costPrice") {
        apiValue = { mode: bulkPriceMode, amount: Number(bulkValue) };
      } else if (bulkAction === "stock") {
        apiValue = { mode: bulkStockMode, amount: Number(bulkValue) };
      }

      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action: bulkAction,
          value: apiValue,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "일괄 변경 실패");
        return;
      }
      toast.success(`${json.data.updated}개 상품이 변경되었습니다`);
      setBulkDialogOpen(false);
      setSelectedIds(new Set());
      fetchProducts();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setBulkProcessing(false);
    }
  };

  // === 인라인 빠른 수정 ===
  const handleQuickUpdate = async (id: string, field: string, value: any) => {
    try {
      const res = await fetch(`/api/admin/products/${id}/quick`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "변경 실패");
        return;
      }
      // 로컬 상태 업데이트
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? json.data : p))
      );
      toast.success("변경되었습니다");
    } catch {
      toast.error("오류가 발생했습니다");
    }
    setEditingCell(null);
  };

  const startInlineEdit = (id: string, field: string, currentValue: string) => {
    setEditingCell({ id, field });
    setEditingValue(currentValue);
  };

  const commitInlineEdit = () => {
    if (!editingCell) return;
    handleQuickUpdate(editingCell.id, editingCell.field, editingValue);
  };

  // === 상태 빠른 토글 ===
  const cycleStatus = (product: Product) => {
    const statusOrder = ["ACTIVE", "OUT_OF_STOCK", "DISCONTINUED"];
    const currentIdx = statusOrder.indexOf(product.status);
    const nextStatus = statusOrder[(currentIdx + 1) % statusOrder.length];
    handleQuickUpdate(product.id, "status", nextStatus);
  };

  // === 기존 다이얼로그 핸들러 ===
  const openCreateDialog = () => {
    setEditingProduct(null);
    setForm({
      ...emptyForm,
      gradePrices: grades.map((g) => ({ gradeId: g.id, price: "" })),
    });
    setDialogOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setForm({
      name: product.name,
      code: product.code,
      description: product.description || "",
      basePrice: product.basePrice,
      costPrice: product.costPrice || "",
      unit: product.unit,
      stock: String(product.stock),
      minStock: String(product.minStock),
      shippingFee: product.shippingFee || "0",
      status: product.status,
      source: product.source,
      categoryId: product.category?.id || "",
      supplierId: product.supplier?.id || "",
      imageUrl: product.imageUrl || "",
      images: product.images || [],
      gradePrices: grades.map((g) => {
        const existing = product.gradePrices.find((gp) => gp.gradeId === g.id);
        return { gradeId: g.id, price: existing ? String(existing.price) : "" };
      }),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        description: form.description || undefined,
        basePrice: Number(form.basePrice),
        costPrice: form.costPrice ? Number(form.costPrice) : undefined,
        unit: form.unit,
        stock: Number(form.stock),
        minStock: Number(form.minStock),
        shippingFee: Number(form.shippingFee),
        status: form.status,
        source: form.source,
        categoryId: form.categoryId || null,
        supplierId: form.supplierId || null,
        imageUrl: form.imageUrl || null,
        images: form.images,
        gradePrices: form.gradePrices
          .filter((gp) => gp.price !== "")
          .map((gp) => ({ gradeId: gp.gradeId, price: Number(gp.price) })),
      };

      if (!editingProduct) {
        payload.code = form.code;
      }

      const url = editingProduct
        ? `/api/admin/products/${editingProduct.id}`
        : "/api/admin/products";
      const method = editingProduct ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || "오류가 발생했습니다");
        return;
      }

      toast.success(editingProduct ? "상품이 수정되었습니다" : "상품이 등록되었습니다");
      setDialogOpen(false);
      fetchProducts();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`"${product.name}" 상품을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/products/${product.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || "삭제 실패");
        return;
      }

      toast.success("상품이 삭제되었습니다");
      fetchProducts();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error?.message || "업로드 실패");
    return json.data.map((d: { url: string }) => d.url);
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const urls = await uploadFiles([file]);
      setForm((prev) => ({ ...prev, imageUrl: urls[0] }));
      toast.success("썸네일이 업로드되었습니다");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDetailImagesUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = 5 - form.images.length;
    if (files.length > remaining) {
      toast.error(`상세 이미지는 최대 5장까지입니다 (추가 가능: ${remaining}장)`);
      e.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const urls = await uploadFiles(files);
      setForm((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
      toast.success(`${urls.length}개 이미지가 업로드되었습니다`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeDetailImage = (index: number) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  const resetFilters = () => {
    setSourceFilter("all");
    setPriceMin("");
    setPriceMax("");
    setStockFilter("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) return;
    setSavingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryName,
          parentId: categoryParentId || null,
        }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "카테고리 생성 실패");
        return;
      }
      toast.success("카테고리가 생성되었습니다");
      setCategoryDialogOpen(false);
      setCategoryName("");
      setCategoryParentId("");
      fetchCategories();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("이 카테고리를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/categories/${catId}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "삭제 실패");
        return;
      }
      toast.success("카테고리가 삭제되었습니다");
      fetchCategories();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const hasActiveFilters = sourceFilter !== "all" || priceMin !== "" || priceMax !== "" || stockFilter !== "all";

  // === 엑셀 다운로드 ===
  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/products/excel?${params}`);
      if (!res.ok) {
        toast.error("다운로드 실패");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `products_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      const res = await fetch("/api/admin/products/excel", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "업로드 실패");
        return;
      }
      const { created, updated, errors } = json.data;
      toast.success(`생성 ${created}건, 수정 ${updated}건 완료${errors?.length ? ` (오류 ${errors.length}건)` : ""}`);
      fetchProducts();
    } catch {
      toast.error("업로드 중 오류가 발생했습니다");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 관리</h1>
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
          <Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>
            카테고리 관리
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="mr-1 h-4 w-4" />
            상품 등록
          </Button>
        </div>
      </div>

      {/* 기본 필터 */}
      <div className="flex items-center gap-4">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <TabsList>
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="ACTIVE">판매중</TabsTrigger>
            <TabsTrigger value="OUT_OF_STOCK">품절</TabsTrigger>
            <TabsTrigger value="DISCONTINUED">단종</TabsTrigger>
          </TabsList>
        </Tabs>

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
              <SelectItem key={cat.id} value={cat.id}>
                {cat.parent ? `${cat.parent.name} > ` : ""}{cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={hasActiveFilters ? "default" : "outline"}
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-1 h-4 w-4" />
          상세 필터
          {hasActiveFilters && <span className="ml-1 rounded-full bg-white px-1.5 text-xs text-blue-600">!</span>}
        </Button>
      </div>

      {/* 상세 필터 패널 */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">출처</Label>
                <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPagination((prev) => ({ ...prev, page: 1 })); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="SELF">자체</SelectItem>
                    <SelectItem value="SUPPLIER">공급사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">기본가 (원)</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    placeholder="최소"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                    onBlur={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                    className="h-9"
                  />
                  <span className="text-gray-400">~</span>
                  <Input
                    type="number"
                    placeholder="최대"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                    onBlur={() => setPagination((prev) => ({ ...prev, page: 1 }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">재고 상태</Label>
                <Select value={stockFilter} onValueChange={(v) => { setStockFilter(v); setPagination((prev) => ({ ...prev, page: 1 })); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="low">부족 (최소 재고 이하)</SelectItem>
                    <SelectItem value="zero">품절 (0개)</SelectItem>
                  </SelectContent>
                </Select>
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
              {selectedIds.size}개 상품 선택됨
            </span>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Settings2 className="mr-1 h-4 w-4" />
                    일괄 변경
                    <ChevronDown className="ml-1 h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>상태 변경</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleBulkDirect("status", "ACTIVE")}>
                        판매중
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkDirect("status", "OUT_OF_STOCK")}>
                        품절
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkDirect("status", "DISCONTINUED")}>
                        단종
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>출처 변경</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleBulkDirect("source", "SELF")}>
                        자체
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkDirect("source", "SUPPLIER")}>
                        공급사
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>카테고리 변경</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleBulkDirect("category", null)}>
                        없음
                      </DropdownMenuItem>
                      {categories.map((cat) => (
                        <DropdownMenuItem key={cat.id} onClick={() => handleBulkDirect("category", cat.id)}>
                          {cat.parent ? `${cat.parent.name} > ` : ""}{cat.name}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => openBulkDialog("basePrice")}>
                    기본가 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulkDialog("costPrice")}>
                    원가 변경
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openBulkDialog("stock")}>
                    재고 변경
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                선택 해제
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 상품 목록 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">상품 목록 ({pagination.total}개)</CardTitle>
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
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : products.length === 0 ? (
            <div className="py-8 text-center text-gray-500">상품이 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={products.length > 0 && selectedIds.size === products.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>코드</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">기본가</TableHead>
                    <TableHead className="text-right">원가</TableHead>
                    <TableHead className="text-right">재고</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>출처</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => {
                    const cfg = statusConfig[product.status] || statusConfig.ACTIVE;
                    const lowStock = product.stock <= product.minStock;
                    const isEditing = (field: string) =>
                      editingCell?.id === product.id && editingCell?.field === field;

                    return (
                      <TableRow key={product.id} className={selectedIds.has(product.id) ? "bg-blue-50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(product.id)}
                            onCheckedChange={() => toggleSelect(product.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt="" className="h-8 w-8 rounded border object-cover" />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded border bg-gray-50">
                                <ImageIcon className="h-4 w-4 text-gray-300" />
                              </div>
                            )}
                            <span className="font-medium">{product.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>{product.category?.name || "-"}</TableCell>

                        {/* 기본가 - 인라인 편집 */}
                        <TableCell className="text-right">
                          {isEditing("basePrice") ? (
                            <Input
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitInlineEdit();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-7 w-24 text-right"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer rounded px-1 hover:bg-gray-100"
                              onClick={() => startInlineEdit(product.id, "basePrice", product.basePrice)}
                            >
                              {Number(product.basePrice).toLocaleString()}원
                            </span>
                          )}
                        </TableCell>

                        {/* 원가 - 인라인 편집 */}
                        <TableCell className="text-right">
                          {isEditing("costPrice") ? (
                            <Input
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitInlineEdit();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-7 w-24 text-right"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer rounded px-1 hover:bg-gray-100"
                              onClick={() => startInlineEdit(product.id, "costPrice", product.costPrice || "")}
                            >
                              {product.costPrice ? `${Number(product.costPrice).toLocaleString()}원` : "-"}
                            </span>
                          )}
                        </TableCell>

                        {/* 재고 - 인라인 편집 */}
                        <TableCell className={`text-right ${lowStock ? "text-red-500 font-semibold" : ""}`}>
                          {isEditing("stock") ? (
                            <Input
                              type="number"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={commitInlineEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitInlineEdit();
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-7 w-20 text-right"
                              autoFocus
                            />
                          ) : (
                            <span
                              className="cursor-pointer rounded px-1 hover:bg-gray-100"
                              onClick={() => startInlineEdit(product.id, "stock", String(product.stock))}
                            >
                              {product.stock} {product.unit}
                            </span>
                          )}
                        </TableCell>

                        {/* 상태 - 클릭 토글 */}
                        <TableCell>
                          <Badge
                            variant={cfg.variant}
                            className="cursor-pointer"
                            onClick={() => cycleStatus(product)}
                          >
                            {cfg.label}
                          </Badge>
                        </TableCell>

                        {/* 출처 - 클릭 토글 */}
                        <TableCell>
                          <span
                            className="cursor-pointer rounded px-1 text-sm hover:bg-gray-100"
                            onClick={() =>
                              handleQuickUpdate(product.id, "source", product.source === "SELF" ? "SUPPLIER" : "SELF")
                            }
                          >
                            {sourceConfig[product.source] || product.source}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEditDialog(product)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => handleDelete(product)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
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

      {/* 일괄 변경 다이얼로그 (가격/재고) */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkAction === "basePrice" && "기본가 일괄 변경"}
              {bulkAction === "costPrice" && "원가 일괄 변경"}
              {bulkAction === "stock" && "재고 일괄 변경"}
            </DialogTitle>
            <DialogDescription>
              선택된 {selectedIds.size}개 상품에 적용됩니다
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {(bulkAction === "basePrice" || bulkAction === "costPrice") && (
              <>
                <div className="space-y-2">
                  <Label>변경 방식</Label>
                  <Select value={bulkPriceMode} onValueChange={(v: "set" | "percent") => setBulkPriceMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set">금액 지정</SelectItem>
                      <SelectItem value="percent">비율 변경 (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {bulkPriceMode === "set" ? "변경할 금액 (원)" : "변경 비율 (%, +10은 10% 인상, -10은 10% 인하)"}
                  </Label>
                  <Input
                    type="number"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={bulkPriceMode === "set" ? "금액 입력" : "예: 10, -10"}
                  />
                </div>
              </>
            )}

            {bulkAction === "stock" && (
              <>
                <div className="space-y-2">
                  <Label>변경 방식</Label>
                  <Select value={bulkStockMode} onValueChange={(v: "set" | "add") => setBulkStockMode(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="set">수량 지정</SelectItem>
                      <SelectItem value="add">수량 증감</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>
                    {bulkStockMode === "set" ? "변경할 수량" : "증감 수량 (+10은 추가, -10은 차감)"}
                  </Label>
                  <Input
                    type="number"
                    value={bulkValue}
                    onChange={(e) => setBulkValue(e.target.value)}
                    placeholder={bulkStockMode === "set" ? "수량 입력" : "예: 10, -10"}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleBulkAction}
              disabled={bulkProcessing || bulkValue === ""}
            >
              {bulkProcessing ? "처리 중..." : "적용"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 상품 등록/수정 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "상품 수정" : "상품 등록"}</DialogTitle>
            <DialogDescription>
              {editingProduct ? "상품 정보를 수정합니다" : "새로운 상품을 등록합니다"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">상품 코드</Label>
                <Input
                  id="code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  disabled={!!editingProduct}
                  placeholder="PRD-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">상품명</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="상품명"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">상품 설명</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="상품 설명 (선택)"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="basePrice">기본 가격 (원)</Label>
                <Input
                  id="basePrice"
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">원가 (원)</Label>
                <Input
                  id="costPrice"
                  type="number"
                  value={form.costPrice}
                  onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                  placeholder="선택"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">단위</Label>
                <Input
                  id="unit"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock">재고</Label>
                <Input
                  id="stock"
                  type="number"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">최소 재고</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={form.minStock}
                  onChange={(e) => setForm({ ...form, minStock: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shippingFee">배송비</Label>
                <Input
                  id="shippingFee"
                  type="number"
                  value={form.shippingFee}
                  onChange={(e) => setForm({ ...form, shippingFee: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>출처</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SELF">자체</SelectItem>
                    <SelectItem value="SUPPLIER">공급사</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>상태</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACTIVE">판매중</SelectItem>
                    <SelectItem value="OUT_OF_STOCK">품절</SelectItem>
                    <SelectItem value="DISCONTINUED">단종</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>카테고리</Label>
                <Select value={form.categoryId || "none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "none" ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">없음</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.parent ? `${cat.parent.name} > ` : ""}{cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 썸네일 이미지 */}
            <div className="space-y-2">
              <Label>썸네일 이미지</Label>
              {form.imageUrl ? (
                <div className="relative inline-block">
                  <img
                    src={form.imageUrl}
                    alt="썸네일"
                    className="h-32 w-32 rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, imageUrl: "" })}
                    className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <label className="flex h-32 w-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400">
                  <Upload className="mb-1 h-6 w-6 text-gray-400" />
                  <span className="text-xs text-gray-500">이미지 선택</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleThumbnailUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>

            {/* 상세 이미지 */}
            <div className="space-y-2">
              <Label>상세 이미지 (최대 5장)</Label>
              <div className="flex flex-wrap gap-2">
                {form.images.map((url, idx) => (
                  <div key={idx} className="relative inline-block">
                    <img
                      src={url}
                      alt={`상세 ${idx + 1}`}
                      className="h-24 w-24 rounded-lg border object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeDetailImage(idx)}
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white hover:bg-red-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {form.images.length < 5 && (
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400">
                    <ImageIcon className="mb-1 h-5 w-5 text-gray-400" />
                    <span className="text-[10px] text-gray-500">추가</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={handleDetailImagesUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* 등급별 가격 */}
            {grades.length > 0 && (
              <div className="space-y-2">
                <Label>등급별 가격 (미입력시 기본가 적용)</Label>
                <div className="grid grid-cols-2 gap-2">
                  {form.gradePrices.map((gp, idx) => {
                    const grade = grades.find((g) => g.id === gp.gradeId);
                    return (
                      <div key={gp.gradeId} className="flex items-center gap-2">
                        <span className="w-24 text-sm">{grade?.name || "?"}</span>
                        <Input
                          type="number"
                          value={gp.price}
                          onChange={(e) => {
                            const updated = [...form.gradePrices];
                            updated[idx] = { ...updated[idx], price: e.target.value };
                            setForm({ ...form, gradePrices: updated });
                          }}
                          placeholder="기본가 적용"
                          className="flex-1"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving || uploading}>
              {saving ? "저장 중..." : uploading ? "업로드 중..." : editingProduct ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 카테고리 관리 다이얼로그 */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 관리</DialogTitle>
            <DialogDescription>카테고리를 추가하거나 삭제합니다</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {categories.length > 0 && (
              <div className="space-y-2">
                <Label>현재 카테고리</Label>
                <div className="max-h-48 space-y-1 overflow-y-auto rounded border p-2">
                  {categories.map((cat) => (
                    <div key={cat.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-gray-50">
                      <span className="text-sm">
                        {cat.parent ? `${cat.parent.name} > ` : ""}{cat.name}
                        <span className="ml-2 text-gray-400">({cat._count.products}개 상품)</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDeleteCategory(cat.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>새 카테고리</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="카테고리 이름"
              />
            </div>
            <div className="space-y-2">
              <Label>상위 카테고리 (선택)</Label>
              <Select value={categoryParentId || "none"} onValueChange={(v) => setCategoryParentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="없음 (최상위)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">없음 (최상위)</SelectItem>
                  {categories
                    .filter((c) => !c.parentId)
                    .map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              닫기
            </Button>
            <Button onClick={handleAddCategory} disabled={savingCategory || !categoryName.trim()}>
              {savingCategory ? "추가 중..." : "카테고리 추가"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // 일괄 직접 변경 (상태, 출처, 카테고리 등 다이얼로그 없이)
  async function handleBulkDirect(action: string, value: any) {
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedIds),
          action,
          value,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message || "일괄 변경 실패");
        return;
      }
      toast.success(`${json.data.updated}개 상품이 변경되었습니다`);
      setSelectedIds(new Set());
      fetchProducts();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  }
}
