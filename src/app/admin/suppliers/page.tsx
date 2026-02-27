"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  kakaoId: string | null;
  address: string | null;
  notes: string | null;
  _count?: { products: number };
}

export default function AdminSuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editMode, setEditMode] = useState<"create" | "edit">("create");
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", kakaoId: "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/suppliers?${params}`);
      const json = await res.json();
      if (res.ok) setSuppliers(json.data);
    } catch {
      toast.error("공급사 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openCreate = () => {
    setEditMode("create");
    setSelectedId("");
    setForm({ name: "", contactName: "", phone: "", email: "", kakaoId: "", address: "", notes: "" });
    setEditOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditMode("edit");
    setSelectedId(s.id);
    setForm({
      name: s.name,
      contactName: s.contactName || "",
      phone: s.phone || "",
      email: s.email || "",
      kakaoId: s.kakaoId || "",
      address: s.address || "",
      notes: s.notes || "",
    });
    setEditOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("공급사명을 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const url = editMode === "create" ? "/api/admin/suppliers" : `/api/admin/suppliers/${selectedId}`;
      const method = editMode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "처리 실패");
        return;
      }
      toast.success(editMode === "create" ? "공급사가 등록되었습니다" : "공급사가 수정되었습니다");
      setEditOpen(false);
      fetchSuppliers();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSearch = () => setSearch(searchInput);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">공급사 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          공급사 등록
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Input
              placeholder="공급사명, 담당자 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-60"
            />
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : suppliers.length === 0 ? (
            <div className="py-8 text-center text-gray-500">공급사가 없습니다</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>공급사명</TableHead>
                  <TableHead>담당자</TableHead>
                  <TableHead>전화번호</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>카카오ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((s) => (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openEdit(s)}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm">{s.contactName || "-"}</TableCell>
                    <TableCell className="text-sm">{s.phone || "-"}</TableCell>
                    <TableCell className="text-sm">{s.email || "-"}</TableCell>
                    <TableCell className="text-sm">{s.kakaoId || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editMode === "create" ? "공급사 등록" : "공급사 수정"}</DialogTitle>
            <DialogDescription>공급사 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>공급사명 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="공급사명" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>담당자</Label>
                <Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} placeholder="담당자명" />
              </div>
              <div className="space-y-2">
                <Label>전화번호</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="전화번호" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>이메일</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="이메일" />
              </div>
              <div className="space-y-2">
                <Label>카카오ID</Label>
                <Input value={form.kakaoId} onChange={(e) => setForm({ ...form, kakaoId: e.target.value })} placeholder="카카오ID" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>주소</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="주소" />
            </div>
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="메모" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "처리 중..." : editMode === "create" ? "등록" : "수정"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
