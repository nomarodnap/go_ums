package email

import (
	"crypto/tls"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/config"
)

type EmailService struct {
	cfg *config.Config
}

func NewEmailService(cfg *config.Config) *EmailService {
	return &EmailService{cfg: cfg}
}

// SendResetPasswordEmail sends a password setup or reset email using the Department of Fisheries template
func (s *EmailService) SendResetPasswordEmail(toEmail, toName, resetURL string) error {
	subject := "ตั้งรหัสผ่านเพื่อเข้าใช้งานระบบรายงานค่าสาธารณูปโภค กรมประมง"

	name := toName
	if name == "" {
		name = "เจ้าหน้าที่"
	}

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
    <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background: linear-gradient(135deg, #0284c7 0%%, #0369a1 100%%); padding: 32px 24px; text-align: center; color: #ffffff;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em;">ระบบรายงานค่าสาธารณูปโภค</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">กรมประมง กระทรวงเกษตรและสหกรณ์</p>
        </div>
        <div style="padding: 32px 24px;">
            <p style="font-size: 15px; font-weight: 600; color: #0f172a; margin-top: 0;">เรียน คุณ%s,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #475569;">
                ระบบได้รับการร้องขอการตั้งรหัสผ่านใหม่สำหรับบัญชีผู้ใช้งานของท่าน เพื่อความปลอดภัยกรุณาคลิกที่ปุ่มด้านล่างเพื่อกำหนดรหัสผ่านใหม่:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="%s" style="background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 32px; border-radius: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);">
                    ตั้งรหัสผ่านใหม่
                </a>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.6; margin-bottom: 0;">
                * ลิงก์นี้มีความปลอดภัยและใช้งานได้ภายใน 1 ชั่วโมง หากท่านไม่ได้ส่งคำขอนี้ สามารถเพิกเฉยต่ออีเมลฉบับนี้ได้
            </p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <div style="background-color: #fef3c7; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px;">
                <p style="font-size: 11px; color: #92400e; line-height: 1.5; margin: 0;">
                    <strong>หมายเหตุ:</strong> หากอีเมลฉบับนี้อยู่ในโฟลเดอร์จดหมายขยะ (Spam / Junk Mail) กรุณากดปุ่ม <strong>"ไม่ใช่จดหมายขยะ" (Not Spam)</strong> เพื่อให้สามารถรับการแจ้งเตือนสำคัญในครั้งถัดไปได้อย่างถูกต้อง
                </p>
            </div>
        </div>
        <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #f1f5f9;">
            <p style="font-size: 11px; color: #94a3b8; margin: 0;">
                กลุ่มเทคโนโลยีสารสนเทศ กรมประมง • ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900
            </p>
        </div>
    </div>
</body>
</html>`, name, resetURL)

	return s.SendMail(toEmail, subject, htmlBody)
}

// SendMail dispatches an email using SMTP (Brevo) or prints simulation in logs
func (s *EmailService) SendMail(toEmail, subject, htmlBody string) error {
	if s.cfg.SMTPHost == "" || s.cfg.SMTPUser == "" || s.cfg.SMTPPass == "" {
		log.Printf("==========================================")
		log.Printf("📩 [EMAIL SIMULATION - NO SMTP CONFIG]")
		log.Printf("To: %s", toEmail)
		log.Printf("Subject: %s", subject)
		log.Printf("==========================================")
		return nil
	}

	fromName := s.cfg.SMTPFromName
	if fromName == "" {
		fromName = "ระบบรายงานค่าสาธารณูปโภค กรมประมง"
	}
	fromEmail := s.cfg.SMTPFromEmail
	if fromEmail == "" {
		fromEmail = s.cfg.SMTPUser
	}

	headers := make(map[string]string)
	headers["From"] = fmt.Sprintf("%s <%s>", fromName, fromEmail)
	headers["To"] = toEmail
	headers["Subject"] = subject
	headers["MIME-Version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=UTF-8"

	var message strings.Builder
	for k, v := range headers {
		message.WriteString(fmt.Sprintf("%s: %s\r\n", k, v))
	}
	message.WriteString("\r\n" + htmlBody)

	addr := fmt.Sprintf("%s:%s", s.cfg.SMTPHost, s.cfg.SMTPPort)
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = s.cfg.SMTPHost
	}

	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		log.Printf("❌ Failed to connect to SMTP server %s: %v", addr, err)
		return fmt.Errorf("failed to connect to SMTP server: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		log.Printf("❌ Failed to create SMTP client: %v", err)
		return fmt.Errorf("failed to create SMTP client: %w", err)
	}
	defer client.Close()

	tlsConfig := &tls.Config{
		ServerName: host,
	}

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err = client.StartTLS(tlsConfig); err != nil {
			log.Printf("❌ Failed to start TLS: %v", err)
			return fmt.Errorf("failed to start TLS: %w", err)
		}
	}

	auth := smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, host)
	if err = client.Auth(auth); err != nil {
		log.Printf("❌ Failed to authenticate with SMTP server: %v", err)
		return fmt.Errorf("failed to authenticate with SMTP server: %w", err)
	}

	if err = client.Mail(fromEmail); err != nil {
		log.Printf("❌ Failed to set mail sender: %v", err)
		return fmt.Errorf("failed to set sender: %w", err)
	}

	if err = client.Rcpt(toEmail); err != nil {
		log.Printf("❌ Failed to set mail recipient: %v", err)
		return fmt.Errorf("failed to set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		log.Printf("❌ Failed to open data writer: %v", err)
		return fmt.Errorf("failed to open data writer: %w", err)
	}
	defer w.Close()

	_, err = w.Write([]byte(message.String()))
	if err != nil {
		log.Printf("❌ Failed to write email data: %v", err)
		return fmt.Errorf("failed to write email body: %w", err)
	}

	log.Printf("✅ [EMAIL SENT] Successfully sent email to %s (Subject: %s)", toEmail, subject)
	return nil
}
