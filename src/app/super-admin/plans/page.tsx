"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Users, Package, ShoppingCart, MessageSquare } from "lucide-react";
import { toast } from "sonner";

interface Plan {
  id: string;
  name: string;
  displayName: string;
  price: number;
  maxSellers: number;
  maxMonthlyOrders: number;
  maxProducts: number;
  maxDailyAiChats: number;
  hasExcel: boolean;
  hasFullStats: boolean;
  trialDays: number;
  isActive: boolean;
  sortOrder: number;
  _count: { tenants: number };
}

interface PlanForm {
  name: string;
  displayName: string;
  price: string;
  maxSellers: string;
  maxMonthlyOrders: string;
  maxProducts: string;
  maxDailyAiChats: string;
  hasExcel: boolean;
  hasFullStats: boolean;
  trialDays: string;
  isActive: boolean;
  sortOrder: string;
}

const emptyForm: PlanForm = {
  name: "",
  displayName: "",
  price: "0",
  maxSellers: "5",
  maxMonthlyOrders: "100",
  maxProducts: "50",
  maxDailyAiChats: "5",
  hasExcel: false,
  hasFullStats: false,
  trialDays: "0",
  isActive: true,
  sortOrder: "0",
};

function formatLimit(value: number): string {
  return value === -1 ? "무제한" : value.toLocaleString();
}

function formatPrice(value: number): string {
  if (value === 0) return "무료";
  return `${value.toLocaleString()}원/월`;
}

export default function SuperAdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchPlans = async () => {
    try {
      const res = await fetch("/api/super-admin/plans");
      const json = await res.json();
      if (res.ok) setPlans(json.data);
      else toast.error("요금제 목록을 불러오지 못했습니다");
    } catch {
      toast.error("요금제 목록을 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      displayName: plan.displayName,
      price: String(plan.price),
      maxSellers: String(plan.maxSellers),
      maxMonthlyOrders: String(plan.maxMonthlyOrders),
      maxProducts: String(plan.maxProducts),
      maxDailyAiChats: String(plan.maxDailyAiChats),
      hasExcel: plan.hasExcel,
      hasFullStats: plan.hasFullStats,
      trialDays: String(plan.trialDays),
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.displayName) {
      toast.error("이름과 표시명은 필수입니다");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        displayName: form.displayName,
        price: parseInt(form.price) || 0,
        maxSellers: parseInt(form.maxSellers) || 0,
        maxMonthlyOrders: parseInt(form.maxMonthlyOrders) || 0,
        maxProducts: parseInt(form.maxProducts) || 0,
        maxDailyAiChats: parseInt(form.maxDailyAiChats) || 0,
        hasExcel: form.hasExcel,
        hasFullStats: form.hasFullStats,
        trialDays: parseInt(form.trialDays) || 0,
        isActive: form.isActive,
        sortOrder: parseInt(form.sortOrder) || 0,
      };

      const url = editingPlan
        ? `/api/super-admin/plans/${editingPlan.id}`
        : "/api/super-admin/plans";
      const method = editingPlan ? "PATCH" : "POST";

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

      toast.success(editingPlan ? "요금제가 수정되었습니다" : "요금제가 추가되었습니다");
      setDialogOpen(false);
      fetchPlans();
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (plan._count.tenants > 0) {
      toast.error(`이 요금제를 사용 중인 테넌트가 ${plan._count.tenants}개 있어 삭제할 수 없습니다`);
      return;
    }
    if (!confirm(`"${plan.displayName}" 요금제를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/super-admin/plans/${plan.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error?.message || "삭제할 수 없습니다");
        return;
      }

      toast.success("요금제가 삭제되었습니다");
      fetchPlans();
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">요금제 관리</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          요금제 추가
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      ) : plans.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          등록된 요금제가 없습니다. 요금제를 추가해주세요.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.isActive ? "opacity-60" : ""}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-lg">{plan.displayName}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.name}</p>
                </div>
                <div className="flex gap-1">
                  {!plan.isActive && (
                    <Badge variant="secondary">비활성</Badge>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(plan)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(plan)}
                    className="text-red-500 hover:text-red-700"
                    disabled={plan._count.tenants > 0}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-2xl font-bold">{formatPrice(plan.price)}</div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      셀러 수
                    </span>
                    <span className="font-medium">{formatLimit(plan.maxSellers)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <ShoppingCart className="h-3.5 w-3.5" />
                      월 주문 수
                    </span>
                    <span className="font-medium">{formatLimit(plan.maxMonthlyOrders)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      상품 수
                    </span>
                    <span className="font-medium">{formatLimit(plan.maxProducts)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5" />
                      일 AI 채팅
                    </span>
                    <span className="font-medium">{formatLimit(plan.maxDailyAiChats)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {plan.hasExcel && <Badge variant="outline">엑셀</Badge>}
                  {plan.hasFullStats && <Badge variant="outline">전체 통계</Badge>}
                  {plan.trialDays > 0 && (
                    <Badge variant="outline">체험 {plan.trialDays}일</Badge>
                  )}
                </div>

                <div className="flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">사용 중인 테넌트</span>
                  <Badge variant="secondary">{plan._count.tenants}개</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingPlan ? "요금제 수정" : "요금제 추가"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>이름 (고유키)</Label>
                <Input
                  placeholder="예: basic, pro, enterprise"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>표시명</Label>
                <Input
                  placeholder="예: 베이직, 프로, 엔터프라이즈"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>월 요금 (원)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>정렬 순서</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최대 셀러 수 (-1=무제한)</Label>
                <Input
                  type="number"
                  value={form.maxSellers}
                  onChange={(e) => setForm({ ...form, maxSellers: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>월 최대 주문 수 (-1=무제한)</Label>
                <Input
                  type="number"
                  value={form.maxMonthlyOrders}
                  onChange={(e) => setForm({ ...form, maxMonthlyOrders: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최대 상품 수 (-1=무제한)</Label>
                <Input
                  type="number"
                  value={form.maxProducts}
                  onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>일 AI 채팅 수 (-1=무제한)</Label>
                <Input
                  type="number"
                  value={form.maxDailyAiChats}
                  onChange={(e) => setForm({ ...form, maxDailyAiChats: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>체험 기간 (일)</Label>
              <Input
                type="number"
                value={form.trialDays}
                onChange={(e) => setForm({ ...form, trialDays: e.target.value })}
              />
            </div>

            <div className="space-y-3 rounded-md border p-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="hasExcel">엑셀 기능</Label>
                <Switch
                  id="hasExcel"
                  checked={form.hasExcel}
                  onCheckedChange={(v) => setForm({ ...form, hasExcel: v === true })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="hasFullStats">전체 통계</Label>
                <Switch
                  id="hasFullStats"
                  checked={form.hasFullStats}
                  onCheckedChange={(v) => setForm({ ...form, hasFullStats: v === true })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">활성 상태</Label>
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v === true })}
                />
              </div>
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !form.name || !form.displayName}
            >
              {submitting ? "처리 중..." : editingPlan ? "수정" : "추가"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
