"use client";

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  Database,
  Expand,
  FileText,
  Headphones,
  Maximize2,
  Mic,
  Minimize2,
  PhoneOff,
  Radio,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Shrink,
  Smile,
  Sparkles,
  TrendingUp,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AI_TOOL_LABELS,
  type AIChatMessage,
  useAIChat,
  useAIStatus,
} from "@/lib/api/ai-hooks";
import { useGetCurrentUser } from "@/lib/api/generated/auth/auth";
import { cn } from "@/lib/utils";
import { TaraAvatar, type TaraEmotion } from "@/components/ai-chat/tara-avatar";

interface UIStateMessage extends AIChatMessage {
  id: string;
}

const FEATURED_PROMPTS = [
  {
    icon: Building2,
    title: "สรุปภาพรวมทั้งกรม",
    desc: "สรุปยอดค่าสาธารณูปโภคทุกประเภท 292 หน่วยงาน เปรียบเทียบเดือนก่อนหน้า",
    prompt: "สรุปภาพรวมค่าสาธารณูปโภคทั้งกรมประมงประจำเดือนนี้",
  },
  {
    icon: AlertTriangle,
    title: "หน่วยงานค้างชำระสูงสุด",
    desc: "ตรวจสอบ 10 หน่วยงานที่มียอดค้างชำระสูงสุดเพื่อเร่งรัดติดตาม",
    prompt: "10 หน่วยงานที่มียอดค้างชำระสูงสุดในกรมประมง",
  },
  {
    icon: TrendingUp,
    title: "แนวโน้มค่าไฟฟ้า 6 เดือน",
    desc: "วิเคราะห์สถิติค่าไฟฟ้ารวมทั้งกรม อัตราเติบโต และความผิดปกติ",
    prompt: "วิเคราะห์แนวโน้มค่าไฟฟ้ารวมทั้งกรมย้อนหลัง 6 เดือน",
  },
  {
    icon: ShieldAlert,
    title: "ตรวจจับความผิดปกติ",
    desc: "ค้นหาหน่วยงานที่มีบิลค่าใช้จ่ายกระโดดผิดปกติหรือจ่ายล่าช้า",
    prompt: "มีหน่วยงานใดที่พบความคลาดเคลื่อนหรือบิลจ่ายช้ามากที่สุด",
  },
] as const;

const QUICK_SUGGESTIONS = [
  "สรุปภาพรวมค่าสาธารณูปโภคทั้งกรมประมงประจำเดือนนี้",
  "10 หน่วยงานที่มียอดค้างชำระสูงสุดในกรมประมง",
  "วิเคราะห์แนวโน้มค่าไฟฟ้ารวมทั้งกรมย้อนหลัง 6 เดือน",
  "มีหน่วยงานใดที่พบความคลาดเคลื่อนหรือบิลจ่ายช้ามากที่สุด",
  "ยอดงบประมาณค่าสาธารณูปโภคคงเหลือของทั้งกรมมีเท่าไหร่?",
] as const;

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

function cleanTextForSpeech(text: string): string {
  return text
    .replace(/[*#`_~]/g, " ")
    .replace(/https?:\/\/\S+/g, "")
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
      ""
    )
    .replace(/[-•|]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 450)
    .trim();
}

function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function CallDurationBadge() {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-muted/60 px-3 py-1 text-xs text-muted-foreground font-mono border border-border/60">
      <Radio className="size-3 text-emerald-500 animate-pulse" />
      <span>สายสนทนา: {formatDuration(duration)}</span>
    </div>
  );
}

function renderInlineBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  let offset = 0;
  return parts.map((part) => {
    const key = `seg-${offset}`;
    offset += part.length;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={key} className="font-semibold text-foreground">
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
    <div className="space-y-2 text-sm sm:text-base leading-relaxed break-words">
      {lines.map((rawLine) => {
        const key = `line-${offset}`;
        offset += rawLine.length + 1;
        const trimmed = rawLine.trim();
        if (!trimmed) {
          return <div key={key} className="h-1.5" />;
        }
        if (trimmed.startsWith("### ")) {
          return (
            <h4 key={key} className="font-semibold text-base text-foreground pt-1">
              {renderInlineBold(trimmed.slice(4))}
            </h4>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h3 key={key} className="font-bold text-lg text-foreground pt-2">
              {renderInlineBold(trimmed.slice(3))}
            </h3>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h2 key={key} className="font-bold text-xl text-foreground pt-2">
              {renderInlineBold(trimmed.slice(2))}
            </h2>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          return (
            <div key={key} className="flex items-start gap-2 pl-1.5">
              <span
                aria-hidden="true"
                className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
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

export default function AllAIAssistantPage() {
  const [messages, setMessages] = useState<UIStateMessage[]>([]);
  const [input, setInput] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Face Call States
  const [emotion, setEmotion] = useState<TaraEmotion>("idle");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [live2DEnabled, setLive2DEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("tara_live2d_enabled") !== "false";
    }
    return true;
  });
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [isListeningMic, setIsListeningMic] = useState(false);
  const [latestSubtitle, setLatestSubtitle] = useState<string>(
    "สวัสดีค่ะผู้บริหารและเจ้าหน้าที่ส่วนกลาง น้องธาร่าพร้อมรายงานและวิเคราะห์ข้อมูล 292 หน่วยงานแล้วค่ะ"
  );

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const speechTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const stopSpeaking = React.useCallback(() => {
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const handleToggleVoice = React.useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) {
        stopSpeaking();
        setEmotion("idle");
      }
      return next;
    });
  }, [stopSpeaking]);

  const handleToggleLive2D = React.useCallback(() => {
    setLive2DEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("tara_live2d_enabled", String(next));
      }
      if (next) {
        toast.info("เปิดใช้งาน Live 2D น้องธาร่าแล้ว");
      } else {
        setIsTheaterMode(false);
        toast.info("ปิดแผง Live 2D แล้ว (ขยายพื้นที่แชทเต็มหน้าจอ)");
      }
      return next;
    });
  }, []);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageIdRef = useRef(0);

  const { data: userData } = useGetCurrentUser();
  const currentUser = userData?.status === 200 ? userData.data.user : null;

  const { data: status, isLoading: isStatusLoading, isError: isStatusError } = useAIStatus(true);
  const chatMutation = useAIChat("all");

  const isEnabled = status?.enabled === true;
  const isReady = isEnabled && !isStatusLoading;

  const isCentralStaff =
    currentUser?.role === "admin" ||
    currentUser?.role === "central_staff" ||
    currentUser?.role === "auditor" ||
    currentUser?.role === "strategy_finance" ||
    status?.isAdmin === true;

  // Update Listening state when typing or mic is listening
  useEffect(() => {
    if (chatMutation.isPending) {
      setEmotion("thinking");
    } else if (isSpeaking) {
      // Keep speaking
    } else if (isListeningMic || input.trim().length > 0) {
      setEmotion("listening");
    } else {
      setEmotion("idle");
    }
  }, [input, isListeningMic, chatMutation.isPending, isSpeaking]);

  useEffect(() => {
    if (
      (messages.length > 0 || chatMutation.isPending) &&
      typeof messagesEndRef.current?.scrollIntoView === "function"
    ) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, chatMutation.isPending]);

  // Fallback Web Speech API (Local Browser Voices)
  const tryFallbackSpeechSynthesis = (cleanText: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setIsSpeaking(true);
      speechTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
        setEmotion("idle");
      }, 3500);
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "th-TH";
      utterance.rate = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const thaiVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes("th") ||
          v.name.includes("Thai") ||
          v.name.includes("ภาษาไทย") ||
          v.name.includes("Premwadee") ||
          v.name.includes("Niwat")
      );
      if (thaiVoice) {
        utterance.voice = thaiVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        setEmotion("idle");
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        setEmotion("idle");
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(true);
      speechTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
        setEmotion("idle");
      }, 3500);
    }
  };

  // High-Fidelity Thai Speech Synthesis Helper
  const speakThai = (rawText: string) => {
    if (typeof window === "undefined") return;
    const clean = cleanTextForSpeech(rawText);
    if (!clean) return;
    setLatestSubtitle(clean);

    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
    }

    if (!voiceEnabled) {
      setIsSpeaking(true);
      speechTimeoutRef.current = setTimeout(() => {
        setIsSpeaking(false);
        setEmotion("idle");
      }, 2500);
      return;
    }

    // Stop any existing sound
    stopSpeaking();

    // Stream genuine Thai neural speech from /api/tts
    try {
      const audioUrl = `/api/tts?text=${encodeURIComponent(clean)}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
      };
      audio.onended = () => {
        setIsSpeaking(false);
        setEmotion("idle");
      };
      audio.onerror = () => {
        tryFallbackSpeechSynthesis(clean);
      };

      audio.play().catch((err) => {
        console.warn("[TTS Playback blocked / fallback]", err);
        tryFallbackSpeechSynthesis(clean);
      });
    } catch {
      tryFallbackSpeechSynthesis(clean);
    }
  };

  // Speech-to-Text Microphone toggle
  const toggleMic = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "เบราว์เซอร์ของท่านไม่รองรับการพิมพ์ด้วยเสียง (แนะนำ Google Chrome หรือ Microsoft Edge)"
      );
      return;
    }

    if (isListeningMic) {
      recognitionRef.current?.stop();
      setIsListeningMic(false);
      setEmotion("idle");
      return;
    }

    try {
      stopSpeaking();
      const recognition = new SpeechRecognition();
      recognition.lang = "th-TH";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListeningMic(true);
        setEmotion("listening");
        setLatestSubtitle(
          "น้องธาร่ากำลังรับฟังเสียงของคุณอยู่ค่ะ พูดคำถามได้เลยนะคะ..."
        );
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setInput(transcript);
        }
      };

      recognition.onerror = (e: any) => {
        console.warn("[SpeechRecognition Error]:", e);
        setIsListeningMic(false);
        setEmotion("idle");
      };

      recognition.onend = () => {
        setIsListeningMic(false);
        setEmotion("idle");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error("[SpeechRecognition Init Error]:", e);
      setIsListeningMic(false);
    }
  };

  const sendPrompt = (rawText: string) => {
    const text = rawText.trim();
    if (!text || chatMutation.isPending || !isReady) return;

    stopSpeaking();

    messageIdRef.current += 1;
    const userMessage: UIStateMessage = {
      id: `all-msg-${messageIdRef.current}`,
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setErrorMessage(null);
    setEmotion("thinking");
    setLatestSubtitle(`กำลังสแกนและวิเคราะห์ข้อมูล 292 หน่วยงานเกี่ยวกับ "${text.slice(0, 40)}..."`);

    chatMutation.mutate(
      nextMessages.map(({ role, content }) => ({ role, content })),
      {
        onSuccess: (res) => {
          messageIdRef.current += 1;
          const replyId = `all-msg-${messageIdRef.current}`;
          setMessages((prev) => [
            ...prev,
            {
              id: replyId,
              role: "assistant",
              content: res.reply,
              toolsUsed: res.toolsUsed,
            },
          ]);

          // Contextual emotion detection
          const replyText = res.reply;
          if (
            replyText.includes("ผิดปกติ") ||
            replyText.includes("คลาดเคลื่อน") ||
            replyText.includes("ค้างชำระ") ||
            replyText.includes("ล่าช้า") ||
            replyText.includes("เกินเกณฑ์")
          ) {
            setEmotion("alert");
          } else if (
            replyText.includes("ประหยัด") ||
            replyText.includes("เรียบร้อย") ||
            replyText.includes("ปกติ") ||
            replyText.includes("ลดลง")
          ) {
            setEmotion("happy");
          } else {
            setEmotion("speaking");
          }

          // Trigger Voice & Talking Animation
          speakThai(res.reply);
        },
        onError: (err) => {
          setErrorMessage(extractErrorMessage(err));
          setEmotion("alert");
          setIsSpeaking(false);
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
    stopSpeaking();
    setMessages([]);
    setErrorMessage(null);
    setEmotion("idle");
    setLatestSubtitle("เริ่มการสนทนาใหม่แล้วค่ะ สามารถเลือกคำถามแนะนำหรือพิมพ์สอบถามได้เลยนะคะ");
  };

  if (!isCentralStaff && !isStatusLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
        <div className="size-16 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-500/20">
          <ShieldAlert className="size-8" />
        </div>
        <div className="space-y-2 max-w-md">
          <h2 className="text-xl font-bold tracking-tight">เฉพาะเจ้าหน้าที่ส่วนกลางและผู้ดูแลระบบ</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            ผู้ช่วย AI ภาพรวมทั้งกรม (292 หน่วยงาน) อนุญาตเฉพาะผู้ดูแลระบบและเจ้าหน้าที่ส่วนกลาง
            ท่านสามารถใช้ผู้ช่วย AI ประจำหน่วยงานของท่านได้ที่มุมขวาล่างของหน้าจอ
          </p>
        </div>
        <Button variant="outline" render={<Link href="/dashboard" />}>
          กลับสู่แดชบอร์ดหน่วยงาน
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8.5rem)] max-w-7xl mx-auto w-full gap-4">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-white dark:bg-card p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-xs">
            <Sparkles className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
                ผู้ช่วย AI ภาพรวมทั้งกรม (292 หน่วยงาน)
              </h1>
              <Badge variant="default" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                สิทธิ์ส่วนกลาง
              </Badge>
              {live2DEnabled && (
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Face Call Interactive
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground truncate mt-0.5">
              สนทนากับ &quot;น้องธาร่า&quot; AI ผู้เชี่ยวชาญด้านงบประมาณและสาธารณูปโภค 292 หน่วยงาน กรมประมง
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Call Timer pill */}
          {live2DEnabled && <CallDurationBadge />}

          {/* Toggle Live2D on/off */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleToggleLive2D}
            title={
              live2DEnabled
                ? "คลิกเพื่อปิดแผง Live 2D และใช้งานแชทเต็มหน้าจอ"
                : "คลิกเพื่อเปิดแผง Live 2D น้องธาร่า"
            }
            className={cn(
              "gap-1.5 text-xs rounded-xl transition-all cursor-pointer",
              live2DEnabled
                ? "border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/5 hover:bg-sky-500/10"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className={cn("size-3.5", live2DEnabled ? "text-sky-500 animate-pulse" : "text-muted-foreground")} />
            <span>{live2DEnabled ? "2D Live: เปิด" : "2D Live: ปิด"}</span>
          </Button>

          {/* Toggle Theater vs Split View (only when Live 2D is open) */}
          {live2DEnabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsTheaterMode((prev) => !prev)}
              title={isTheaterMode ? "ย่อหน้าจอเป็นโหมดแยกข้อมูล" : "ขยายเป็นโหมดเต็มจอภาพยนตร์"}
              className="gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              {isTheaterMode ? <Shrink className="size-3.5" /> : <Expand className="size-3.5" />}
              <span className="hidden sm:inline">{isTheaterMode ? "โหมดแยกหน้าต่าง" : "โหมดเต็มจอ"}</span>
            </Button>
          )}

          {messages.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="gap-1.5 text-xs rounded-xl cursor-pointer"
            >
              <RotateCcw className="size-3.5" />
              <span>เริ่มบทสนทนาใหม่</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Face Call Workspace Container */}
      <div
        className={cn(
          "grid flex-1 gap-4 min-h-0 transition-all duration-300",
          !live2DEnabled || isTheaterMode
            ? "grid-cols-1"
            : "grid-cols-1 lg:grid-cols-12"
        )}
      >
        {/* Left Column: Face Call Video Screen with น้องธาร่า (Tara Avatar) */}
        {live2DEnabled && (
          <div
            className={cn(
              "flex flex-col gap-3 min-h-0",
              isTheaterMode ? "col-span-1 h-full" : "lg:col-span-5 xl:col-span-5"
            )}
          >
            <TaraAvatar
              emotion={emotion}
              isSpeaking={isSpeaking}
              isListening={isListeningMic || input.trim().length > 0}
              isThinking={chatMutation.isPending}
              voiceEnabled={voiceEnabled}
              onToggleVoice={handleToggleVoice}
              live2DEnabled={live2DEnabled}
              onToggleLive2D={handleToggleLive2D}
              subtitleText={latestSubtitle}
              className="w-full flex-1 min-h-[380px] lg:min-h-[440px]"
            />

            {/* Interactive Emotion Tester & Call Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-2xl border border-border/80 bg-white dark:bg-card text-xs shadow-xs">
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
                <span>ทดสอบอารมณ์:</span>
              </div>
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setEmotion("happy");
                    setIsSpeaking(true);
                    speakThai("ยินดีที่ได้ดูแลและร่วมวางแผนงบประมาณกับเจ้าหน้าที่ทุกท่านค่ะ");
                  }}
                  className="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  😊 ยิ้มแย้ม
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmotion("thinking");
                    setLatestSubtitle("กำลังค้นหาและประมวลผลข้อมูล 292 หน่วยงาน...");
                  }}
                  className="px-2 py-1 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  🤔 ครุ่นคิด
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmotion("listening");
                    setLatestSubtitle("กำลังรับฟังคำถามของท่านอย่างตั้งใจค่ะ...");
                  }}
                  className="px-2 py-1 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  👂 รับฟัง
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmotion("alert");
                    setIsSpeaking(true);
                    speakThai("ตรวจพบข้อสังเกต มีบิลที่เกินเกณฑ์เฉลี่ยผิดปกติในระบบค่ะ");
                  }}
                  className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-medium transition-colors cursor-pointer"
                >
                  ⚠️ ข้อสังเกต
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopSpeaking();
                    setEmotion("idle");
                  }}
                  className="px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground border border-border/60 text-[11px] transition-colors cursor-pointer"
                >
                  🔄 รีเซ็ต
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Interactive Transcript, Featured Prompts & Analysis Workspace */}
        <Card
          className={cn(
            "flex flex-col overflow-hidden border-border/80 bg-white dark:bg-card shadow-md min-h-0",
            !live2DEnabled
              ? "col-span-1"
              : isTheaterMode
                ? "hidden"
                : "lg:col-span-7 xl:col-span-7"
          )}
        >
          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isStatusLoading && (
              <div className="rounded-xl border border-border/60 bg-muted/40 p-4 text-sm text-muted-foreground">
                กำลังตรวจสอบสถานะการเชื่อมต่อ AI Assistant...
              </div>
            )}

            {!isStatusLoading && isStatusError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
              >
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div>ไม่สามารถเชื่อมต่อบริการ AI จาก Backend ได้ในขณะนี้</div>
              </div>
            )}

            {!isStatusLoading && status && !status.enabled && (
              <div
                role="status"
                className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
              >
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ</p>
                  <p className="text-xs leading-relaxed opacity-90">
                    กรุณาเพิ่ม <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY=&quot;...&quot;</code> ในไฟล์ <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded font-mono">backend/.env</code> แล้วรีสตาร์ทเซิร์ฟเวอร์
                  </p>
                </div>
              </div>
            )}

            {/* Empty State / Featured Prompt Cards */}
            {messages.length === 0 && (
              <div className="space-y-5 py-2 max-w-2xl mx-auto">
                <div className="text-center space-y-1.5">
                  <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                    สนทนากับ &quot;น้องธาร่า&quot; ผู้ช่วย AI ประจำ 292 หน่วยงาน
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    เลือกหัวข้อคำถามแนะนำด้านล่าง หรือพิมพ์คำถามที่ต้องการให้วิเคราะห์ น้องธาร่าจะดึงสถิติและอธิบายให้ฟังทันทีค่ะ
                  </p>
                </div>

                {/* 4 Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {FEATURED_PROMPTS.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.title}
                        type="button"
                        disabled={!isReady || chatMutation.isPending}
                        onClick={() => sendPrompt(item.prompt)}
                        className="group flex flex-col text-left p-3.5 rounded-2xl border border-border/80 bg-background/80 hover:bg-accent/40 hover:border-primary/40 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                            <Icon className="size-3.5" />
                          </div>
                          <span className="font-semibold text-xs sm:text-sm text-foreground group-hover:text-primary transition-colors">
                            {item.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                          {item.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Flow */}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex flex-col gap-1.5",
                  msg.role === "user" ? "items-end" : "items-start",
                )}
              >
                {/* Tool Calling Badges */}
                {msg.role === "assistant" && msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[85%] pl-1">
                    {msg.toolsUsed.map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium border border-primary/20"
                      >
                        <Database className="size-3" />
                        <span>{AI_TOOL_LABELS[tool] ?? tool}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={cn(
                    "max-w-[90%] sm:max-w-[84%] rounded-2xl p-4 shadow-xs transition-all",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted/50 text-foreground border border-border/60 rounded-bl-sm",
                  )}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {renderFormattedMessage(msg.content)}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => speakThai(msg.content)}
                          title="ให้น้องธาร่าอ่านออกเสียงข้อความนี้"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-background/60 transition-colors cursor-pointer"
                        >
                          <Volume2 className="size-3 text-primary" />
                          <span>ฟังเสียงน้องธาร่าอ่าน</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Pending Skeleton Bubble */}
            {chatMutation.isPending && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-sm border border-border/60 bg-muted/60 p-4 text-sm text-muted-foreground animate-pulse flex items-center gap-3">
                  <Bot className="size-4 animate-spin text-primary" />
                  <span>น้องธาร่ากำลังรวบรวมและวิเคราะห์ข้อมูลจาก 292 หน่วยงาน...</span>
                </div>
              </div>
            )}

            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive"
              >
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <span className="flex-1">{errorMessage}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar Form */}
          <div className="border-t border-border/80 bg-background/90 backdrop-blur-md p-3 space-y-2.5">
            {/* Quick Prompt Pills when in conversation */}
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                <span className="text-muted-foreground shrink-0 text-[11px] font-medium mr-1">ถามต่อ:</span>
                {QUICK_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={!isReady || chatMutation.isPending}
                    onClick={() => sendPrompt(suggestion)}
                    className="rounded-full border border-border/70 bg-card hover:bg-accent/70 hover:text-accent-foreground px-3 py-1 text-xs shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <Button
                type="button"
                variant={isListeningMic ? "default" : "outline"}
                size="icon"
                onClick={toggleMic}
                title={
                  isListeningMic
                    ? "กำลังรับฟังเสียงพูดภาษาไทย... (คลิกเพื่อหยุด)"
                    : "กดเพื่อพูดภาษาไทย (Speech to Text)"
                }
                className={cn(
                  "size-11 shrink-0 rounded-xl transition-all cursor-pointer",
                  isListeningMic
                    ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse shadow-md border-rose-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Mic className={cn("size-5", isListeningMic && "animate-bounce text-white")} />
              </Button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!isReady || chatMutation.isPending}
                rows={2}
                placeholder={
                  isListeningMic
                    ? "กำลังรับฟังเสียงพูดภาษาไทย... พูดคำถามได้เลยค่ะ"
                    : isReady
                      ? "พิมพ์หรือกดไมค์พูดถามน้องธาร่าเกี่ยวกับ 292 หน่วยงาน... (Enter เพื่อส่ง)"
                      : "กรุณาตั้งค่า GEMINI_API_KEY ก่อนเริ่มใช้งาน"
                }
                aria-label="ข้อความถึงผู้ช่วย AI ภาพรวมทั้งกรม"
                className="flex-1 resize-none rounded-xl border border-input bg-background p-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || !isReady || chatMutation.isPending}
                aria-label="ส่งคำถาม"
                className="size-11 shrink-0 rounded-xl shadow-xs cursor-pointer"
              >
                <Send className="size-5" />
              </Button>
            </form>

            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground px-1">
              <span className="flex items-center gap-1">
                <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ภาพรวม 292 หน่วยงาน (Safe Tool Calling • สิทธิ์ส่วนกลาง)</span>
              </span>
              <span>
                ถามเฉพาะหน่วยงานของคุณ? ใช้ผู้ช่วย AI ที่มุมขวาล่าง
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
