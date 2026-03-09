"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface InviteStatus {
  valid: boolean;
  tenantName?: string;
  reason?: string;
}

export default function InviteRegisterPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkInvite() {
      try {
        const res = await fetch(`/api/invite/${code}`);
        const data = await res.json();
        setInviteStatus(data);
      } catch {
        setInviteStatus({ valid: false, reason: "초대 코드 확인에 실패했습니다" });
      } finally {
        setChecking(false);
      }
    }
    checkInvite();
  }, [code]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const body = {
      registerType: "SELLER",
      email: formData.get("email"),
      password: formData.get("password"),
      name: formData.get("name"),
      phone: formData.get("phone") || undefined,
      businessName: formData.get("businessName"),
      businessNumber: formData.get("businessNumber"),
      bizLicenseUrl: "pending-upload",
      inviteCode: code,
    };

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error?.message || "회원가입에 실패했습니다");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("서버 오류가 발생했습니다");
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="py-8">
            <div className="text-center text-gray-500">초대 코드 확인 중...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteStatus?.valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-red-600">
              유효하지 않은 초대 링크
            </CardTitle>
            <CardDescription>
              {inviteStatus?.reason || "유효하지 않은 초대 링크입니다"}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link href="/login">
              <Button variant="outline">로그인 페이지로</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">셀러 회원가입</CardTitle>
          <CardDescription>
            <span className="font-semibold text-blue-600">
              {inviteStatus.tenantName}
            </span>
            에 셀러로 가입합니다.
            <br />
            사업자 정보를 입력해주세요. 관리자 승인 후 이용 가능합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">이메일 *</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">이름 *</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">연락처</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="010-0000-0000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessName">상호명 *</Label>
              <Input id="businessName" name="businessName" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="businessNumber">사업자번호 *</Label>
              <Input
                id="businessNumber"
                name="businessNumber"
                placeholder="000-00-00000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bizLicense">사업자등록증 *</Label>
              <Input
                id="bizLicense"
                name="bizLicense"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
              />
              <p className="text-xs text-gray-500">
                PDF, JPG, PNG 파일만 가능합니다
              </p>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "가입 신청 중..." : "회원가입 신청"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              로그인
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
