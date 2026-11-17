"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateRole,
  useUpdateRole,
  getListRolesQueryKey,
} from "@/lib/api/generated/roles/roles";
import { getGetCurrentUserQueryKey } from "@/lib/api/generated/auth/auth";
import type { RoleDTO } from "@/lib/api/generated/model";
import {
  PERMISSION_GROUPS,
  ALL_PERMISSION_IDS,
  getPermissionTitle,
} from "@/lib/permissions";
import {
  Loader2,
  Shield,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";

export function RoleFormSheet({
  role,
  open,
  onOpenChange,
}: {
  role?: RoleDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createMutation = useCreateRole();
  const updateMutation = useUpdateRole();

  const isEditing = !!role;
  const isSystemRole = role?.isSystem || false;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [defaultPath, setDefaultPath] = useState("/dashboard");
  const [errors, setErrors] = useState<{ name?: string }>({});

  useEffect(() => {
    if (open) {
      if (role) {
        setName(role.name || "");
        setDescription(role.description || "");
        // If system admin with "*", select all permissions
        const perms = Array.isArray(role.permissions) ? role.permissions : [];
        if (perms.includes("*")) {
          setSelectedPermissions(ALL_PERMISSION_IDS);
        } else {
          setSelectedPermissions(perms);
        }
        setDefaultPath(role.defaultPath || "/dashboard");
      } else {
        setName("");
        setDescription("");
        setSelectedPermissions([]);
        setDefaultPath("/dashboard");
      }
      setErrors({});
    }
  }, [open, role]);

  const handleTogglePermission = (
    id: string,
    parentId?: string,
    subIds?: string[],
  ) => {
    setSelectedPermissions((prev) => {
      if (prev.includes(id)) {
        // Unchecking
        if (subIds && subIds.length > 0) {
          // If unchecking parent, also uncheck its sub-permissions
          return prev.filter((p) => p !== id && !subIds.includes(p));
        }
        return prev.filter((p) => p !== id);
      } else {
        // Checking
        if (parentId && !prev.includes(parentId)) {
          // If checking child, ensure parent is also checked
          return [...prev, parentId, id];
        }
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectedPermissions(ALL_PERMISSION_IDS);
  };

  const handleClearAll = () => {
    setSelectedPermissions([]);
  };

  const handleToggleGroup = (groupIds: string[]) => {
    const allSelected = groupIds.every((id) =>
      selectedPermissions.includes(id),
    );
    if (allSelected) {
      setSelectedPermissions((prev) =>
        prev.filter((id) => !groupIds.includes(id)),
      );
    } else {
      setSelectedPermissions((prev) => [
        ...prev,
        ...groupIds.filter((id) => !prev.includes(id)),
      ]);
    }
  };

  const availableLandingPages = useMemo(() => {
    const pagePerms = selectedPermissions.filter((id) => !id.includes(":"));
    if (pagePerms.length > 0) {
      return pagePerms.map((id) => ({
        id,
        title: getPermissionTitle(id),
      }));
    }
    return [{ id: "/dashboard", title: "แดชบอร์ดหน่วยงาน" }];
  }, [selectedPermissions]);

  useEffect(() => {
    const pagePerms = selectedPermissions.filter((id) => !id.includes(":"));
    if (pagePerms.length > 0 && !pagePerms.includes(defaultPath)) {
      setDefaultPath(pagePerms[0]);
    }
  }, [selectedPermissions, defaultPath]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrors({ name: "กรุณาระบุชื่อบทบาท" });
      return;
    }

    try {
      if (isEditing && role) {
        // If system admin, keep "*" in permissions
        let perms = selectedPermissions;
        if (role.id === "admin") {
          perms = ["*"];
        }

        await updateMutation.mutateAsync({
          id: role.id,
          data: {
            name: trimmedName,
            description: description.trim(),
            permissions: perms,
            defaultPath: defaultPath || (perms[0] || "/dashboard"),
          },
        });
        toast.success("บันทึกการแก้ไขบทบาทสำเร็จ");
      } else {
        await createMutation.mutateAsync({
          data: {
            name: trimmedName,
            description: description.trim(),
            permissions: selectedPermissions,
            defaultPath: defaultPath || (selectedPermissions[0] || "/dashboard"),
          },
        });
        toast.success("สร้างบทบาทใหม่สำเร็จ");
      }

      await queryClient.invalidateQueries({
        queryKey: getListRolesQueryKey(),
      });
      await queryClient.invalidateQueries({
        queryKey: getGetCurrentUserQueryKey(),
      });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.detail ||
          err?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "เกิดข้อผิดพลาดในการบันทึกข้อมูล",
      );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col"
      >
        <div className="p-6 border-b sticky top-0 bg-background/95 backdrop-blur-xs z-10">
          <SheetHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Shield className="size-5" />
              </div>
              <div>
                <SheetTitle className="text-xl">
                  {isEditing ? `แก้ไขบทบาท: ${role.name}` : "สร้างบทบาทใหม่ (Custom Role)"}
                </SheetTitle>
                <SheetDescription>
                  กำหนดชื่อบทบาทและเลือกสิทธิ์การเข้าถึงหน้าต่าง ๆ ในระบบ
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between">
          <div className="p-6 space-y-6 flex-1">
            {/* General Info */}
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="role-name">
                  ชื่อบทบาท (Role Name) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="role-name"
                  placeholder="เช่น เจ้าหน้าที่การเงิน, ผู้ตรวจสอบภายใน"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors({});
                  }}
                  disabled={isSystemRole && role?.id === "admin"}
                  className={errors.name ? "border-destructive ring-2 ring-destructive/20" : ""}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name}</p>
                )}
                {isSystemRole && role?.id === "admin" && (
                  <p className="text-xs text-muted-foreground">
                    * บทบาทผู้ดูแลระบบ (admin) เป็นบทบาทหลักของระบบ ไม่สามารถเปลี่ยนชื่อได้
                  </p>
                )}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="role-desc">คำอธิบายบทบาท</Label>
                <Textarea
                  id="role-desc"
                  placeholder="ระบุรายละเอียดหน้าที่หรือขอบเขตงานของบทบาทนี้ (ระบุหรือไม่ก็ได้)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="default-landing-path" className="text-sm font-medium">
                    หน้าแรกเริ่มต้นเมื่อเข้าสู่ระบบ (Default Landing Page)
                  </Label>
                  <Badge variant="outline" className="text-[11px] font-mono font-normal">
                    {defaultPath}
                  </Badge>
                </div>
                <select
                  id="default-landing-path"
                  value={defaultPath}
                  onChange={(e) => setDefaultPath(e.target.value)}
                  disabled={selectedPermissions.length === 0}
                  className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedPermissions.length === 0 ? (
                    <option value="/dashboard">กรุณาเลือกสิทธิ์การเข้าถึงอย่างน้อย 1 หน้า</option>
                  ) : (
                    availableLandingPages.map((page) => (
                      <option key={page.id} value={page.id}>
                        {page.title} ({page.id})
                      </option>
                    ))
                  )}
                </select>
                <p className="text-xs text-muted-foreground">
                  เมื่อผู้ใช้งานบทบาทนี้ล็อกอินเข้าสู่ระบบ จะเปิดหน้านี้เป็นหน้าแรกโดยอัตโนมัติ
                </p>
              </div>
            </div>

            {/* Permissions Header & Quick Actions */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <span>กำหนดสิทธิ์การเข้าถึงหน้าเว็บ (Page Permissions)</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedPermissions.length} / {ALL_PERMISSION_IDS.length} หน้า
                    </Badge>
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ติ๊กเลือกหน้าเว็บที่อนุญาตให้บทบาทนี้เข้าถึงได้
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="h-7 text-xs px-2.5 gap-1"
                  >
                    <CheckSquare className="size-3.5" />
                    <span>เลือกทั้งหมด</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    className="h-7 text-xs px-2.5 gap-1 text-muted-foreground"
                  >
                    <Square className="size-3.5" />
                    <span>ล้างทั้งหมด</span>
                  </Button>
                </div>
              </div>

              {/* Grouped Permission Checkboxes */}
              <div className="space-y-4 pt-2">
                {PERMISSION_GROUPS.map((group) => {
                  const groupIds = group.items.flatMap((i) => [
                    i.id,
                    ...(i.subPermissions ? i.subPermissions.map((s) => s.id) : []),
                  ]);
                  const selectedInGroup = groupIds.filter((id) =>
                    selectedPermissions.includes(id),
                  );
                  const isAllInGroupSelected =
                    selectedInGroup.length === groupIds.length;

                  return (
                    <div
                      key={group.category}
                      className="rounded-xl border bg-card/60 p-3.5 space-y-3 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs tracking-tight text-foreground flex items-center gap-1.5">
                          <Sparkles className="size-3.5 text-primary" />
                          {group.category}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {selectedInGroup.length}/{groupIds.length}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleGroup(groupIds)}
                            className="h-6 text-[11px] px-2 text-primary hover:bg-primary/10"
                          >
                            {isAllInGroupSelected ? "ยกเลิกหมวดนี้" : "เลือกทั้งหมวด"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 pt-1">
                        {group.items.map((item) => {
                          const isChecked = selectedPermissions.includes(item.id);
                          const subIds = item.subPermissions?.map((s) => s.id) || [];
                          const hasSubs = subIds.length > 0;

                          return (
                            <div key={item.id} className="space-y-1.5">
                              <label
                                htmlFor={`perm-${item.id}`}
                                className="flex items-start gap-3 p-2.5 rounded-lg border border-transparent hover:border-black/5 dark:hover:border-white/5 hover:bg-muted/40 transition-colors cursor-pointer"
                              >
                                <Checkbox
                                  id={`perm-${item.id}`}
                                  checked={isChecked}
                                  onCheckedChange={() =>
                                    handleTogglePermission(item.id, undefined, subIds)
                                  }
                                  className="mt-0.5"
                                />
                                <div className="grid gap-0.5 leading-none flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-foreground">
                                      {item.title}
                                    </span>
                                    <code className="text-[10px] bg-muted px-1.5 py-0.2 rounded font-mono text-muted-foreground">
                                      {item.id}
                                    </code>
                                    {hasSubs && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal text-muted-foreground">
                                        มีสิทธิ์ย่อย {subIds.filter((sid) => selectedPermissions.includes(sid)).length}/{subIds.length}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[11px] text-muted-foreground font-normal leading-normal">
                                    {item.description}
                                  </span>
                                </div>
                              </label>

                              {/* Subset permissions */}
                              {hasSubs && (
                                <div className="ml-7 pl-3.5 border-l-2 border-primary/20 space-y-1 pb-1">
                                  {item.subPermissions!.map((sub) => {
                                    const isSubChecked = selectedPermissions.includes(sub.id);
                                    return (
                                      <label
                                        key={sub.id}
                                        htmlFor={`perm-${sub.id}`}
                                        className="flex items-start gap-2.5 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                                      >
                                        <Checkbox
                                          id={`perm-${sub.id}`}
                                          checked={isSubChecked}
                                          onCheckedChange={() =>
                                            handleTogglePermission(sub.id, item.id)
                                          }
                                          className="mt-0.5 size-3.5"
                                        />
                                        <div className="grid gap-0.5 leading-none flex-1">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-medium text-foreground">
                                              ↳ {sub.title}
                                            </span>
                                            <code className="text-[9px] bg-muted/80 px-1 py-0 rounded font-mono text-muted-foreground">
                                              {sub.id}
                                            </code>
                                          </div>
                                          <span className="text-[10px] text-muted-foreground font-normal leading-normal">
                                            {sub.description}
                                          </span>
                                        </div>
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-6 border-t bg-background/95 backdrop-blur-xs sticky bottom-0 z-10 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending && <Loader2 className="size-4 animate-spin" />}
              <span>{isEditing ? "บันทึกการแก้ไข" : "สร้างบทบาท"}</span>
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

