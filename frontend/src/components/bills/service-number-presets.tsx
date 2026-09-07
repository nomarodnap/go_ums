"use client";

import React, { useState, useEffect } from "react";
import {
  Bookmark,
  BookmarkPlus,
  Trash2,
  Check,
  Sparkles,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export interface ServicePreset {
  id: string;
  name: string;
  departmentId?: string;
  utilityType?: string;
  serviceNumbers: string[];
  createdAt: string;
}

const STORAGE_KEY = "ums_service_presets";

export function ServiceNumberPresets({
  departmentId,
  utilityType,
  availableServices,
  currentSelected,
  onApplyPreset,
}: {
  departmentId?: string;
  utilityType?: string;
  availableServices: { id: string; serviceNumber: string; provider?: string | null }[];
  currentSelected: string[];
  onApplyPreset: (serviceNumbers: string[]) => void;
}) {
  const [presets, setPresets] = useState<ServicePreset[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  // Load presets from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setPresets(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error loading presets from localStorage", e);
    }
  }, []);

  // Save presets to localStorage
  const savePresetsToStorage = (updated: ServicePreset[]) => {
    setPresets(updated);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Error saving presets to localStorage", e);
    }
  };

  // Filter presets relevant to this department and utilityType (or global)
  const filteredPresets = presets.filter((p) => {
    if (departmentId && p.departmentId && p.departmentId !== departmentId) {
      return false;
    }
    if (utilityType && p.utilityType && p.utilityType !== utilityType) {
      return false;
    }
    return true;
  });

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim() || currentSelected.length === 0) return;

    const newPreset: ServicePreset = {
      id: crypto.randomUUID(),
      name: presetName.trim(),
      departmentId,
      utilityType,
      serviceNumbers: [...currentSelected],
      createdAt: new Date().toISOString(),
    };

    const updated = [newPreset, ...presets];
    savePresetsToStorage(updated);
    setPresetName("");
  };

  const handleDeletePreset = (id: string) => {
    const updated = presets.filter((p) => p.id !== id);
    savePresetsToStorage(updated);
  };

  const handleApply = (preset: ServicePreset) => {
    const validNumbers = preset.serviceNumbers.filter((sn) =>
      availableServices.some((s) => s.serviceNumber === sn)
    );
    const numbersToApply = validNumbers.length > 0 ? validNumbers : preset.serviceNumbers;
    
    onApplyPreset(numbersToApply);
    setAppliedPresetId(preset.id);
    setTimeout(() => {
      setAppliedPresetId(null);
      setIsOpen(false);
    }, 400);
  };

  if (!utilityType) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2.5 text-[11px] font-medium border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shadow-2xs transition-all gap-1 rounded-lg"
              />
            }
          >
            <Bookmark className="size-3 text-primary shrink-0" />
            <span>ชุดลัด</span>
            {filteredPresets.length > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-primary/20 text-primary text-[10px] font-semibold">
                {filteredPresets.length}
              </span>
            )}
          </DialogTrigger>

          <DialogContent className="max-w-md p-6 rounded-3xl gap-5">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="size-5 text-primary" />
                ชุดลัดหมายเลขผู้ใช้
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                บันทึกกลุ่มหมายเลขที่ต้องเลือกใช้งานบ่อยๆ เพื่อความสะดวกรวดเร็วในการเลือกครั้งถัดไป
              </DialogDescription>
            </DialogHeader>

            {/* Save Current Selection Section */}
            {currentSelected.length > 0 ? (
              <div className="p-3.5 rounded-2xl bg-primary/[0.04] border border-primary/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
                    <BookmarkPlus className="size-3.5" />
                    บันทึกชุดปัจจุบันเป็นชุดลัด ({currentSelected.length} หมายเลข)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto pr-1">
                  {currentSelected.map((sn) => (
                    <Badge
                      key={sn}
                      variant="secondary"
                      className="text-[11px] px-2 py-0.5 font-normal bg-background/80"
                    >
                      {sn}
                    </Badge>
                  ))}
                </div>
                <form onSubmit={handleSavePreset} className="flex gap-2 pt-1">
                  <Input
                    type="text"
                    placeholder="ตั้งชื่อชุดลัด"
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    className="h-8 text-xs bg-background"
                    required
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 px-3 text-xs shrink-0 shadow-xs"
                    disabled={!presetName.trim()}
                  >
                    บันทึกชุดลัด
                  </Button>
                </form>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/30 border border-dashed text-center text-xs text-muted-foreground">
                💡 เลือกหมายเลขผู้ใช้ในฟอร์มอย่างน้อย 1 หมายเลข เพื่อบันทึกเป็นชุดลัดใหม่
              </div>
            )}

            {/* List of Saved Presets */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-foreground">
                ชุดลัดที่บันทึกไว้ ({filteredPresets.length})
              </Label>

              {filteredPresets.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-2xl bg-muted/10">
                  <p>ยังไม่มีชุดลัดที่บันทึกไว้สำหรับประเภทนี้</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">
                    เลือกหมายเลขในฟอร์มแล้วกดบันทึกชุดลัดด้านบน
                  </p>
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {filteredPresets.map((preset) => {
                    const isApplied = appliedPresetId === preset.id;
                    return (
                      <div
                        key={preset.id}
                        className="flex flex-col gap-2 p-3 rounded-2xl border bg-card/60 hover:bg-card hover:border-primary/40 transition-all shadow-2xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-semibold text-xs text-foreground truncate">
                              {preset.name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 font-medium shrink-0"
                            >
                              {preset.serviceNumbers.length} หมายเลข
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              size="sm"
                              variant={isApplied ? "default" : "outline"}
                              onClick={() => handleApply(preset)}
                              className="h-7 px-2.5 text-xs font-medium gap-1"
                            >
                              {isApplied ? (
                                <>
                                  <Check className="size-3 text-emerald-300 animate-in zoom-in" />
                                  <span>เลือกแล้ว</span>
                                </>
                              ) : (
                                <span>นำไปใช้</span>
                              )}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePreset(preset.id)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                              title="ลบชุดลัดนี้"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        {/* Numbers preview */}
                        <div className="flex flex-wrap gap-1">
                          {preset.serviceNumbers.map((sn) => (
                            <span
                              key={sn}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground font-mono"
                            >
                              {sn}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Quick-select pills if presets exist */}
      {filteredPresets.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
          <span className="text-[11px] text-muted-foreground shrink-0 flex items-center gap-1">
            <Sparkles className="size-3 text-primary shrink-0" /> ชุดลัด:
          </span>
          {filteredPresets.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleApply(p)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border/80 bg-background/80 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors shrink-0 shadow-2xs"
            >
              <span>{p.name}</span>
              <span className="text-[10px] text-muted-foreground">
                ({p.serviceNumbers.length})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
