import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let baseName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    let ext = "";
    const lastDot = baseName.lastIndexOf(".");
    if (lastDot !== -1 && lastDot > 0) {
      ext = baseName.substring(lastDot);
      baseName = baseName.substring(0, lastDot);
    }
    if (baseName.length > 50) baseName = baseName.substring(0, 50);

    const filename = `${crypto.randomUUID()}-${baseName}${ext}`;
    const uploadDir = join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/${filename}`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
