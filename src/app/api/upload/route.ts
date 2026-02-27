export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "products";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: { message: "인증이 필요합니다" } },
      { status: 401 }
    );
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: { message: "파일을 선택해주세요" } },
        { status: 400 }
      );
    }

    if (files.length > 6) {
      return NextResponse.json(
        { error: { message: "최대 6개까지 업로드 가능합니다" } },
        { status: 400 }
      );
    }

    const uploadResults: { url: string; path: string }[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: { message: `지원하지 않는 파일 형식입니다: ${file.name}` } },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: { message: `파일 크기가 5MB를 초과합니다: ${file.name}` } },
          { status: 400 }
        );
      }

      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${crypto.randomUUID()}.${ext}`;
      const filePath = `products/${fileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(filePath, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (error) {
        console.error("Supabase upload error:", error);
        return NextResponse.json(
          { error: { message: `업로드 실패: ${file.name}` } },
          { status: 500 }
        );
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      uploadResults.push({
        url: urlData.publicUrl,
        path: filePath,
      });
    }

    return NextResponse.json({ data: uploadResults }, { status: 200 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: { message: "업로드 중 오류가 발생했습니다" } },
      { status: 500 }
    );
  }
}
