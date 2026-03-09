"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RegisterType = "ADMIN" | "SELLER";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registerType, setRegisterType] = useState<RegisterType>("ADMIN");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    let body: Record<string, unknown>;

    if (registerType === "ADMIN") {
      body = {
        registerType: "ADMIN",
        email: formData.get("email"),
        password: formData.get("password"),
        name: formData.get("name"),
        phone: formData.get("phone"),
        businessName: formData.get("businessName"),
        slug: formData.get("slug"),
      };
    } else {
      body = {
        registerType: "SELLER",
        email: formData.get("email"),
        password: formData.get("password"),
        name: formData.get("name"),
        phone: formData.get("phone"),
        businessName: formData.get("businessName"),
        businessNumber: formData.get("businessNumber"),
        bizLicenseUrl: "pending-upload", // TODO: 파일 업로드 후 URL 반영
        inviteCode: formData.get("inviteCode"),
      };
    }

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
      setError("서버와 통신 중 오류가 발생했습니다");
      setLoading(false);
    }
  }

  const description =
    registerType === "ADMIN"
      ? "업체 정보를 입력하고 관리자 계정을 생성합니다."
      : "사업자 정보를 입력해주세요. 관리자 승인 후 이용 가능합니다.";

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">회원가입</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          defaultValue="ADMIN"
          onValueChange={(value) => {
            setRegisterType(value as RegisterType);
            setError("");
          }}
          className="mb-6"
        >
          <TabsList className="w-full">
            <TabsTrigger value="ADMIN" className="flex-1">
              업체 관리자로 시작
            </TabsTrigger>
            <TabsTrigger value="SELLER" className="flex-1">
              셀러로 가입
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ADMIN">
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">이메일 *</Label>
                <Input id="admin-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">비밀번호 *</Label>
                <Input id="admin-password" name="password" type="password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-name">이름 *</Label>
                <Input id="admin-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-phone">연락처</Label>
                <Input id="admin-phone" name="phone" type="tel" placeholder="010-0000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-businessName">업체명 *</Label>
                <Input id="admin-businessName" name="businessName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-slug">URL 슬러그 *</Label>
                <Input
                  id="admin-slug"
                  name="slug"
                  placeholder="my-company"
                  pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                  title="영문 소문자, 숫자, 하이픈만 사용 가능합니다"
                  required
                />
                <p className="text-xs text-gray-500">
                  영문 소문자, 숫자, 하이픈만 사용 가능 (예: my-company)
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "등록 중..." : "업체 등록하기"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="SELLER">
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="seller-inviteCode">초대 코드 *</Label>
                <Input
                  id="seller-inviteCode"
                  name="inviteCode"
                  placeholder="관리자에게 받은 초대 코드를 입력하세요"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-email">이메일 *</Label>
                <Input id="seller-email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-password">비밀번호 *</Label>
                <Input id="seller-password" name="password" type="password" minLength={8} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-name">이름 *</Label>
                <Input id="seller-name" name="name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-phone">연락처</Label>
                <Input id="seller-phone" name="phone" type="tel" placeholder="010-0000-0000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-businessName">상호명 *</Label>
                <Input id="seller-businessName" name="businessName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-businessNumber">사업자번호 *</Label>
                <Input
                  id="seller-businessNumber"
                  name="businessNumber"
                  placeholder="000-00-00000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seller-bizLicense">사업자등록증 *</Label>
                <Input
                  id="seller-bizLicense"
                  name="bizLicense"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <p className="text-xs text-gray-500">PDF, JPG, PNG 파일만 가능합니다</p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "가입 신청 중..." : "회원가입 신청"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="text-center text-sm text-gray-500">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            로그인
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
