"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Grade {
  id: string;
  name: string;
  level: number;
  feeRate: string;
  description: string | null;
  _count: { sellers: number };
}

export default function AdminSettingsPage() {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [form, setForm] = useState({ name: "", level: "", feeRate: "", description: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchGrades = async () => {
    try {
      const res = await fetch("/api/admin/grades");
      const json = await res.json();
      if (res.ok) setGrades(json.data);
    } catch {
      toast.error("등급 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, []);

  const openCreate = () => {
    setEditingGrade(null);
    setForm({ name: "", level: "", feeRate: "", description: "" });
    setDialogOpen(true);
  };

  const openEdit = (grade: Grade) => {
    setEditingGrade(grade);
    setForm({
      name: grade.name,
      level: String(grade.level),
      feeRate: String(grade.feeRate),
      description: grade.description || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        level: parseInt(form.level),
        feeRate: parseFloat(form.feeRate),
        description: form.description || undefined,
      };

      const url = editingGrade
        ? `/api/admin/grades/${editingGrade.id}`
        : "/api/admin/grades";
      const method = editingGrade ? "PATCH" : "POST";

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

      toast.success(editingGrade ? "등급이 수정되었습니다" : "등급이 추가되었습니다");
      setDialogOpen(false);
      fetchGrades();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (grade: Grade) => {
    if (!confirm(`"${grade.name}" 등급을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/grades/${grade.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || "삭제할 수 없습니다");
        return;
      }

      toast.success("등급이 삭제되었습니다");
      fetchGrades();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>셀러 등급 관리</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                등급 추가
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingGrade ? "등급 수정" : "등급 추가"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>등급 이름</Label>
                  <Input
                    placeholder="예: VIP, Gold, Silver"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>레벨 (높을수록 높은 등급)</Label>
                    <Input
                      type="number"
                      placeholder="예: 1, 2, 3"
                      value={form.level}
                      onChange={(e) => setForm({ ...form, level: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>수수료율 (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="예: 5.0"
                      value={form.feeRate}
                      onChange={(e) => setForm({ ...form, feeRate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>설명 (선택)</Label>
                  <Textarea
                    placeholder="등급에 대한 설명"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || !form.name || !form.level || !form.feeRate}
                >
                  {submitting ? "처리 중..." : editingGrade ? "수정" : "추가"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-gray-500">로딩 중...</div>
          ) : grades.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              등록된 등급이 없습니다. 등급을 추가해주세요.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>레벨</TableHead>
                  <TableHead>등급 이름</TableHead>
                  <TableHead>수수료율</TableHead>
                  <TableHead>셀러 수</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grades.map((grade) => (
                  <TableRow key={grade.id}>
                    <TableCell>
                      <Badge variant="outline">{grade.level}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{grade.name}</TableCell>
                    <TableCell>{grade.feeRate}%</TableCell>
                    <TableCell>{grade._count.sellers}명</TableCell>
                    <TableCell className="text-gray-500">
                      {grade.description || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(grade)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(grade)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
