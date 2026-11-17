package notifications

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/dof/ums-backend/internal/linenotify"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Engine evaluates automated notification rules and dispatches department LINE alerts.
type Engine struct {
	pool         *pgxpool.Pool
	lineNotifier *linenotify.Service
}

// RunResult summarizes a notification engine execution.
type RunResult struct {
	CreatedCount int
	Mode         string
}

// NewEngine initializes the notification rules engine.
func NewEngine(pool *pgxpool.Pool, lineNotifier *linenotify.Service) *Engine {
	return &Engine{
		pool:         pool,
		lineNotifier: lineNotifier,
	}
}

// ShouldRunMissingData determines whether rule #1 (missing previous month bill reminder) runs for the given mode & timestamp.
func ShouldRunMissingData(mode string, now time.Time) bool {
	switch mode {
	case "all", "missing_data":
		return true
	case "scheduled":
		return now.Day() >= 23
	default:
		return false
	}
}

// ShouldRunDailyRules determines whether recurring daily checks (pending bills, late payment, abnormal expense) run.
func ShouldRunDailyRules(mode string) bool {
	return mode == "all" || mode == "daily" || mode == "scheduled"
}

// Run evaluates all applicable notification rules, inserts deduplicated notifications, and dispatches LINE messages per department.
func (e *Engine) Run(ctx context.Context, mode string) (RunResult, error) {
	if mode == "" {
		mode = "all"
	}
	res := RunResult{Mode: mode}
	if e == nil || e.pool == nil {
		return res, nil
	}

	now := time.Now()

	// 1. Missing Data Reminder (on or after 23rd of the month when scheduled, or always on manual all/missing_data)
	if ShouldRunMissingData(mode, now) {
		targetMonth := int(now.Month()) - 1
		targetYear := now.Year()
		if targetMonth == 0 {
			targetMonth = 12
			targetYear--
		}

		sRows, err := e.pool.Query(ctx, `
			SELECT ds.department_id, ds.utility_type, ds.service_number, COALESCE(d.full_name, '')
			FROM department_services ds
			LEFT JOIN departments d ON ds.department_id = d.id
			WHERE ds.service_number IS NOT NULL AND ds.service_number != ''
			  AND ds.is_active = true
		`)
		if err == nil {
			type serviceItem struct {
				departmentID   string
				utilityType    string
				serviceNumber  string
				departmentName string
			}
			var services []serviceItem
			for sRows.Next() {
				var s serviceItem
				if scanErr := sRows.Scan(&s.departmentID, &s.utilityType, &s.serviceNumber, &s.departmentName); scanErr == nil {
					services = append(services, s)
				}
			}
			sRows.Close()

			bRows, bErr := e.pool.Query(ctx, `
				SELECT department_id, service_number
				FROM utility_bills
				WHERE billing_month = $1 AND billing_year = $2
			`, targetMonth, targetYear)
			if bErr == nil {
				billedServices := make(map[string]bool)
				for bRows.Next() {
					var deptID string
					var sNum *string
					if scanErr := bRows.Scan(&deptID, &sNum); scanErr == nil && sNum != nil {
						for _, p := range strings.Split(*sNum, ",") {
							if clean := strings.TrimSpace(p); clean != "" {
								billedServices[deptID+"_"+clean] = true
							}
						}
					}
				}
				bRows.Close()

				missingByDept := make(map[string][]string)
				deptNames := make(map[string]string)
				for _, s := range services {
					if !billedServices[s.departmentID+"_"+s.serviceNumber] {
						missingByDept[s.departmentID] = append(
							missingByDept[s.departmentID],
							fmt.Sprintf("%s (%s)", s.utilityType, s.serviceNumber),
						)
						deptNames[s.departmentID] = s.departmentName
					}
				}

				title := fmt.Sprintf("แจ้งเตือนให้บันทึกข้อมูลรอบบิลเดือน %d/%d", targetMonth, targetYear)
				for deptID, missingList := range missingByDept {
					var exists bool
					_ = e.pool.QueryRow(ctx, `
						SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'MISSING_DATA' AND department_id = $1 AND title = $2)
					`, deptID, title).Scan(&exists)
					if !exists {
						msg := "ใกล้ถึงกำหนดเวลาบันทึกข้อมูล พบว่ายังมีหมายเลขที่ยังไม่ได้บันทึกบิล ดังนี้:\n" + strings.Join(missingList, ", ")
						if len(msg) > 500 {
							msg = msg[:497] + "..."
						}
						notifID := uuid.New().String()
						link := "/bills/new"
						if _, insErr := e.pool.Exec(ctx, `
							INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
							VALUES ($1, $2, $3, $4, 'MISSING_DATA', 'NORMAL', false, $5, NOW(), NOW())
						`, notifID, deptID, title, msg, link); insErr == nil {
							res.CreatedCount++
							e.notifyDepartment(linenotify.NotificationPayload{
								ID:             notifID,
								DepartmentID:   deptID,
								DepartmentName: deptNames[deptID],
								Title:          title,
								Message:        msg,
								Type:           "MISSING_DATA",
								Severity:       "NORMAL",
								Link:           link,
							})
						}
					}
				}
			}
		}
	}

	// 2-4. Daily recurring rules
	if ShouldRunDailyRules(mode) {
		// 2. Pending Bills (Unpaid for >= 2 months)
		currentAbsoluteMonth := now.Year()*12 + int(now.Month())
		pRows, err := e.pool.Query(ctx, `
			SELECT b.id, b.department_id, b.utility_type, b.billing_month, b.billing_year, b.service_number, COALESCE(d.full_name, '')
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			WHERE b.payment_status = 'PENDING'
			  AND ($1 - (b.billing_year * 12 + b.billing_month)) >= 2
		`, currentAbsoluteMonth)
		if err == nil {
			thMonths := []string{"ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."}
			for pRows.Next() {
				var id, deptID, utilityType, deptName string
				var month, year int
				var sNum *string
				if scanErr := pRows.Scan(&id, &deptID, &utilityType, &month, &year, &sNum, &deptName); scanErr == nil {
					mName := ""
					if month >= 1 && month <= 12 {
						mName = thMonths[month-1]
					}
					numStr := "-"
					if sNum != nil && *sNum != "" {
						numStr = *sNum
					}
					title := "แจ้งเตือนหนี้ค้างชำระ"
					msg := fmt.Sprintf("[%s] รายการ%s (หมายเลขผู้ใช้: %s) ของรอบบิล %s %d ยังไม่ได้ชำระเงิน (ค้างชำระเกิน 2 เดือน)",
						deptName, utilityType, numStr, mName, year+543)
					link := fmt.Sprintf("/bills/%s/edit", id)

					var exists bool
					_ = e.pool.QueryRow(ctx, `
						SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'PENDING_BILL' AND link = $1)
					`, link).Scan(&exists)
					if !exists {
						notifID := uuid.New().String()
						if _, insErr := e.pool.Exec(ctx, `
							INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
							VALUES ($1, $2, $3, $4, 'PENDING_BILL', 'URGENT', false, $5, NOW(), NOW())
						`, notifID, deptID, title, msg, link); insErr == nil {
							res.CreatedCount++
							e.notifyDepartment(linenotify.NotificationPayload{
								ID:             notifID,
								DepartmentID:   deptID,
								DepartmentName: deptName,
								Title:          title,
								Message:        msg,
								Type:           "PENDING_BILL",
								Severity:       "URGENT",
								Link:           link,
							})
						}
					}
				}
			}
			pRows.Close()
		}

		// 3. Late Payment (Received status, no payment within 15 days)
		fifteenDaysAgo := now.Add(-15 * 24 * time.Hour)
		lRows, err := e.pool.Query(ctx, `
			SELECT b.id, b.department_id, b.utility_type, b.service_number, COALESCE(d.full_name, '')
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			WHERE b.invoice_status = 'RECEIVED'
			  AND b.payment_status = 'PENDING'
			  AND b.received_date <= $1
		`, fifteenDaysAgo)
		if err == nil {
			for lRows.Next() {
				var id, deptID, utilityType, deptName string
				var sNum *string
				if scanErr := lRows.Scan(&id, &deptID, &utilityType, &sNum, &deptName); scanErr == nil {
					numStr := "-"
					if sNum != nil && *sNum != "" {
						numStr = *sNum
					}
					title := "แจ้งเตือนการเบิกจ่ายล่าช้า"
					msg := fmt.Sprintf("[%s] รายการ%s (หมายเลขผู้ใช้: %s) ยังไม่มีการเบิกจ่าย (เกิน 15 วันหลังจากรับใบแจ้งหนี้)",
						deptName, utilityType, numStr)
					link := fmt.Sprintf("/bills/%s/edit", id)

					var exists bool
					_ = e.pool.QueryRow(ctx, `
						SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'LATE_PAYMENT' AND link = $1)
					`, link).Scan(&exists)
					if !exists {
						notifID := uuid.New().String()
						if _, insErr := e.pool.Exec(ctx, `
							INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
							VALUES ($1, $2, $3, $4, 'LATE_PAYMENT', 'WARNING', false, $5, NOW(), NOW())
						`, notifID, deptID, title, msg, link); insErr == nil {
							res.CreatedCount++
							e.notifyDepartment(linenotify.NotificationPayload{
								ID:             notifID,
								DepartmentID:   deptID,
								DepartmentName: deptName,
								Title:          title,
								Message:        msg,
								Type:           "LATE_PAYMENT",
								Severity:       "WARNING",
								Link:           link,
							})
						}
					}
				}
			}
			lRows.Close()
		}

		// 4. Abnormal Expense (> 30% increase from last month)
		currentMonth := int(now.Month())
		currentYear := now.Year()
		lastMonth := currentMonth - 1
		lastMonthYear := currentYear
		if currentMonth == 1 {
			lastMonth = 12
			lastMonthYear = currentYear - 1
		}

		recentRows, err := e.pool.Query(ctx, `
			SELECT b.id, b.department_id, b.utility_type, b.billing_month, b.billing_year,
			       COALESCE(b.invoice_amount, 0), b.service_number, COALESCE(d.full_name, '')
			FROM utility_bills b
			LEFT JOIN departments d ON b.department_id = d.id
			WHERE (b.billing_month = $1 AND b.billing_year = $2)
			   OR (b.billing_month = $3 AND b.billing_year = $4)
		`, currentMonth, currentYear, lastMonth, lastMonthYear)
		if err == nil {
			type grpItem struct {
				current       float64
				last          float64
				deptName      string
				currentBillID string
				deptID        string
				utilType      string
				serviceNum    string
			}
			grouped := make(map[string]*grpItem)
			for recentRows.Next() {
				var id, deptID, utilityType, deptName string
				var month, year int
				var amount float64
				var sNum *string
				if scanErr := recentRows.Scan(&id, &deptID, &utilityType, &month, &year, &amount, &sNum, &deptName); scanErr == nil {
					s := "-"
					if sNum != nil && *sNum != "" {
						s = *sNum
					}
					key := fmt.Sprintf("%s::%s::%s", deptID, utilityType, s)
					if _, ok := grouped[key]; !ok {
						grouped[key] = &grpItem{deptName: deptName, deptID: deptID, utilType: utilityType, serviceNum: s}
					}
					if month == currentMonth && year == currentYear {
						grouped[key].current += amount
						grouped[key].currentBillID = id
					} else {
						grouped[key].last += amount
					}
				}
			}
			recentRows.Close()

			for _, g := range grouped {
				if g.last > 0 && g.current > (g.last*1.3) {
					title := "แจ้งเตือนค่าใช้จ่ายสูงผิดปกติ"
					msg := fmt.Sprintf("[%s] %s (หมายเลขผู้ใช้: %s) ในเดือนนี้สูงกว่าเดือนที่แล้วมากกว่า 30%%",
						g.deptName, g.utilType, g.serviceNum)
					link := "/reports/utility"
					if g.currentBillID != "" {
						link = fmt.Sprintf("/bills/%s/edit", g.currentBillID)
					}
					var exists bool
					_ = e.pool.QueryRow(ctx, `
						SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'ABNORMAL_EXPENSE' AND link = $1)
					`, link).Scan(&exists)
					if !exists {
						notifID := uuid.New().String()
						if _, insErr := e.pool.Exec(ctx, `
							INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
							VALUES ($1, $2, $3, $4, 'ABNORMAL_EXPENSE', 'WARNING', false, $5, NOW(), NOW())
						`, notifID, g.deptID, title, msg, link); insErr == nil {
							res.CreatedCount++
							e.notifyDepartment(linenotify.NotificationPayload{
								ID:             notifID,
								DepartmentID:   g.deptID,
								DepartmentName: g.deptName,
								Title:          title,
								Message:        msg,
								Type:           "ABNORMAL_EXPENSE",
								Severity:       "WARNING",
								Link:           link,
							})
						}
					}
				}
			}
		}
	}

	if res.CreatedCount > 0 {
		_, _ = e.pool.Exec(ctx, `SELECT pg_notify('notifications', $1)`,
			fmt.Sprintf(`{"action":"engine_run","mode":"%s","created":%d}`, mode, res.CreatedCount))
		log.Printf("[Notification Engine] Created %d new department notification(s) (mode=%s)", res.CreatedCount, mode)
	}
	return res, nil
}

func (e *Engine) notifyDepartment(payload linenotify.NotificationPayload) {
	if e.lineNotifier != nil {
		e.lineNotifier.NotifyDepartmentAsync(payload)
	}
}

