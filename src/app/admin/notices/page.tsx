"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Notice {
  id: string;
  title: string;
  content: string;
  isImportant: boolean;
  createdAt: string;
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Notice | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isImportant, setIsImportant] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchNotices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(pagination.page));
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/notices?${params}`);
      const json = await res.json();
      if (res.ok) {
        setNotices(json.data);
        setPagination((prev) => ({ ...prev, total: json.pagination.total, totalPages: json.pagination.totalPages }));
      }
    } catch {
      toast.error("공지 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search]);

  useEffect(() => { fetchNotices(); }, [fetchNotices]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setContent("");
    setIsImportant(false);
    setFormOpen(true);
  };

  const openEdit = (notice: Notice) => {
    setEditing(notice);
    setTitle(notice.title);
    setContent(notice.content);
    setIsImportant(notice.isImportant);
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("제목과 내용을 입력해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const url = editing ? `/api/admin/notices/${editing.id}` : "/api/admin/notices";
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, isImportant }),
      });
      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "저장 실패");
        return;
      }
      toast.success(editing ? "공지가 수정되었습니다" : "공지가 등록되었습니다");
      setFormOpen(false);
      fetchNotices();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 공지를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("삭제 실패");
        return;
      }
      toast.success("삭제되었습니다");
      fetchNotices();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setSearch(searchInput);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">공지 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          공지 등록
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2">
            <Input
              placeholder="제목, 내용 검색"
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
          ) : notices.length === 0 ? (
            <div className="py-8 text-center text-gray-500">공지가 없습니다</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">구분</TableHead>
                    <TableHead>제목</TableHead>
                    <TableHead className="w-32">등록일</TableHead>
                    <TableHead className="w-24 text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notices.map((notice) => (
                    <TableRow key={notice.id}>
                      <TableCell>
                        {notice.isImportant && <Badge variant="destructive">중요</Badge>}
                      </TableCell>
                      <TableCell className="font-medium">{notice.title}</TableCell>
                      <TableCell className="text-sm text-gray-500">{new Date(notice.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEdit(notice)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(notice.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}>이전</Button>
                  <span className="text-sm text-gray-500">{pagination.page} / {pagination.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}>다음</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "공지 수정" : "공지 등록"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>제목</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="공지 제목" />
            </div>
            <div className="space-y-2">
              <Label>내용</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="공지 내용" rows={6} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isImportant} onCheckedChange={setIsImportant} />
              <Label>중요 공지</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={submitting}>{submitting ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
