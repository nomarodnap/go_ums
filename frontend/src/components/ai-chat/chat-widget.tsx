"use client";

import {
  AlertTriangle,
  Bot,
  Database,
  ExternalLink,
  Maximize2,
  Minimize2,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AI_TOOL_LABELS, type AIChatMessage, useAIChat, useAIStatus } from "@/lib/api/ai-hooks";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "เดือนนี้ค่าสาธารณูปโภคทั้งหมดเท่าไหร่?",
  "มีรายการค้างชำระกี่รายการ ยอดรวมเท่าไหร่?",
  "มีรายการที่พบความคลาดเคลื่อนอะไรบ้าง?",
  "เดือนนี้มีหมายเลขไหนยังไม่ได้บันทึกบิล?",
] as const;

export interface AIChatWidgetProps {
  userDepartment?: string;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error && err.message) {
    return err.message;
  }
  if (err && typeof err === "object") {
    const record = err as Record<string, unknown>;
    for (const key of ["detail", "message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }
  return "ไม่สามารถเชื่อมต่อผู้ช่วย AI ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง";
}

interface UIStateMessage extends AIChatMessage {
  id: string;
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  let offset = 0;
  return parts.map((part) => {
    const key = `seg-${offset}`;
    offset += part.length;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={key}>{part}</React.Fragment>;
  });
}

function renderFormattedMessage(text: string): React.ReactNode {
  const lines = text.split(/\r?\n/);
  let offset = 0;
  return (
    <div className="space-y-1.5 text-sm leading-relaxed break-words">
      {lines.map((rawLine) => {
        const key = `line-${offset}`;
        offset += rawLine.length + 1;
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={key} className="h-1" />;
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={key} className="flex items-start gap-2 pl-1">
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-current opacity-60"
              />
              <span className="flex-1">{renderInlineBold(trimmed.slice(2))}</span>
            </div>
          );
        }
        return <p key={key}>{renderInlineBold(rawLine)}</p>;
      })}
    </div>
  );
}

