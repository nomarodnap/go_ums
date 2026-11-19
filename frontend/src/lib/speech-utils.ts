/**
 * Utilities for cleaning text before speech synthesis (TTS / Web Speech API).
 * Ensures that น้องธาร่า speaks exclusively in fluent Thai with zero English words or characters.
 */

const PHONETIC_REPLACEMENTS: Array<[RegExp, string]> = [
  // Multi-word phrases & System terms (match before single words)
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
  [/\bbill\s*lifecycle\b/gi, "วงจรชีวิตของบิล"],
  [/\bstatus\s*flow\b/gi, "ลำดับสถานะ"],
  [/\baudit\s*trail\b/gi, "ประวัติการตรวจสอบ"],
  [/\bactivity\s*logs?\b/gi, "บันทึกการทำงาน"],
  [/\bfullscreen\s*dialog\b/gi, "หน้าต่างเต็มจอ"],
  [/\bdepartment\s*combobox\b/gi, "ช่องเลือกหน่วยงาน"],
  [/\bai\s*insights?\b/gi, "ข้อคิดเห็นเอไอ"],
  [/\bforecast\s*panel\b/gi, "หน้าต่างพยากรณ์"],
  [/\broles?\s*(&|and)\s*permissions?\b/gi, "บทบาทและสิทธิ์"],
  [/\bbudget\s*codes?\b/gi, "รหัสงบประมาณ"],
  [/\bai\s*explain\b/gi, "เอไออธิบายความผิดปกติ"],
  [/\brecheck\s*all\s*audits?\b/gi, "คำนวณตรวจสอบใหม่ทั้งหมด"],
  [/\bresolve\s*\/?\s*waive\b/gi, "รับรองหรือผ่อนผัน"],
  [/\ballocated\s*amount\b/gi, "งบประมาณจัดสรร"],
  [/\btransferred\s*amount\b/gi, "งบโอนเปลี่ยนแปลง"],
  [/\breal[_\s-]?time\b/gi, "เรียลไทม์"],
  [/\bflex\s*message\b/gi, "เฟล็กซ์เมสเสจ"],
  [/\bpush\s*notifications?\b/gi, "การแจ้งเตือน"],
  [/\bweb\s*notification\s*bell\b/gi, "การแจ้งเตือนบนเว็บ"],
  [/\bcorrection\s*requested\b/gi, "ขอเอกสารแก้ไข"],
  [/\bsuspension\s*warning\b/gi, "เตือนระงับบริการ"],

  // Audit anomaly keys (supports both underscore and space after markdown stripping)
  [/\bis[_\s]late[_\s]receive\b/gi, "รับบิลช้า"],
  [/\bis[_\s]late[_\s]payment\b/gi, "จ่ายเงินช้า"],
  [/\bis[_\s]overdue[_\s]more[_\s]than[_\s]2[_\s]months\b/gi, "ค้างชำระเกินสองเดือน"],
  [/\bis[_\s]disbursement[_\s]over[_\s]2[_\s]months\b/gi, "เบิกจ่ายนานเกินสองเดือน"],
  [/\bis[_\s]wrong[_\s]month\b/gi, "เดือนไม่ตรงรอบบิล"],
  [/\bis[_\s]phone[_\s]over[_\s]limit\b/gi, "ค่าโทรศัพท์เกินสิทธิ์"],
  [/\bis[_\s]phone[_\s]usage[_\s]over[_\s]limit\b/gi, "ยอดใช้โทรศัพท์เกินวงเงิน"],
  [/\bis[_\s]wrong[_\s]budget\b/gi, "รหัสงบประมาณไม่ตรง"],
  [/\bis[_\s]duplicate\b/gi, "บิลซ้ำซ้อน"],
  [/\bis[_\s]anomaly[_\s]expense\b/gi, "ค่าใช้จ่ายสูงผิดปกติ"],
  [/\bis[_\s]manual[_\s]anomaly\b/gi, "ผู้ตรวจสอบปักธง"],

  // Route paths
  [/\/dashboard\b/gi, " แดชบอร์ดหน่วยงาน "],
  [/\/overview\b/gi, " แดชบอร์ดภาพรวมทั้งกรม "],
  [/\/all-ai\b/gi, " ผู้ช่วยเอไอทั้งกรม "],
  [/\/notifications\b/gi, " การแจ้งเตือน "],
  [/\/all-notifications\b/gi, " การแจ้งเตือนทุกหน่วยงาน "],
  [/\/service-tracking\b/gi, " สถานะเครื่องวัด "],
  [/\/bills\b/gi, " รายการค่าใช้จ่าย "],
  [/\/all-bills\b/gi, " รายการค่าใช้จ่ายทั้งหมด "],
  [/\/services\b/gi, " รหัสเครื่องวัด "],
  [/\/all-services\b/gi, " รหัสเครื่องวัดทั้งหมด "],
  [/\/bill-tracking\b/gi, " ติดตามความคืบหน้าบิล "],
  [/\/reports\b/gi, " ศูนย์รวมรายงาน "],
  [/\/line-chat\b/gi, " สนทนาไลน์ "],
  [/\/departments\b/gi, " จัดการหน่วยงาน "],
  [/\/settings\b/gi, " ตั้งค่าระบบ "],
  [/\/audits\b/gi, " ตรวจสอบความผิดปกติ "],
  [/\/budgets\b/gi, " การจัดสรรงบประมาณ "],

  // Utility providers & Telecommunications
  [/\bpea\b/gi, "กฟภ."],
  [/\bmea\b/gi, "กฟน."],
  [/\bpwa\b/gi, "กปภ."],
  [/\bmwa\b/gi, "กปน."],
  [/\btot\b/gi, "ทีโอที"],
  [/\bcat\b/gi, "แคท"],
  [/\bnt\b/gi, "เอ็นที"],
  [/\bais\b/gi, "เอไอเอส"],
  [/\btrue\b/gi, "ทรู"],
  [/\b3bb\b/gi, "ทรีบีบี"],

  // Statuses & Technical acronyms
  [/\bresolved\b/gi, "ผ่านการตรวจสอบแล้ว"],
  [/\bwaived\b/gi, "อนุมัติผ่อนผันแล้ว"],
  [/\bsuspended\b/gi, "ระงับบริการ"],
  [/\bkpi\b/gi, "เคพีไอ"],
  [/\bid\b/gi, "ไอดี"],
  [/\bsse\b/gi, "เอสเอสอี"],
  [/\bpostgresql\b/gi, "โพสต์เกรสคิวเอล"],
  [/\bpostgres\b/gi, "โพสต์เกรส"],
  [/\blisten\b/gi, "ลิสเซ่น"],
  [/\bnotify\b/gi, "โนติฟาย"],
  [/\bz-score\b/gi, "แซดสกอร์"],
  [/\biqr\b/gi, "ไอคิวอาร์"],

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
 * 2. Maps English technical terms, route paths, provider codes, and loanwords to Thai phonetic equivalents.
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
    .replace(/[-•|]/g, " ");

  // Map known English terms to Thai phonetic equivalents
  for (const [pattern, replacement] of PHONETIC_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Strip all remaining English alphabetic characters to ensure 100% pure Thai speech
  text = text.replace(/[a-zA-Z]+/g, " ");

  // Clean leftover slashes and empty parentheses/brackets resulting from stripped English acronyms
  text = text
    .replace(/\//g, " ")
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
