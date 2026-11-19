/**
 * Utilities for cleaning text before speech synthesis (TTS / Web Speech API).
 * Ensures that น้องธาร่า speaks exclusively in fluent Thai with zero English words or characters.
 */

const PHONETIC_REPLACEMENTS: Array<[RegExp, string]> = [
  // Multi-word phrases (match before single words)
  [/\bline\s*oa\b/gi, "ไลน์ โอเอ"],
  [/\blive\s*2d\b/gi, "ไลฟ์ทูดี"],
  [/\bface\s*call\b/gi, "เฟซคอล"],
  [/\bthank\s*you\b/gi, "ขอบคุณ"],
  [/\bthanks\b/gi, "ขอบคุณ"],
  [/\bweb\s*speech\b/gi, "เว็บสปีช"],
  [/\bspeech\s*to\s*text\b/gi, "การแปลงเสียงเป็นข้อความ"],
  [/\btext\s*to\s*speech\b/gi, "การแปลงข้อความเป็นเสียงพูด"],
  [/\bsent[_\s]to[_\s]disbursing\b/gi, "ส่งเบิกจ่าย"],
  [/\baging\s*report\b/gi, "รายงานหนี้ค้างชำระ"],
  [/\bdue\s*soon\b/gi, "ใกล้ครบกำหนด"],
  [/\bdue\s*date\b/gi, "วันครบกำหนดชำระ"],
  [/\boverdue\s*alert\b/gi, "เตือนบิลเกินกำหนด"],
  [/\banomaly\s*flagged\b/gi, "ตรวจพบความผิดปกติ"],
  [/\bwaiver\s*request\b/gi, "ขอผ่อนผัน"],
  [/\battachment\s*proof\b/gi, "เอกสารแนบ"],

  // Single terms and abbreviations
  [/\bums\b/gi, "ยูเอ็มเอส"],
  [/\bai\b/gi, "เอไอ"],
  [/\btts\b/gi, "ทีทีเอส"],
  [/\bstt\b/gi, "เอสทีที"],
  [/\bapi\b/gi, "เอพีไอ"],
  [/\bdashboard\b/gi, "แดชบอร์ด"],
  [/\boverdue\b/gi, "ค้างชำระ"],
  [/\bpending\b/gi, "รอชำระ"],
  [/\bpaid\b/gi, "ชำระแล้ว"],
  [/\bdraft\b/gi, "ร่าง"],
  [/\breceived\b/gi, "ลงรับแล้ว"],
  [/\binvoices?\b/gi, "ใบแจ้งหนี้"],
  [/\breceipts?\b/gi, "ใบเสร็จ"],
  [/\baudits?\b/gi, "การตรวจสอบความผิดปกติ"],
  [/\breports?\b/gi, "รายงาน"],
  [/\bbills?\b/gi, "บิล"],
  [/\bservices?\b/gi, "บริการ"],
  [/\btotals?\b/gi, "ยอดรวม"],
  [/\bstatus\b/gi, "สถานะ"],
  [/\btracking\b/gi, "การติดตาม"],
  [/\bbudgets?\b/gi, "งบประมาณ"],
  [/\bsummary\b/gi, "สรุปภาพรวม"],
  [/\banomal(y|ies)\b/gi, "ความผิดปกติ"],
  [/\bforecasts?\b/gi, "การพยากรณ์"],
  [/\binsights?\b/gi, "ข้อคิดเห็นเชิงลึก"],
  [/\bnotifications?\b/gi, "การแจ้งเตือน"],
  [/\bsettings?\b/gi, "การตั้งค่า"],
  [/\bdepartments?\b/gi, "หน่วยงาน"],
  [/\bexcel\b/gi, "เอ็กเซล"],
  [/\bpdf\b/gi, "พีดีเอฟ"],
  [/\bbaht\b/gi, "บาท"],
  [/\bthb\b/gi, "บาท"],
  [/\bok\b/gi, "โอเค"],
  [/\bavatar\b/gi, "อวตาร"],
  [/\busers?\b/gi, "ผู้ใช้"],
  [/\badmins?\b/gi, "แอดมิน"],
  [/\bsystems?\b/gi, "ระบบ"],
  [/\bonline\b/gi, "ออนไลน์"],
  [/\boffline\b/gi, "ออฟไลน์"],
  [/\bline\b/gi, "ไลน์"],
  [/\bhello\b/gi, "สวัสดี"],
  [/\bhi\b/gi, "สวัสดี"],
  [/\byes\b/gi, "ใช่"],
  [/\bno\b/gi, "ไม่ใช่"],
  [/\btara\b/gi, "ธาร่า"],
  [/\bmodels?\b/gi, "โมเดล"],
  [/\bgemini\b/gi, "เจมิไน"],
  [/\bgoogle\b/gi, "กูเกิล"],
  [/\bchats?\b/gi, "แชท"],
  [/\bcalls?\b/gi, "คอล"],
  [/\bmics?\b/gi, "ไมค์"],
  [/\baudio\b/gi, "เสียง"],
  [/\bvoices?\b/gi, "เสียงพูด"],
];

/**
 * Cleans and transforms text for Thai speech synthesis:
 * 1. Strips URLs, markdown code blocks, emojis, symbols, and formatting.
 * 2. Maps English technical terms and loanwords to Thai phonetic equivalents.
 * 3. Strips all remaining English alphabetic characters so no English is ever spoken.
 * 4. Normalizes whitespace and removes orphaned punctuation.
 */
export function cleanTextForSpeech(raw: string, maxLen = 450): string {
  if (!raw || typeof raw !== "string") return "";

  let text = raw
    // Strip URLs
    .replace(/https?:\/\/\S+/g, "")
    // Strip fenced code blocks
    .replace(/```[\s\S]*?```/g, " ")
    // Strip inline code and markdown markers
    .replace(/[*#`_~>]/g, " ")
    // Strip emojis
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu,
      ""
    )
    // Common symbols
    .replace(/%/g, " เปอร์เซ็นต์ ")
    .replace(/฿/g, " บาท ")
    .replace(/&/g, " และ ")
    .replace(/@/g, " แอด ")
    .replace(/[-•|/]/g, " ");

  // Map known English terms to Thai phonetic equivalents
  for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Strip all remaining English alphabetic characters to ensure 100% pure Thai speech
  text = text.replace(/[a-zA-Z]+/g, " ");

  // Clean empty parentheses/brackets resulting from stripped English acronyms (e.g., "(UMS)" -> "()")
  text = text
    .replace(/\(\s*\)/g, " ")
    .replace(/\[\s*\]/g, " ")
    .replace(/\{s*\}/g, " ")
    .replace(/[,;:]\s*[,;:]/g, ",")
    .replace(/\s+/g, " ")
    .trim();

  if (maxLen > 0 && text.length > maxLen) {
    return text.slice(0, maxLen).trim();
  }

  return text;
}
