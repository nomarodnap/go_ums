import { describe, expect, it } from "vitest";
import { cleanTextForSpeech } from "./speech-utils";

describe("cleanTextForSpeech", () => {
  it("removes markdown formatting and emojis", () => {
    const raw = "✨ **สวัสดีค่ะ** น้องธาร่าพร้อมให้บริการแล้วค่ะ! 📊";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).toContain("สวัสดีค่ะ น้องธาร่าพร้อมให้บริการแล้วค่ะ!");
    expect(cleaned).not.toContain("**");
    expect(cleaned).not.toContain("✨");
    expect(cleaned).not.toContain("📊");
  });

  it("converts common English domain terms to Thai phonetics", () => {
    const raw = "ระบบ UMS สรุปยอด Dashboard ค่าไฟ และสถานะ Overdue ผ่าน AI ค่ะ";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).toContain("ยูเอ็มเอส");
    expect(cleaned).toContain("แดชบอร์ด");
    expect(cleaned).toContain("ค้างชำระ");
    expect(cleaned).toContain("เอไอ");
    expect(cleaned).not.toMatch(/[a-zA-Z]/);
  });

  it("removes all remaining English words and letters to enforce 100% Thai speech", () => {
    const raw = "รายการบิล BILL-2569-001 มีสถานะ PENDING ในระบบ UMS ครับ/ค่ะ";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toMatch(/[a-zA-Z]/);
    expect(cleaned).toContain("บิล");
    expect(cleaned).toContain("รอชำระ");
    expect(cleaned).toContain("ยูเอ็มเอส");
  });

  it("converts symbols like %, ฿, & into Thai words", () => {
    const raw = "ยอดค้างชำระเพิ่มขึ้น 15% คิดเป็น ฿50,000 & มีความผิดปกติ";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).toContain("15 เปอร์เซ็นต์");
    expect(cleaned).toContain("บาท 50,000");
    expect(cleaned).toContain("และ มีความผิดปกติ");
    expect(cleaned).not.toContain("%");
    expect(cleaned).not.toContain("฿");
    expect(cleaned).not.toContain("&");
  });

  it("cleans empty brackets left by stripped English abbreviations", () => {
    const raw = "ผู้ช่วยอัจฉริยะ (AI) ประจำระบบ (UMS)";
    const cleaned = cleanTextForSpeech(raw);
    expect(cleaned).not.toContain("()");
    expect(cleaned).not.toMatch(/[a-zA-Z]/);
  });
});
