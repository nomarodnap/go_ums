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
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface UserProfileData {
  id?: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  phone?: string;
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

  // Sync state when dialog opens or user changes
  React.useEffect(() => {
    if (open) {
      setName(user.name || "");
      setPhone(user.phone || "");
      setChangePassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open, user]);

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-3xl">
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div className="p-6 pb-4 bg-muted/20 border-b border-black/[0.04] dark:border-white/[0.06]">
            <DialogHeader>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <User className="size-5" />
                </div>
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
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="size-3.5" />
                  {user.email}
                </span>
                <Badge variant="secondary" className="text-[10px] py-0 px-2">
                  <Shield className="size-3 mr-1" />
                  {roleLabel}
                </Badge>
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
  );
}
