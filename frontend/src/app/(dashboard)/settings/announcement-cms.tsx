"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AnnouncementImage,
  AnnouncementPopup,
  AnnouncementSettings,
} from "@/components/announcement-popup";
import {
  ArrowDown,
  ArrowUp,
  Clock,
  Eye,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function AnnouncementCMS() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [images, setImages] = useState<AnnouncementImage[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current announcement settings
  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/announcements");
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อมูลการตั้งค่าประกาศได้");
      const data: AnnouncementSettings = await res.json();
      setIsEnabled(data.isEnabled || false);
      setIntervalSeconds(data.intervalSeconds || 5);
      setImages(data.images || []);
      setUpdatedAt(data.updatedAt || null);
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  // Handle image upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 6 - images.length;
    if (availableSlots <= 0) {
      toast.error("สามารถอัปโหลดรูปภาพประกาศได้สูงสุด 6 รูป");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    const filesToUpload = Array.from(files).slice(0, availableSlots);
    setIsUploading(true);

    let successCount = 0;
    const uploadedImages: AnnouncementImage[] = [];

    for (const file of filesToUpload) {
      if (!file.type.startsWith("image/")) {
        toast.error(`ไฟล์ ${file.name} ไม่ใช่ไฟล์รูปภาพ`);
        continue;
      }
      if (file.size > 20 * 1024 * 1024) {
        toast.error(`ไฟล์ ${file.name} มีขนาดใหญ่เกิน 20MB`);
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          throw new Error(`อัปโหลด ${file.name} ล้มเหลว`);
        }

        const data = await res.json();
        uploadedImages.push({
          id: crypto.randomUUID(),
          url: data.url,
          title: "",
          linkUrl: "",
        });
        successCount++;
      } catch (error: any) {
        toast.error(error.message || `ไม่สามารถอัปโหลด ${file.name}`);
      }
    }

    if (uploadedImages.length > 0) {
      setImages((prev) => [...prev, ...uploadedImages]);
      setIsEnabled(true);
      toast.success(`อัปโหลดรูปภาพสำเร็จ ${successCount} รูป (เปิดใช้งานประกาศแล้ว)`);
    }

    setIsUploading(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Re-order image
  const moveImage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= images.length) return;

    const next = [...images];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;
    setImages(next);
  };

  // Remove image
  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    toast.info("ลบรูปภาพออกจากรายการแล้ว (กดบันทึกเพื่อยืนยัน)");
  };

  // Update image fields
  const updateImageField = (
    index: number,
    field: "title" | "linkUrl",
    value: string
  ) => {
    setImages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  // Save settings
  const handleSave = async () => {
    if (intervalSeconds < 2 || intervalSeconds > 60) {
      toast.error("ระยะเวลาหมุนเวียนรูปภาพต้องอยู่ระหว่าง 2 ถึง 60 วินาที");
      return;
    }

    setIsSaving(true);
    try {
      let token =
        typeof window !== "undefined"
          ? localStorage.getItem("auth_token")
          : null;
      if (!token && typeof document !== "undefined") {
        const match =
          document.cookie.match(/auth_token=([^;]+)/) ||
          document.cookie.match(/better-auth\.session_token=([^;]+)/);
        if (match) {
          token = decodeURIComponent(match[1]).split(".")[0].replace(/^s:/, "");
        }
      }

      const headers: HeadersInit = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const res = await fetch("/api/announcements", {
        method: "PUT",
        headers,
        credentials: "include",
        body: JSON.stringify({
          isEnabled,
          intervalSeconds,
          images,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.detail || errData.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
        );
      }

      const data: AnnouncementSettings = await res.json();
      setIsEnabled(data.isEnabled);
      setIntervalSeconds(data.intervalSeconds);
      setImages(data.images || []);
      setUpdatedAt(data.updatedAt || null);

      toast.success("บันทึกการตั้งค่าประกาศข่าวสารหน้า Login สำเร็จ");
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">
            กำลังโหลดข้อมูลระบบ CMS ประกาศข่าวสาร...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-blue-600 dark:text-blue-400" />
                <CardTitle className="text-lg font-bold">
                  ระบบ CMS ประกาศข่าวสารหน้า Login
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                กำหนดการแสดง Popup ข่าวสารและประชาสัมพันธ์สำหรับผู้ใช้งานก่อนเข้าสู่ระบบ (สูงสุด 6 รูป)
              </CardDescription>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                disabled={images.length === 0}
                className="gap-1.5 text-xs h-9 cursor-pointer"
                title={
                  images.length === 0
                    ? "กรุณาเพิ่มรูปภาพก่อนดูตัวอย่าง"
                    : "ดูตัวอย่าง Popup เสมือนจริง"
                }
              >
                <Eye className="size-4 text-slate-500" />
                <span>ดูตัวอย่าง Popup</span>
              </Button>

              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="gap-1.5 text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <>
                    <Save className="size-4" />
                    <span>บันทึกการตั้งค่า</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Main Controls Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800">
            {/* Toggle Status */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 shadow-2xs">
              <div className="space-y-1 pr-4">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="cms-toggle"
                    className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    สถานะการแสดงผลบนหน้า Login
                  </Label>
                  <span
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1",
                      isEnabled
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isEnabled ? "bg-emerald-500" : "bg-slate-400"
                      )}
                    />
                    {isEnabled ? "กำลังเปิดใช้งาน" : "ปิดใช้งานชั่วคราว"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  เมื่อเปิดใช้งาน ผู้เข้าใช้งานหน้า Login จะเห็น Popup ประกาศข่าวสาร
                </p>
              </div>

              {/* Custom Switch Button */}
              <button
                id="cms-toggle"
                type="button"
                role="switch"
                aria-checked={isEnabled}
                onClick={() => setIsEnabled(!isEnabled)}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
                  isEnabled ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    isEnabled ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>

            {/* Timing Slider / Input */}
            <div className="p-3 rounded-lg bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="interval-input"
                  className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5"
                >
                  <Clock className="size-3.5 text-blue-600 dark:text-blue-400" />
                  <span>ระยะเวลาเปลี่ยนรูป (Timing)</span>
                </Label>
                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                  {intervalSeconds} วินาที
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Input
                  id="interval-input"
                  type="number"
                  min={2}
                  max={60}
                  value={intervalSeconds}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) setIntervalSeconds(val);
                  }}
                  className="w-24 h-8 text-xs font-medium"
                />
                <div className="flex items-center gap-1">
                  {[3, 5, 7, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setIntervalSeconds(sec)}
                      className={cn(
                        "px-2.5 py-1 text-[11px] font-medium rounded-md border transition-all cursor-pointer",
                        intervalSeconds === sec
                          ? "bg-blue-50 border-blue-600 text-blue-700 dark:bg-blue-950/40 dark:border-blue-500 dark:text-blue-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                      )}
                    >
                      {sec} วิ
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-[10.5px] text-muted-foreground">
                กำหนดเวลาแสดงแต่ละภาพก่อนเลื่อนไปยังภาพถัดไปโดยอัตโนมัติ (2 - 60 วินาที)
              </p>
            </div>
          </div>

          {/* Warning banner if images exist but disabled */}
          {images.length > 0 && !isEnabled && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              <span>
                ขณะนี้สถานะปิดการแสดงผลอยู่ Popup จะไม่แสดงบนหน้า Login จนกว่าจะเปิดสวิตช์ด้านบนและกดบันทึกการตั้งค่า
              </span>
            </div>
          )}

          {/* Image Manager Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>รูปภาพประกาศข่าวสาร</span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                    {images.length} / 6 รูป
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  อัปโหลดได้สูงสุด 6 รูป รองรับไฟล์ PNG, JPG, JPEG, WEBP (เรียงลำดับจากบนลงล่าง)
                </p>
              </div>

              {/* Upload trigger button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={images.length >= 6 || isUploading}
                  className="gap-1.5 text-xs h-9 cursor-pointer border-dashed"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-blue-600" />
                      <span>กำลังอัปโหลด...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="size-3.5" />
                      <span>เพิ่มรูปภาพประกาศ</span>
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Empty State / Dropzone */}
            {images.length === 0 ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all"
              >
                <div className="size-12 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                  <UploadCloud className="size-6" />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  คลิกเพื่อเลือกไฟล์รูปภาพประกาศ
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  ยังไม่มีรูปภาพประกาศข่าวสาร สามารถอัปโหลดได้สูงสุด 6 รูป
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-4 text-xs h-8 cursor-pointer"
                >
                  เลือกไฟล์รูปภาพ
                </Button>
              </div>
            ) : (
              /* Image Cards List */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {images.map((img, index) => (
                  <Card
                    key={img.id || index}
                    className="overflow-hidden border-slate-200/90 dark:border-slate-800 shadow-2xs group"
                  >
                    <div className="flex flex-col sm:flex-row h-full">
                      {/* Image Thumbnail */}
                      <div className="relative w-full sm:w-44 aspect-[16/10] sm:aspect-auto sm:h-full bg-slate-950 shrink-0 flex items-center justify-center overflow-hidden">
                        <img
                          src={img.url}
                          alt={img.title || `รูปที่ ${index + 1}`}
                          className="max-h-full max-w-full object-contain"
                        />
                        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          #{index + 1}
                        </div>
                      </div>

                      {/* Content Fields */}
                      <div className="flex-1 p-3.5 flex flex-col justify-between gap-3">
                        <div className="space-y-2">
                          <div>
                            <Label
                              htmlFor={`title-${index}`}
                              className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1"
                            >
                              หัวข้อ / คำอธิบายภาพ (ไม่บังคับ)
                            </Label>
                            <Input
                              id={`title-${index}`}
                              type="text"
                              placeholder="เช่น ประกาศปิดระบบปรับปรุงชั่วคราว..."
                              value={img.title || ""}
                              onChange={(e) =>
                                updateImageField(index, "title", e.target.value)
                              }
                              className="h-8 text-xs placeholder:text-muted-foreground/60"
                            />
                          </div>

                          <div>
                            <Label
                              htmlFor={`link-${index}`}
                              className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1"
                            >
                              ลิงก์ปลายทางเมื่อคลิก (ไม่บังคับ)
                            </Label>
                            <div className="relative">
                              <Input
                                id={`link-${index}`}
                                type="url"
                                placeholder="https://fisheries.go.th/..."
                                value={img.linkUrl || ""}
                                onChange={(e) =>
                                  updateImageField(
                                    index,
                                    "linkUrl",
                                    e.target.value
                                  )
                                }
                                className="h-8 text-xs pl-7 placeholder:text-muted-foreground/60"
                              />
                              <ExternalLink className="size-3.5 text-muted-foreground absolute left-2 top-2.5" />
                            </div>
                          </div>
                        </div>

                        {/* Card Action Buttons */}
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === 0}
                              onClick={() => moveImage(index, "up")}
                              title="เลื่อนขึ้น / แสดงก่อน"
                              className="size-7 rounded cursor-pointer"
                            >
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={index === images.length - 1}
                              onClick={() => moveImage(index, "down")}
                              title="เลื่อนลง / แสดงถัดไป"
                              className="size-7 rounded cursor-pointer"
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeImage(index)}
                            className="size-7 rounded text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                            title="ลบรูปภาพนี้"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Live Preview Modal */}
      <AnnouncementPopup
        previewMode
        previewSettings={{
          isEnabled,
          intervalSeconds,
          images,
        }}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  );
}

