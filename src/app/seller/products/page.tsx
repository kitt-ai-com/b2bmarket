"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  stock: number;
  imageUrl: string | null;
  category: Category | null;
  price: string;
  basePrice: string;
}

export default function SellerProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sort, setSort] = useState("name_asc");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (stockFilter !== "all") params.set("stock", stockFilter);
      if (sort !== "name_asc") params.set("sort", sort);
      params.set("page", String(pagination.page));

      const res = await fetch(`/api/seller/products?${params}`);
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
  }, [search, categoryFilter, stockFilter, sort, pagination.page]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/categories");
      const json = await res.json();
      if (res.ok) {
        setCategories(json.data.map((c: any) => ({ id: c.id, name: c.name })));
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  const handleExcelDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);

      const res = await fetch(`/api/seller/products/excel?${params}`);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">상품 조회</h1>
        <Button variant="outline" size="sm" onClick={handleExcelDownload}>
          <Download className="mr-1 h-4 w-4" />
          엑셀 다운로드
        </Button>
      </div>

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

        <Select
          value={stockFilter}
          onValueChange={(v) => {
            setStockFilter(v);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="재고" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 재고</SelectItem>
            <SelectItem value="inStock">재고 있음</SelectItem>
            <SelectItem value="outOfStock">품절</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(v) => {
            setSort(v);
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
        >
          <SelectTrigger className="w-40">
            <ArrowUpDown className="mr-1 h-3 w-3" />
            <SelectValue placeholder="정렬" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name_asc">이름순 (ㄱ→ㅎ)</SelectItem>
            <SelectItem value="name_desc">이름순 (ㅎ→ㄱ)</SelectItem>
            <SelectItem value="price_asc">가격 낮은순</SelectItem>
            <SelectItem value="price_desc">가격 높은순</SelectItem>
            <SelectItem value="stock_desc">재고 많은순</SelectItem>
            <SelectItem value="stock_asc">재고 적은순</SelectItem>
            <SelectItem value="newest">최신 등록순</SelectItem>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">상품 목록 ({pagination.total}개)</CardTitle>
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
                    <TableHead>코드</TableHead>
                    <TableHead>상품명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-right">단가</TableHead>
                    <TableHead className="text-right">재고</TableHead>
                    <TableHead>단위</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono text-sm">{product.code}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>{product.category?.name || "-"}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {Number(product.price).toLocaleString()}원
                      </TableCell>
                      <TableCell className={`text-right ${product.stock <= 0 ? "text-red-500" : ""}`}>
                        {product.stock > 0 ? product.stock : "품절"}
                      </TableCell>
                      <TableCell>{product.unit}</TableCell>
                    </TableRow>
                  ))}
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
    </div>
  );
}
