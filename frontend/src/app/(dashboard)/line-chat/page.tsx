"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Bot,
  User,
  Send,
  RefreshCw,
  Search,
  Sparkles,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Filter,
  UserCheck,
  Headphones,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface LineChatSession {
  id: string;
  lineUserId: string;
  userId?: string;
  userName: string;
  pictureUrl?: string;
  departmentId: string;
  departmentName: string;
  replyMode: "AI" | "MANUAL";
  lastMessageText: string;
  lastMessageAt: string;
  staffActiveAt?: string;
  unreadAdminCount: number;
  createdAt: string;
}

interface LineChatMessage {
  id: string;
  sessionId: string;
  senderType: "USER" | "AI" | "ADMIN";
  adminName?: string;
  text: string;
  createdAt: string;
}

export default function LineChatPage() {
  const [sessions, setSessions] = useState<LineChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LineChatMessage[]>([]);
  const [activeSession, setActiveSession] = useState<LineChatSession | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "AI" | "MANUAL">("ALL");

  const [inputText, setInputText] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTogglingMode, setIsTogglingMode] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [isSyncingProfile, setIsSyncingProfile] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch list of conversations
  const fetchSessions = async (silent = false) => {
    if (!silent) setIsLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (filterMode !== "ALL") params.set("mode", filterMode);

      const res = await fetch(`/api/line-chat/conversations?${params.toString()}`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดรายการสนทนาได้");
      const data = await res.json();
      const items: LineChatSession[] = data.items || [];
      setSessions(items);

      // If nothing selected yet and we have items, select first
      if (!selectedSessionId && items.length > 0) {
        setSelectedSessionId(items[0].id);
      } else if (selectedSessionId) {
        const found = items.find((s) => s.id === selectedSessionId);
        if (found) {
          setActiveSession(found);
        }
      }
    } catch (err: any) {
      if (!silent) toast.error(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      if (!silent) setIsLoadingList(false);
    }
  };

  // Fetch single conversation messages
  const fetchMessages = async (sessionId: string, silent = false) => {
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await fetch(`/api/line-chat/conversations/${sessionId}`);
      if (!res.ok) throw new Error("ไม่สามารถโหลดข้อความได้");
      const data = await res.json();
      setActiveSession(data.conversation);
      setMessages(data.messages || []);
    } catch (err: any) {
      if (!silent) toast.error(err.message || "ไม่สามารถโหลดข้อความสนทนาได้");
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  // Initial fetch and polling every 4 seconds
  useEffect(() => {
    fetchSessions();
  }, [searchQuery, filterMode]);

  useEffect(() => {
    if (selectedSessionId) {
      fetchMessages(selectedSessionId);
    }
  }, [selectedSessionId]);

  useEffect(() => {
    const timer = setInterval(() => {
      fetchSessions(true);
      if (selectedSessionId) {
        fetchMessages(selectedSessionId, true);
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [selectedSessionId, searchQuery, filterMode]);

  // Handle Switch Mode (AI vs MANUAL)
  const handleToggleMode = async (targetMode: "AI" | "MANUAL") => {
    if (!selectedSessionId || !activeSession || isTogglingMode) return;
    if (activeSession.replyMode === targetMode) return;

    setIsTogglingMode(true);
    try {
      const res = await fetch(`/api/line-chat/conversations/${selectedSessionId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: targetMode }),
      });

      if (!res.ok) throw new Error("ไม่สามารถเปลี่ยนโหมดได้");
      const data = await res.json();
      const updated: LineChatSession = data;

      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      if (targetMode === "MANUAL") {
        toast.success("สลับเป็นโหมดเจ้าหน้าที่ตอบ (Manual) แล้ว", {
          description: "AI จะหยุดตอบอัตโนมัติ ท่านสามารถพิมพ์ข้อความตอบผู้ใช้ได้โดยตรง",
        });
      } else {
        toast.success("สลับเป็นโหมด AI อัตโนมัติแล้ว", {
          description: "AI จะช่วยตอบคำถามเรื่องค่าสาธารณูปโภคเฉพาะหน่วยงานให้ผู้ใช้อัตโนมัติ",
        });
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการเปลี่ยนโหมด");
    } finally {
      setIsTogglingMode(false);
    }
  };

  // Handle Extend Staff Session Timer (+10 minutes)
  const handleExtendStaffSession = async () => {
    if (!selectedSessionId || isExtending) return;

    setIsExtending(true);
    try {
      const res = await fetch(`/api/line-chat/conversations/${selectedSessionId}/extend`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("ไม่สามารถต่อเวลาได้");
      const updated: LineChatSession = await res.json();

      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      toast.success("ต่อเวลาการตอบของเจ้าหน้าที่เรียบร้อยแล้ว (+10 นาที)", {
        description: "ระบบจะไม่ตัดกลับเป็น AI ตราบใดที่มีการส่งข้อความหรือต่อเวลาภายใน 10 นาที",
      });
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการต่อเวลา");
    } finally {
      setIsExtending(false);
    }
  };

  // Handle Sync Profile from LINE
  const handleSyncProfile = async () => {
    if (!selectedSessionId || isSyncingProfile) return;

    setIsSyncingProfile(true);
    try {
      const res = await fetch(`/api/line-chat/conversations/${selectedSessionId}/sync-profile`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("ไม่สามารถซิงค์รูปโปรไฟล์จาก LINE ได้");
      const updated: LineChatSession = await res.json();

      setActiveSession(updated);
      setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      toast.success("ซิงค์รูปโปรไฟล์และชื่อจาก LINE สำเร็จแล้ว");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการซิงค์โปรไฟล์");
    } finally {
      setIsSyncingProfile(false);
    }
  };

  // Handle Send Manual Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || !selectedSessionId || isSending) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/line-chat/conversations/${selectedSessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToSend }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.message || "ไม่สามารถส่งข้อความได้");
      }

      const newMsg: LineChatMessage = await res.json();
      setMessages((prev) => [...prev, newMsg]);
      setInputText("");

      // Update session last message locally
      setSessions((prev) =>
        prev.map((s) =>
          s.id === selectedSessionId
            ? { ...s, lastMessageText: textToSend, lastMessageAt: new Date().toISOString() }
            : s,
        ),
      );

      toast.success("ส่งข้อความเข้า LINE ผู้ใช้เรียบร้อยแล้ว");
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการส่งข้อความ");
    } finally {
      setIsSending(false);
    }
  };

  // Format time
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  // Counts for summary metrics
  const totalCount = sessions.length;
  const aiCount = sessions.filter((s) => s.replyMode === "AI").length;
  const manualCount = sessions.filter((s) => s.replyMode === "MANUAL").length;
  const unreadCount = sessions.reduce((acc, s) => acc + (s.unreadAdminCount || 0), 0);

  return (
    <div className="flex-1 flex flex-col space-y-4 max-w-[1600px] w-full mx-auto pb-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageSquare className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                สนทนา LINE OA
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                  Official Account
                </Badge>
              </h1>
              <p className="text-sm text-muted-foreground">
                ศูนย์จัดการแชทเบื้องหลังสำหรับ Admin: อ่านบทสนทนา, สลับโหมด AI / เจ้าหน้าที่ตอบ, และพิมพ์ตอบกลับเข้า LINE โดยตรง
              </p>
            </div>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="px-3 py-1.5 text-xs font-normal">
            ทั้งหมด <span className="font-semibold ml-1.5">{totalCount}</span>
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5 text-xs font-normal border-blue-200 bg-blue-50/50 text-blue-700">
            <Bot className="h-3.5 w-3.5 mr-1 text-blue-600 inline" />
            โหมด AI <span className="font-semibold ml-1">{aiCount}</span>
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5 text-xs font-normal border-amber-200 bg-amber-50/50 text-amber-700">
            <Headphones className="h-3.5 w-3.5 mr-1 text-amber-600 inline" />
            โหมดเจ้าหน้าที่ <span className="font-semibold ml-1">{manualCount}</span>
          </Badge>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="px-3 py-1.5 text-xs font-semibold animate-pulse">
              ข้อความใหม่ {unreadCount}
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSessions()}
            className="h-8 w-8 p-0"
            title="รีเฟรชรายการ"
          >
            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", isLoadingList && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Main Two-Pane Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-210px)] min-h-[600px]">
        {/* Left Pane: Conversation List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden h-full">
          {/* Search & Filter Header */}
          <div className="p-3 border-b space-y-2 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหาชื่อผู้ใช้, หน่วยงาน, หรือข้อความ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm bg-background"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setFilterMode("ALL")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md transition-colors",
                  filterMode === "ALL"
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("AI")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors",
                  filterMode === "AI"
                    ? "bg-blue-600 text-white font-medium shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                <Bot className="h-3 w-3" />
                โหมด AI
              </button>
              <button
                type="button"
                onClick={() => setFilterMode("MANUAL")}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-md flex items-center gap-1 transition-colors",
                  filterMode === "MANUAL"
                    ? "bg-amber-600 text-white font-medium shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted",
                )}
              >
                <Headphones className="h-3 w-3" />
                โหมดคนตอบ
              </button>
            </div>
          </div>

          {/* Conversations Scrollable List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {isLoadingList && sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto text-primary" />
                <p>กำลังโหลดบทสนทนา...</p>
              </div>
            ) : sessions.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground space-y-2">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40" />
                <p className="font-medium text-foreground">ยังไม่มีรายการสนทนา</p>
                <p className="text-xs">เมื่อผู้ใช้ทักทายหรือสอบถามผ่าน LINE OA บทสนทนาจะปรากฏที่นี่โดยอัตโนมัติ</p>
              </div>
            ) : (
              sessions.map((sess) => {
                const isSelected = sess.id === selectedSessionId;
                const isManual = sess.replyMode === "MANUAL";

                return (
                  <div
                    key={sess.id}
                    onClick={() => setSelectedSessionId(sess.id)}
                    className={cn(
                      "p-3.5 cursor-pointer transition-all border-l-4",
                      isSelected
                        ? "bg-accent/60 border-l-primary shadow-sm"
                        : "border-l-transparent hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          {sess.pictureUrl ? (
                            <img
                              src={sess.pictureUrl}
                              alt={sess.userName || "User"}
                              className="w-9 h-9 rounded-full object-cover border border-border/80 shadow-2xs"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                if (fallback) fallback.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className={cn(
                              "w-9 h-9 rounded-full items-center justify-center font-bold text-xs shadow-2xs",
                              sess.pictureUrl ? "hidden" : "flex",
                              isManual
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                                : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                            )}
                          >
                            {sess.userName ? sess.userName.charAt(0) : "U"}
                          </div>
                        </div>
                        <span className="font-semibold text-sm truncate" title={sess.userName}>
                          {sess.userName || "ผู้ใช้ LINE"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Mode Indicator Tag */}
                        {isManual ? (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700">
                            <Headphones className="h-2.5 w-2.5" />
                            คนตอบ
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700">
                            <Bot className="h-2.5 w-2.5" />
                            AI
                          </span>
                        )}

                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatTime(sess.lastMessageAt)}
                        </span>
                      </div>
                    </div>

                    {/* Department Name */}
                    {sess.departmentName ? (
                      <p className="text-xs text-primary/80 font-medium truncate mb-1">
                        🏢 {sess.departmentName}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic truncate mb-1">
                        (ยังไม่ระบุสังกัดหน่วยงาน)
                      </p>
                    )}

                    {/* Snippet of last message */}
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                        {sess.lastMessageText || "ยังไม่มีข้อความ"}
                      </p>
                      {sess.unreadAdminCount > 0 && (
                        <span className="h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full bg-rose-500 text-white text-[11px] font-bold shrink-0">
                          {sess.unreadAdminCount}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Chat Window & Controls (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-card rounded-xl border shadow-sm overflow-hidden h-full">
          {activeSession ? (
            <>
              {/* Chat Header with User Info & Mode Switcher */}
              <div className="p-3.5 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    {activeSession.pictureUrl ? (
                      <img
                        src={activeSession.pictureUrl}
                        alt={activeSession.userName || "User"}
                        className="w-11 h-11 rounded-full object-cover border-2 border-primary/20 shadow-xs"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = "flex";
                        }}
                      />
                    ) : null}
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full items-center justify-center font-bold text-base shadow-xs",
                        activeSession.pictureUrl ? "hidden" : "flex",
                        activeSession.replyMode === "MANUAL"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
                      )}
                    >
                      {activeSession.userName ? activeSession.userName.charAt(0) : "U"}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold truncate">
                        {activeSession.userName || "ผู้ใช้ LINE"}
                      </h2>
                      {activeSession.userId ? (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 bg-emerald-50 border-emerald-300">
                          <CheckCircle2 className="h-3 w-3 mr-1 inline" /> บัญชีเชื่อมต่อแล้ว
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-amber-700 bg-amber-50 border-amber-300">
                          ยังไม่เชื่อมต่อบัญชี
                        </Badge>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleSyncProfile}
                        disabled={isSyncingProfile}
                        title="ซิงค์รูปภาพและชื่อโปรไฟล์จาก LINE ล่าสุด"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <RefreshCw className={cn("h-3.5 w-3.5", isSyncingProfile && "animate-spin text-primary")} />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeSession.departmentName
                        ? `สังกัด: ${activeSession.departmentName}`
                        : `LINE ID: ${activeSession.lineUserId}`}
                    </p>
                  </div>
                </div>

                {/* MODE SWITCHER BUTTONS (KEY REQUIREMENT) */}
                <div className="flex items-center gap-1.5 p-1 bg-background rounded-lg border shadow-xs shrink-0 self-start sm:self-auto">
                  <span className="text-xs font-medium text-muted-foreground px-2">
                    โหมดตอบกลับ:
                  </span>

                  {/* AI Mode Button */}
                  <Button
                    type="button"
                    size="sm"
                    variant={activeSession.replyMode === "AI" ? "default" : "ghost"}
                    disabled={isTogglingMode}
                    onClick={() => handleToggleMode("AI")}
                    className={cn(
                      "h-8 text-xs font-medium gap-1.5 transition-all",
                      activeSession.replyMode === "AI"
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Bot className="h-3.5 w-3.5" />
                    🤖 AI อัตโนมัติ
                  </Button>

                  {/* Manual / Human Agent Button */}
                  <Button
                    type="button"
                    size="sm"
                    variant={activeSession.replyMode === "MANUAL" ? "default" : "ghost"}
                    disabled={isTogglingMode}
                    onClick={() => handleToggleMode("MANUAL")}
                    className={cn(
                      "h-8 text-xs font-medium gap-1.5 transition-all",
                      activeSession.replyMode === "MANUAL"
                        ? "bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Headphones className="h-3.5 w-3.5" />
                    👤 เจ้าหน้าที่ตอบ (คน)
                  </Button>
                </div>
              </div>

              {/* Status Notice Banner based on Mode */}
              {activeSession.replyMode === "MANUAL" ? (
                <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Headphones className="h-4 w-4 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-semibold">
                        โหมดเจ้าหน้าที่ตอบ (Manual) ทำงานอยู่
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        หากไม่มีการตอบกลับเกิน 10 นาที ระบบจะสลับกลับเป็น AI อัตโนมัติ เพื่อป้องกันผู้ใช้รอนาน
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExtendStaffSession}
                      disabled={isExtending}
                      className="h-7 text-xs bg-amber-100 hover:bg-amber-200 border-amber-300 text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200"
                    >
                      <Clock className="h-3 w-3 mr-1" />
                      {isExtending ? "กำลังต่อเวลา..." : "ต่อเวลา (+10 นาที)"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleMode("AI")}
                      className="h-7 text-xs text-amber-800 dark:text-amber-200 hover:bg-amber-200/50 underline"
                    >
                      สลับกลับเป็น AI ทันที
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="px-4 py-2 bg-blue-500/5 border-b border-blue-500/15 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                    <span>
                      <strong>โหมด AI อัตโนมัติ:</strong> AI กรมประมงจะดึงข้อมูลบิลและงบประมาณตอบผู้ใช้อัตโนมัติเฉพาะข้อมูลหน่วยงานของผู้ใช้
                    </span>
                  </div>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => handleToggleMode("MANUAL")}
                    className="h-auto p-0 text-blue-700 dark:text-blue-400 font-semibold underline text-xs shrink-0"
                  >
                    สลับเป็นเจ้าหน้าที่ตอบ
                  </Button>
                </div>
              )}

              {/* Chat Message Stream */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                {isLoadingMessages && messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center">
                    <RefreshCw className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-sm space-y-1">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-2" />
                    <p>ยังไม่มีข้อความในบทสนทนานี้</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isUser = msg.senderType === "USER";
                    const isAI = msg.senderType === "AI";
                    const isAdmin = msg.senderType === "ADMIN";

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "flex flex-col max-w-[85%] sm:max-w-[75%]",
                          isUser ? "self-start items-start" : "self-end items-end ml-auto",
                        )}
                      >
                        {/* Sender Label & Timestamp */}
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1 px-1">
                          {isUser && (
                            <>
                              {activeSession.pictureUrl ? (
                                <img
                                  src={activeSession.pictureUrl}
                                  alt=""
                                  className="w-3.5 h-3.5 rounded-full object-cover border border-border"
                                />
                              ) : (
                                <User className="h-3 w-3 text-muted-foreground" />
                              )}
                              <span className="font-medium text-foreground">{activeSession.userName || "ผู้ใช้ LINE"}</span>
                            </>
                          )}
                          {isAI && (
                            <>
                              <Bot className="h-3 w-3 text-blue-600" />
                              <span className="font-semibold text-blue-700 dark:text-blue-400">UMS AI Assistant</span>
                            </>
                          )}
                          {isAdmin && (
                            <>
                              <Headphones className="h-3 w-3 text-amber-600" />
                              <span className="font-semibold text-amber-700 dark:text-amber-400">
                                เจ้าหน้าที่ ({msg.adminName || "Admin"})
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span>{formatDate(msg.createdAt)}</span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-2.5 text-sm shadow-xs whitespace-pre-wrap leading-relaxed",
                            isUser && "bg-background border border-border text-foreground rounded-tl-xs",
                            isAI && "bg-blue-50 border border-blue-200 text-blue-950 dark:bg-blue-950/50 dark:border-blue-800 dark:text-blue-100 rounded-tr-xs",
                            isAdmin && "bg-amber-600 text-white rounded-tr-xs shadow-sm font-medium",
                          )}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Area */}
              <div className="p-3 border-t bg-background shrink-0">
                <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        activeSession.replyMode === "MANUAL"
                          ? "พิมพ์ข้อความตอบกลับไปยัง LINE ของผู้ใช้... (กด Enter เพื่อส่ง)"
                          : "โหมด AI ทำงานอยู่: พิมพ์ข้อความที่นี่เพื่อตอบกลับเป็นกรณีพิเศษ (กด Enter เพื่อส่ง)..."
                      }
                      rows={2}
                      className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <span className="absolute right-2 bottom-2 text-[10px] text-muted-foreground/60 pointer-events-none hidden sm:inline">
                      Enter เพื่อส่ง / Shift+Enter ขึ้นบรรทัดใหม่
                    </span>
                  </div>

                  <Button
                    type="submit"
                    disabled={!inputText.trim() || isSending}
                    className="h-14 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 shadow-sm"
                  >
                    {isSending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-1.5" />
                        ส่งข้อความ
                      </>
                    )}
                  </Button>
                </form>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1.5 px-1">
                  <span>
                    💡 ข้อความตอบกลับของเจ้าหน้าที่จะถูกส่งตรงไปยังห้องแชท LINE OA ของผู้ใช้ทันที
                  </span>
                  <span>
                    โหมดปัจจุบัน:{" "}
                    <strong>{activeSession.replyMode === "AI" ? "🤖 AI อัตโนมัติ" : "👤 เจ้าหน้าที่ (คน)"}</strong>
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-muted-foreground space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/40">
                <MessageSquare className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">เลือกบทสนทนาที่ต้องการดู</h3>
              <p className="text-sm max-w-sm">
                คลิกเลือกบทสนทนาจากรายการด้านซ้ายเพื่อดูข้อความที่ผู้ใช้คุยกับ LINE OA, ตรวจสอบการตอบของ AI และสามารถเลือกสลับเป็นโหมดคนตอบได้ตลอดเวลา
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

