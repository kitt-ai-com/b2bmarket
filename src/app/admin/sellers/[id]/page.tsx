"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, CheckCircle, XCircle, Ban } from "lucide-react";
import { toast } from "sonner";

interface SellerDetail {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  sellerProfile: {
    id: string;
    businessName: string;
    businessNumber: string;
    bizLicenseUrl: string;
    customFeeRate: string | null;
    salesChannels: string[] | null;
    createdAt: string;
    grade: {
      id: string;
      name: string;
      level: number;
      feeRate: string;
    };
  } | null;
  _count: { orders: number; inquiries: number };
}

interface Grade {
  id: string;
  name: string;
  level: number;
  feeRate: string;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "승인대기", variant: "outline" },
  ACTIVE: { label: "활성", variant: "default" },
  SUSPENDED: { label: "정지", variant: "secondary" },
  REJECTED: { label: "반려", variant: "destructive" },
};

export default function SellerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGradeId, setSelectedGradeId] = useState("");
  const [customFeeRate, setCustomFeeRate] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sellerRes, gradesRes] = await Promise.all([
          fetch(`/api/admin/sellers/${params.id}`),
          fetch("/api/admin/grades"),
        ]);

        const sellerJson = await sellerRes.json();
        const gradesJson = await gradesRes.json();

        if (sellerRes.ok) {
          setSeller(sellerJson.data);
          setSelectedGradeId(sellerJson.data.sellerProfile?.grade.id || "");
          setCustomFeeRate(sellerJson.data.sellerProfile?.customFeeRate || "");
        } else {
          toast.error("셀러를 찾을 수 없습니다");
          router.push("/admin/sellers");
        }

        if (gradesRes.ok) setGrades(gradesJson.data);
      } catch {
        toast.error("데이터를 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [params.id, router]);

  const handleStatusChange = async (status: string) => {
    const labels: Record<string, string> = {
      ACTIVE: "승인",
      REJECTED: "반려",
      SUSPENDED: "정지",
      PENDING: "승인대기 상태로 변경",
    };
    if (!confirm(`이 셀러를 ${labels[status]}하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/sellers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "오류가 발생했습니다");
        return;
      }

      toast.success(`셀러가 ${labels[status]}되었습니다`);
      setSeller((prev) => prev ? { ...prev, status } : prev);
    } catch {
      toast.error("오류가 발생했습니다");
    }
  };

  const handleSaveGradeAndFee = async () => {
    setSaving(true);
    try {
      const payload: any = {};
      if (selectedGradeId && selectedGradeId !== seller?.sellerProfile?.grade.id) {
        payload.gradeId = selectedGradeId;
      }
      const feeVal = customFeeRate === "" ? null : parseFloat(customFeeRate);
      const currentFee = seller?.sellerProfile?.customFeeRate ? parseFloat(seller.sellerProfile.customFeeRate) : null;
      if (feeVal !== currentFee) {
        payload.customFeeRate = feeVal;
      }

      if (Object.keys(payload).length === 0) {
        toast.info("변경사항이 없습니다");
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/admin/sellers/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error?.message || "오류가 발생했습니다");
        return;
      }

      toast.success("등급/수수료가 변경되었습니다");

      // 새로고침
      const refreshRes = await fetch(`/api/admin/sellers/${params.id}`);
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setSeller(json.data);
        setSelectedGradeId(json.data.sellerProfile?.grade.id || "");
        setCustomFeeRate(json.data.sellerProfile?.customFeeRate || "");
      }
    } catch {
      toast.error("오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!seller) return null;

  const cfg = statusConfig[seller.status] || statusConfig.PENDING;
  const effectiveFee = seller.sellerProfile?.customFeeRate || seller.sellerProfile?.grade.feeRate;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/sellers")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          셀러 목록
        </Button>
        <h1 className="text-2xl font-bold">{seller.name}</h1>
        <Badge variant={cfg.variant}>{cfg.label}</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>기본 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">이름</p>
                <p className="font-medium">{seller.name}</p>
              </div>
              <div>
                <p className="text-gray-500">이메일</p>
                <p className="font-medium">{seller.email}</p>
              </div>
              <div>
                <p className="text-gray-500">연락처</p>
                <p className="font-medium">{seller.phone || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">가입일</p>
                <p className="font-medium">
                  {new Date(seller.createdAt).toLocaleDateString("ko-KR")}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">총 주문</p>
                <p className="font-medium">{seller._count.orders}건</p>
              </div>
              <div>
                <p className="text-gray-500">문의</p>
                <p className="font-medium">{seller._count.inquiries}건</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 사업자 정보 */}
        <Card>
          <CardHeader>
            <CardTitle>사업자 정보</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">상호명</p>
                <p className="font-medium">{seller.sellerProfile?.businessName || "-"}</p>
              </div>
              <div>
                <p className="text-gray-500">사업자번호</p>
                <p className="font-medium">{seller.sellerProfile?.businessNumber || "-"}</p>
              </div>
            </div>
            {seller.sellerProfile?.bizLicenseUrl && (
              <div className="text-sm">
                <p className="text-gray-500">사업자등록증</p>
                <a
                  href={seller.sellerProfile.bizLicenseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  파일 보기
                </a>
              </div>
            )}
            {seller.sellerProfile?.salesChannels && (
              <div className="text-sm">
                <p className="mb-1 text-gray-500">판매 채널</p>
                <div className="flex gap-1">
                  {(seller.sellerProfile.salesChannels as string[]).map((ch) => (
                    <Badge key={ch} variant="secondary">{ch}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 등급 & 수수료 설정 */}
        <Card>
          <CardHeader>
            <CardTitle>등급 & 수수료</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>셀러 등급</Label>
              <Select value={selectedGradeId} onValueChange={setSelectedGradeId}>
                <SelectTrigger>
                  <SelectValue placeholder="등급 선택" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name} (수수료 {g.feeRate}%)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>개별 수수료율 (%)</Label>
              <Input
                type="number"
                step="0.1"
                placeholder="비워두면 등급 수수료 적용"
                value={customFeeRate}
                onChange={(e) => setCustomFeeRate(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                현재 적용 수수료: {effectiveFee}%
                {seller.sellerProfile?.customFeeRate && " (개별 설정)"}
              </p>
            </div>

            <Button onClick={handleSaveGradeAndFee} disabled={saving} className="w-full">
              {saving ? "저장 중..." : "등급/수수료 저장"}
            </Button>
          </CardContent>
        </Card>

        {/* 상태 관리 */}
        <Card>
          <CardHeader>
            <CardTitle>상태 관리</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              현재 상태: <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </p>
            <div className="flex flex-wrap gap-2">
              {seller.status !== "ACTIVE" && (
                <Button
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => handleStatusChange("ACTIVE")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  승인
                </Button>
              )}
              {seller.status !== "REJECTED" && seller.status === "PENDING" && (
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => handleStatusChange("REJECTED")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  반려
                </Button>
              )}
              {seller.status === "ACTIVE" && (
                <Button
                  variant="outline"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                  onClick={() => handleStatusChange("SUSPENDED")}
                >
                  <Ban className="mr-2 h-4 w-4" />
                  정지
                </Button>
              )}
              {seller.status === "SUSPENDED" && (
                <Button
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => handleStatusChange("ACTIVE")}
                >
                  <CheckCircle className="mr-2 h-4 w-4" />
                  정지 해제
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
