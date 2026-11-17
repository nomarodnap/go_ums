"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  User,
  Phone,
  Mail,
  Building,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  Check,
  Loader2,
  Link2,
  RefreshCw,
  QrCode,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { GoogleIcon } from "@/components/icons/google-icon";
import { LineIcon } from "@/components/icons/line-icon";

interface UserProfileData {
  id?: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
  department?: string;
  phone?: string;
  isGoogle?: boolean;
  isLine?: boolean;
  googleEmail?: string | null;
  lineName?: string | null;
  lineEmail?: string | null;
}

function DialogUserAvatar({
  image,
  name,
}: {
  image?: string | null;
  name: string;
}) {
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [image]);

  return (
    <div className="relative flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary overflow-hidden ring-1 ring-black/5 dark:ring-white/10 shrink-0">
      {image && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt={name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover rounded-xl z-10"
          onError={() => setImageError(true)}
        />
      ) : (
        <User className="size-5" />
      )}
    </div>
  );
}

interface EditProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfileData;
  roleLabel: string;
}

export function EditProfileDialog({
  open,
  onOpenChange,
  user,
  roleLabel,
}: EditProfileDialogProps) {
  const queryClient = useQueryClient();

  const [name, setName] = React.useState(user.name || "");
  const [phone, setPhone] = React.useState(user.phone || "");

  // Password state
  const [changePassword, setChangePassword] = React.useState(false);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [linkingProvider, setLinkingProvider] = React.useState<"google" | "line" | null>(null);
  const [linkingAction, setLinkingAction] = React.useState<"connect" | "resync" | null>(null);
  const [showLineQrModal, setShowLineQrModal] = React.useState(false);

  // Sync state when dialog opens or user changes
  React.useEffect(() => {
    if (open) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setLinkingProvider(null);
      setLinkingAction(null);
      setShowLineQrModal(false);
    }
  }, [open, user]);

  const handleSocialConnect = async (provider: "google" | "line", isResync = false) => {
    const label = provider === "line" ? "LINE" : "Google Workspace";
    setLinkingProvider(provider);
    setLinkingAction(isResync ? "resync" : "connect");
    try {
      if (isResync) {
        const unlinkRes = await fetch(`/api/auth/me?provider=${encodeURIComponent(provider)}`, {
          method: "DELETE",
        });
        if (!unlinkRes.ok) {
          const errData = await unlinkRes.json().catch(() => ({}));
          if (errData?.code !== "LAST_ACCOUNT") {
            toast.error(errData?.message || `ไม่สามารถล้างการเชื่อมต่อ ${label} เดิมได้`);
            setLinkingProvider(null);
            setLinkingAction(null);
            return;
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      }

      const currentPath =
        typeof window !== "undefined" ? window.location.pathname || "/dashboard" : "/dashboard";
      const res = await authClient.linkSocial({
        provider,
        callbackURL: `${currentPath}?auth_linked=${provider}`,
        errorCallbackURL: `${currentPath}?auth_link_error=${provider}`,
        ...(isResync
          ? {
              additionalParams:
                provider === "line"
                  ? { prompt: "consent", bot_prompt: "aggressive" }
                  : { prompt: "select_account consent" },
            }
          : {}),
      });
      if (res?.error) {
        toast.error(res.error.message || `ไม่สามารถเชื่อมต่อบัญชี ${label} ได้ในขณะนี้`);
        setLinkingProvider(null);
        setLinkingAction(null);
      }
    } catch {
      toast.error(`ไม่สามารถเชื่อมต่อบริการ ${label} ได้ กรุณาลองใหม่อีกครั้ง`);
      setLinkingProvider(null);
      setLinkingAction(null);
      setShowLineQrModal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("กรุณาระบุชื่อ-นามสกุล");
      return;
    }

    if (changePassword) {
      if (!currentPassword) {
        toast.error("กรุณาระบุรหัสผ่านปัจจุบัน");
        return;
      }
      if (newPassword.length < 8) {
        toast.error("รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error("รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: {
        name: string;
        phone: string;
        currentPassword?: string;
        newPassword?: string;
      } = {
        name: name.trim(),
        phone: phone.trim(),
      };

      if (changePassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
      }

      toast.success(data.message || "บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl">
          <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 pb-4 bg-muted/20 border-b border-black/[0.04] dark:border-white/[0.06]">
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <DialogUserAvatar image={user.image} name={user.name} />
                <div>
                  <DialogTitle className="text-lg font-semibold">
                    แก้ไขข้อมูลส่วนตัว
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    จัดการข้อมูลโปรไฟล์และเปลี่ยนรหัสผ่านของคุณ
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Read-Only Account Badges */}
            <div className="mt-4 p-3 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs gap-2">
                <span className="flex items-center gap-1.5 text-muted-foreground truncate min-w-0">
                  {user.isGoogle ? (
                    <GoogleIcon className="size-3.5 shrink-0" />
                  ) : user.isLine ? (
                    <LineIcon className="size-3.5 shrink-0" />
                  ) : (
                    <Mail className="size-3.5 shrink-0" />
                  )}
                  <span className="truncate">{user.email}</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {user.isGoogle && (
                    <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                      <GoogleIcon className="size-2.5 mr-1" />
                      Google
                    </Badge>
                  )}
                  {user.isLine && (
                    <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5">
                      <LineIcon className="size-2.5 mr-1" />
                      LINE
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px] py-0 px-2">
                    <Shield className="size-3 mr-1" />
                    {roleLabel}
                  </Badge>
                </div>
              </div>
              {user.department && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/80 border-t border-black/[0.03] dark:border-white/[0.04] pt-2">
                  <Building className="size-3.5 shrink-0" />
                  <span className="truncate">{user.department}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-name" className="text-xs font-medium">
                ชื่อ-นามสกุล <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  id="profile-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น นายสมชาย ใจดี"
                  required
                  className="pl-9 h-10"
                />
                <User className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              </div>
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-phone" className="text-xs font-medium">
                เบอร์โทรศัพท์
              </Label>
              <div className="relative">
                <Input
                  id="profile-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="เช่น 0812345678"
                  className="pl-9 h-10"
                />
                <Phone className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
              </div>
            </div>

            {/* Connected Auth Accounts (Connect & Sync for LINE and Google) */}
            <div className="pt-3 border-t border-black/[0.04] dark:border-white/[0.06] space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Link2 aria-hidden="true" className="size-3.5 text-primary shrink-0" />
                    เชื่อมต่อบัญชีเข้าสู่ระบบ (Connect &amp; Sync)
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    เชื่อมบัญชี LINE หรือ Google ไว้กับผู้ใช้งานนี้ เพื่อใช้เข้าสู่ระบบครั้งถัดไปได้ทันทีแม้บัญชี LINE ไม่มีอีเมล
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {/* LINE Connect / Sync Row */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] shrink-0">
                      <LineIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">LINE</span>
                        {user.isLine ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5"
                          >
                            เชื่อมต่อแล้ว
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            ยังไม่เชื่อมต่อ
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.isLine
                          ? user.lineName || user.lineEmail || "พร้อมใช้เข้าสู่ระบบด้วย LINE"
                          : "ใช้ LINE Login ครั้งถัดไปได้แม้ไม่ผูกอีเมล"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setShowLineQrModal(true)}
                      title="ดู QR Code สำหรับเพิ่มเพื่อน LINE OA"
                      className="size-8 rounded-xl text-muted-foreground hover:text-[#06C755] hover:bg-[#06C755]/10 cursor-pointer"
                    >
                      <QrCode className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={user.isLine ? "outline" : "default"}
                      disabled={isSubmitting || linkingProvider !== null}
                      aria-busy={linkingProvider === "line"}
                      onClick={() => setShowLineQrModal(true)}
                      className="h-8 px-3 text-xs rounded-xl shrink-0 gap-1.5 cursor-pointer"
                    >
                      {linkingProvider === "line" ? (
                        <>
                          <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                          {linkingAction === "resync" ? "กำลังเชื่อมใหม่..." : "กำลังเชื่อมต่อ..."}
                        </>
                      ) : user.isLine ? (
                        <>
                          <RefreshCw aria-hidden="true" className="size-3.5" />
                          Resync LINE
                        </>
                      ) : (
                        "เชื่อมต่อ LINE"
                      )}
                    </Button>
                  </div>
                </div>

                {/* Google Connect / Sync Row */}
                <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.05] dark:border-white/[0.06]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-black/[0.06] dark:border-white/[0.08] shrink-0">
                      <GoogleIcon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">Google</span>
                        {user.isGoogle ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5"
                          >
                            เชื่อมต่อแล้ว
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                            ยังไม่เชื่อมต่อ
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {user.isGoogle
                          ? user.googleEmail || "พร้อมใช้เข้าสู่ระบบด้วย Google"
                          : "เชื่อมบัญชี Google เพื่อเข้าสู่ระบบครั้งถัดไป"}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={user.isGoogle ? "outline" : "default"}
                    disabled={isSubmitting || linkingProvider !== null}
                    aria-busy={linkingProvider === "google"}
                    onClick={() => handleSocialConnect("google", Boolean(user.isGoogle))}
                    className="h-8 px-3 text-xs rounded-xl shrink-0 gap-1.5 cursor-pointer"
                  >
                    {linkingProvider === "google" ? (
                      <>
                        <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                        {linkingAction === "resync" ? "กำลังเชื่อมใหม่..." : "กำลังเชื่อมต่อ..."}
                      </>
                    ) : user.isGoogle ? (
                      <>
                        <RefreshCw aria-hidden="true" className="size-3.5" />
                        Resync Google
                      </>
                    ) : (
                      "เชื่อมต่อ Google"
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Change Password Toggle */}
            <div className="pt-2 border-t border-black/[0.04] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setChangePassword(!changePassword)}
                className="flex items-center justify-between w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <KeyRound className="size-4 text-primary group-hover:scale-110 transition-transform" />
                  ต้องการเปลี่ยนรหัสผ่าน
                </span>
                <span className="text-[11px] text-primary underline">
                  {changePassword ? "ยกเลิกการเปลี่ยนรหัส" : "ตั้งรหัสใหม่"}
                </span>
              </button>

              {changePassword && (
                <div className="mt-3 p-3.5 rounded-2xl bg-muted/30 border border-black/[0.04] dark:border-white/[0.06] space-y-3 animate-in fade-in-50 duration-150">
                  {/* Current Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="curr-password" className="text-xs">
                      รหัสผ่านปัจจุบัน <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="curr-password"
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านเดิมของคุณ"
                        className="pr-9 h-9.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showCurrentPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="new-password" className="text-xs">
                      รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร){" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="ระบุรหัสผ่านใหม่"
                        className="pr-9 h-9.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? (
                          <EyeOff className="size-4" />
                        ) : (
                          <Eye className="size-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-password" className="text-xs">
                      ยืนยันรหัสผ่านใหม่ <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="confirm-password"
                      type={showNewPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="ระบุรหัสผ่านใหม่อีกครั้ง"
                      className="h-9.5 text-xs"
                    />
                    {confirmPassword && newPassword !== confirmPassword && (
                      <p className="text-[11px] text-destructive">
                        รหัสผ่านไม่ตรงกัน
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-black/[0.04] dark:border-white/[0.06] bg-muted/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl h-9.5 px-4 text-xs"
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl h-9.5 px-5 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Check className="size-3.5" />
                  บันทึกการเปลี่ยนแปลง
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {/* LINE OA Add Friend QR Code Dialog */}
    <Dialog open={showLineQrModal} onOpenChange={setShowLineQrModal}>
      <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden rounded-3xl border border-black/[0.08] dark:border-white/[0.1] shadow-2xl">
        <div className="p-6 text-center space-y-4 bg-background">
          <DialogHeader className="space-y-1.5 text-center sm:text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#06C755]/10 text-[#06C755] mb-1">
              <LineIcon className="size-6" />
            </div>
            <DialogTitle className="text-base font-semibold text-foreground">
              เพิ่มเพื่อน LINE Official Account
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground max-w-xs mx-auto">
              สแกน QR Code เพื่อเพิ่มเพื่อน <strong>@990ijmdu</strong> สำหรับรับการแจ้งเตือนค่าสาธารณูปโภค และสนทนากับ AI กรมประมง
            </DialogDescription>
          </DialogHeader>

          {/* QR Code Container */}
          <div className="flex flex-col items-center justify-center py-2">
            <div className="relative p-3.5 bg-white rounded-2xl border-2 border-[#06C755]/20 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/line-oa-qr.png"
                alt="LINE OA QR Code"
                className="size-48 object-contain rounded-xl"
              />
              <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 bg-[#06C755] text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1 whitespace-nowrap">
                <LineIcon className="size-3" />
                @990ijmdu
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-4">
              ใช้แอป LINE หรือกล้องโทรศัพท์สแกน QR Code ด้านบนเพื่อเพิ่มเพื่อน
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="w-full text-xs h-9 rounded-xl gap-1.5 border-[#06C755]/30 text-[#06C755] hover:bg-[#06C755]/10 cursor-pointer"
              onClick={() => window.open("https://line.me/R/ti/p/%40990ijmdu", "_blank")}
            >
              <ExternalLink className="size-3.5" />
              เปิดแอป LINE เพื่อเพิ่มเพื่อน (@990ijmdu)
            </Button>
            <Button
              type="button"
              className="w-full text-xs h-9 rounded-xl gap-1.5 bg-[#06C755] hover:bg-[#05b34c] text-white shadow-xs cursor-pointer"
              onClick={() => {
                setShowLineQrModal(false);
                handleSocialConnect("line", Boolean(user.isLine));
              }}
            >
              <LineIcon className="size-3.5" />
              ดำเนินการเชื่อมต่อ (LINE Login)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>
  );
}