export function AIChatWidget({ userDepartment }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<UIStateMessage[]>([]);
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  const { data: status, isLoading: isStatusLoading, isError: isStatusError } = useAIStatus(true);
  const chatMutation = useAIChat("department");

  const isEnabled = status?.enabled === true;
  const isReady = isEnabled && !isStatusLoading;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open && !dialog.hasAttribute("open")) {
        if (typeof dialog.show === "function") {
          dialog.show();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      inputRef.current?.focus();
    } else if (dialog.open || dialog.hasAttribute("open")) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      isOpen &&
      (messages.length > 0 || chatMutation.isPending) &&
      typeof messagesEndRef.current?.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [isOpen, messages.length, chatMutation.isPending]);

  const sendPrompt = (rawText: string) => {
    const text = rawText.trim();
    if (!text || chatMutation.isPending || !isReady) return;

    messageIdRef.current += 1;
    const userMessage: UIStateMessage = {
      id: `msg-${messageIdRef.current}`,
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setErrorMessage(null);

    chatMutation.mutate(
      nextMessages.map(({ role, content }) => ({ role, content })),
      {
        onSuccess: (res) => {
          messageIdRef.current += 1;
          const replyId = `msg-${messageIdRef.current}`;
          setMessages((prev) => [
            ...prev,
            {
              id: replyId,
              role: "assistant",
              content: res.reply,
              toolsUsed: res.toolsUsed,
            },
          ]);
        },
        onError: (err) => {
          setErrorMessage(extractErrorMessage(err));
        },
      },
    );
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    sendPrompt(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt(input);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setErrorMessage(null);
  };

  const departmentLabel =
    userDepartment ||
    (status?.departmentName && !status.departmentName.includes("292") ? status.departmentName : null) ||
    "หน่วยงานของคุณ";

  return (
    <>
      <Button
        type="button"
        variant="default"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={isOpen ? "ปิดผู้ช่วย AI ค่าสาธารณูปโภค" : "เปิดผู้ช่วย AI ค่าสาธารณูปโภค"}
        aria-expanded={isOpen}
        aria-controls="ai-chat-dialog"
        className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-40 h-12 rounded-full px-4 shadow-lg shadow-primary/25 gap-2"
      >
        {isOpen ? (
          <X className="size-4" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        <span className="font-medium">ถาม AI</span>
      </Button>

      <dialog
        id="ai-chat-dialog"
        ref={dialogRef}
        hidden={!isOpen}
        aria-labelledby="ai-chat-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setIsOpen(false);
          }
        }}
        className={cn(
          "fixed right-4 bottom-20 sm:right-6 left-auto top-auto z-40 m-0 p-0 open:flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-background/95 dark:bg-card/95 backdrop-blur-xl text-foreground shadow-2xl transition-all",
          isExpanded
            ? "w-[calc(100vw-2rem)] sm:w-[620px] h-[min(82vh,720px)]"
            : "w-[calc(100vw-2rem)] sm:w-[410px] h-[min(74vh,580px)]",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Bot className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 id="ai-chat-title" className="text-sm font-semibold tracking-tight truncate">
                  ผู้ช่วย AI ระดับหน่วยงาน
                </h2>
                <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium px-1.5 py-0.2 border border-emerald-500/20 shrink-0">
                  เหมือน LINE OA
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                <span className="truncate">สังกัด: {departmentLabel}</span>
                {status?.model && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="font-mono shrink-0">{status.model}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {messages.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleClear}
                aria-label="ล้างประวัติการสนทนา"
                title="เริ่มสนทนาใหม่"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsExpanded((prev) => !prev)}
              aria-label={isExpanded ? "ย่อหน้าต่างแชท" : "ขยายหน้าต่างแชท"}
              title={isExpanded ? "ย่อหน้าต่าง" : "ขยายหน้าต่าง"}
            >
              {isExpanded ? (
                <Minimize2 className="size-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-3.5" aria-hidden="true" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setIsOpen(false)}
              aria-label="ปิดหน้าต่างผู้ช่วย AI"
              title="ปิด"
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {status?.isAdmin && (
          <div className="flex items-center justify-between gap-2 border-b border-primary/20 bg-primary/10 px-3.5 py-1.5 text-xs text-primary">
            <span className="truncate">ต้องการดูข้อมูลสถิติภาพรวม 292 หน่วยงาน?</span>
            <Link
              href="/all-ai"
              onClick={() => setIsOpen(false)}
              className="font-medium underline hover:text-primary/80 shrink-0 inline-flex items-center gap-1"
            >
              <span>เปิด AI ทั้งกรม</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
          {isStatusLoading && (
            <div className="rounded-xl border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
              กำลังตรวจสอบสถานะผู้ช่วย AI...
            </div>
          )}

          {!isStatusLoading && isStatusError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div>ไม่สามารถตรวจสอบสถานะบริการ AI จาก Backend ได้ในขณะนี้</div>
            </div>
          )}

          {!isStatusLoading && status && !status.enabled && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-semibold">ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ</p>
                <p className="opacity-90 leading-relaxed">
                  กรุณาเพิ่ม{" "}
                  <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono">
                    GEMINI_API_KEY=&quot;...&quot;
                  </code>{" "}
                  ในไฟล์{" "}
                  <code className="rounded bg-black/10 dark:bg-white/10 px-1 py-0.5 font-mono">
                    backend/.env
                  </code>{" "}
                  แล้วรีสตาร์ท Go Backend เพื่อเปิดใช้งานผู้ช่วย AI
                </p>
              </div>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="space-y-3 pt-1">
              <div className="rounded-2xl border border-border/60 bg-muted/35 p-3.5 text-xs text-muted-foreground leading-relaxed">
                สวัสดีครับ ผมคือผู้ช่วย AI ค่าสาธารณูปโภคระดับหน่วยงาน (เหมือนใน LINE OA) สังกัด{" "}
                <strong className="text-foreground font-semibold">{departmentLabel}</strong>{" "}
                สามารถสอบถามยอดรวม รายการค้างชำระ บิลคลาดเคลื่อน หรือวงเงินงบประมาณของหน่วยงานได้เลยครับ
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-medium text-muted-foreground px-1">คำถามแนะนำ</p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      disabled={!isReady || chatMutation.isPending}
                      onClick={() => sendPrompt(prompt)}
                      className="text-left rounded-xl border border-border/70 bg-background hover:bg-accent/70 hover:text-accent-foreground px-3 py-1.5 text-xs transition-colors disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1",
                  msg.role === "user" ? "items-end" : "items-start",
                )}
              >
                {msg.role === "assistant" && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1 max-w-[90%]">
                    {msg.toolsUsed.map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium border border-primary/15"
                      >
                        <Database className="size-2.5" aria-hidden="true" />
                        <span>{AI_TOOL_LABELS[tool] ?? tool}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  className={cn(
                    "max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted/60 text-foreground border border-border/50 rounded-bl-md",
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  ) : (
                    renderFormattedMessage(msg.content)
                  )}
                </div>
              </div>
            ))
          )}

          {chatMutation.isPending && (
            <div className="flex items-start">
              <div className="rounded-2xl rounded-bl-md border border-border/50 bg-muted/60 px-3.5 py-2.5 text-xs text-muted-foreground animate-pulse">
                กำลังตรวจสอบข้อมูลจากระบบ...
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertTriangle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex-1">{errorMessage}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-border/70 bg-background/80 p-3 space-y-2"
        >
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!isReady || chatMutation.isPending}
              rows={2}
              placeholder={
                isReady
                  ? "พิมพ์คำถามเกี่ยวกับค่าสาธารณูปโภค... (Enter เพื่อส่ง)"
                  : "กรุณาตั้งค่า GEMINI_API_KEY ก่อนเริ่มใช้งาน"
              }
              aria-label="ข้อความถึงผู้ช่วย AI"
              className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || !isReady || chatMutation.isPending}
              aria-label="ส่งคำถาม"
              className="shrink-0 h-10 w-10"
            >
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            AI ระดับหน่วยงาน ตอบจากฐานข้อมูลเฉพาะหน่วยงานของคุณ (Zero Data Leakage)
          </p>
        </form>
      </dialog>
    </>
  );
}
