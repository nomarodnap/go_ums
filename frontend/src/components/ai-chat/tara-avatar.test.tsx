import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TaraAvatar } from "./tara-avatar";

describe("TaraAvatar Component", () => {
  it("renders Tara character identity and default idle state", () => {
    render(<TaraAvatar emotion="idle" />);

    expect(screen.getByText("น้องธาร่า")).toBeInTheDocument();
    expect(screen.getByText(/Tara AI/)).toBeInTheDocument();
    expect(screen.getByText(/ผู้เชี่ยวชาญด้านงบประมาณและสาธารณูปโภค/)).toBeInTheDocument();
    expect(screen.getByText("FACE CALL LIVE")).toBeInTheDocument();
    expect(screen.getByText("พร้อมสนทนา:")).toBeInTheDocument();
    expect(screen.getByText("สแตนด์บายรับสาย")).toBeInTheDocument();
  });

  it("updates emotion badges and labels according to situation", () => {
    const { rerender } = render(<TaraAvatar emotion="thinking" isThinking={true} />);

    expect(screen.getByText("กำลังวิเคราะห์ข้อมูล:")).toBeInTheDocument();
    expect(screen.getByText("สแกนสถิติ 292 หน่วยงาน...")).toBeInTheDocument();

    rerender(<TaraAvatar emotion="alert" />);
    expect(screen.getByText("พบจุดสังเกต / คลาดเคลื่อน:")).toBeInTheDocument();
    expect(screen.getByText("มีบิลผิดปกติหรือยอดค้างชำระสูง")).toBeInTheDocument();

    rerender(<TaraAvatar emotion="happy" />);
    expect(screen.getByText("ข้อมูลปกติ / ประหยัดงบ:")).toBeInTheDocument();
    expect(screen.getByText("การเบิกจ่ายเป็นไปตามเกณฑ์")).toBeInTheDocument();

    rerender(<TaraAvatar emotion="speaking" isSpeaking={true} />);
    expect(screen.getByText("น้องธาร่า กำลังพูด:")).toBeInTheDocument();
  });

  it("renders live subtitles overlay when subtitleText is provided", () => {
    render(
      <TaraAvatar
        emotion="speaking"
        subtitleText="สรุปภาพรวมค่าสาธารณูปโภค 292 หน่วยงานในเดือนนี้เรียบร้อยค่ะ"
      />
    );

    expect(
      screen.getByText("สรุปภาพรวมค่าสาธารณูปโภค 292 หน่วยงานในเดือนนี้เรียบร้อยค่ะ")
    ).toBeInTheDocument();
  });

  it("toggles voice audio when clicking audio button", async () => {
    const user = userEvent.setup();
    const onToggleVoice = vi.fn();

    render(
      <TaraAvatar
        emotion="idle"
        voiceEnabled={true}
        onToggleVoice={onToggleVoice}
      />
    );

    const voiceBtn = screen.getByTitle("ปิดเสียงอ่านออกเสียง");
    await user.click(voiceBtn);

    expect(onToggleVoice).toHaveBeenCalledTimes(1);
  });

  it("renders Live2D interactive badge and handles mouse tracking", () => {
    render(<TaraAvatar emotion="idle" live2DEnabled={true} />);
    expect(screen.getByText("Live2D ขยับตามเมาส์")).toBeInTheDocument();
    expect(screen.getByAltText(/น้องธาร่า/)).toBeInTheDocument();
  });

  it("toggles Live2D off and on when clicking the Live2D button", async () => {
    const user = userEvent.setup();
    const onToggleLive2D = vi.fn();

    const { rerender } = render(
      <TaraAvatar
        emotion="idle"
        live2DEnabled={true}
        onToggleLive2D={onToggleLive2D}
      />
    );

    const toggleBtn = screen.getByTitle(/คลิกเพื่อปิด 2D Live/);
    await user.click(toggleBtn);
    expect(onToggleLive2D).toHaveBeenCalledTimes(1);

    // Rerender with live2DEnabled=false
    rerender(
      <TaraAvatar
        emotion="idle"
        live2DEnabled={false}
        onToggleLive2D={onToggleLive2D}
      />
    );

    expect(screen.getByText("2D Live ปิดอยู่ (ภาพนิ่ง)")).toBeInTheDocument();
  });
});
