package handlers

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotificationDTO struct {
	ID             string    `json:"id"`
	DepartmentID   *string   `json:"departmentId,omitempty"`
	DepartmentName *string   `json:"departmentName,omitempty"`
	TargetRole     *string   `json:"targetRole,omitempty"`
	Title          string    `json:"title"`
	Message        string    `json:"message"`
	Type           string    `json:"type"`
	Severity       string    `json:"severity"`
	IsRead         bool      `json:"isRead"`
	Link           *string   `json:"link,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
}

type ListNotificationsOutput struct {
	Body []NotificationDTO `json:"body"`
}

func RegisterNotificationRoutes(api huma.API, pool *pgxpool.Pool) {
	// List Notifications
	huma.Register(api, huma.Operation{
		OperationID: "listNotifications",
		Method:      http.MethodGet,
		Path:        "/api/notifications",
		Summary:     "List system notifications",
		Tags:        []string{"Notifications"},
	}, func(ctx context.Context, input *struct {
		DepartmentID string `query:"departmentId" doc:"Optional Department ID filter"`
		Scope        string `query:"scope" doc:"Scope of notifications: 'my_dept' or 'all'" default:"all"`
	}) (*ListNotificationsOutput, error) {
		user, _ := auth.UserFromContext(ctx)
		userDeptID := ""
		if user != nil {
			userDeptID = user.DepartmentID
		}

		query := `
			SELECT n.id, n.department_id, d.full_name, n.target_role, n.title, n.message, n.type, n.severity, n.is_read, n.link, n.created_at 
			FROM notifications n
			LEFT JOIN departments d ON d.id = n.department_id
			WHERE 1=1
		`
		var args []interface{}
		argIdx := 1

		if input.Scope == "my_dept" {
			targetDept := input.DepartmentID
			if targetDept == "" {
				targetDept = userDeptID
			}
			if targetDept != "" {
				query += fmt.Sprintf(" AND (n.department_id = $%d OR n.department_id IS NULL)", argIdx)
				args = append(args, targetDept)
			} else {
				query += " AND n.department_id IS NULL"
			}
		} else {
			// scope == "all"
			if input.DepartmentID != "" {
				query += fmt.Sprintf(" AND (n.department_id = $%d OR n.department_id IS NULL)", argIdx)
				args = append(args, input.DepartmentID)
			}
		}
		query += " ORDER BY n.created_at DESC LIMIT 100"

		rows, err := pool.Query(ctx, query, args...)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to fetch notifications: " + err.Error())
		}
		defer rows.Close()

		results := make([]NotificationDTO, 0)
		for rows.Next() {
			var n NotificationDTO
			if err := rows.Scan(
				&n.ID, &n.DepartmentID, &n.DepartmentName, &n.TargetRole, &n.Title, &n.Message, &n.Type, &n.Severity,
				&n.IsRead, &n.Link, &n.CreatedAt,
			); err == nil {
				results = append(results, n)
			}
		}

		return &ListNotificationsOutput{Body: results}, nil
	})

	// Mark read
	huma.Register(api, huma.Operation{
		OperationID: "markNotificationRead",
		Method:      http.MethodPut,
		Path:        "/api/notifications/{id}/read",
		Summary:     "Mark notification as read",
		Tags:        []string{"Notifications"},
	}, func(ctx context.Context, input *struct {
		ID string `path:"id"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		_, err := pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE id = $1", input.ID)
		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark notification read")
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Mark all read
	huma.Register(api, huma.Operation{
		OperationID: "markAllNotificationsRead",
		Method:      http.MethodPut,
		Path:        "/api/notifications/read-all",
		Summary:     "Mark all notifications as read",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Scope string `query:"scope" doc:"Scope: 'my_dept' or 'all'"`
	}) (*struct{ Body bool `json:"body"` }, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor", "central_staff", "regional_staff", "strategy_finance", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		if input.Scope == "all" && (user.Role == "admin" || user.Role == "auditor") {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false")
		} else if user.DepartmentID != "" {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false AND (department_id = $1 OR department_id IS NULL)", user.DepartmentID)
		} else {
			_, err = pool.Exec(ctx, "UPDATE notifications SET is_read = true WHERE is_read = false AND department_id IS NULL")
		}

		if err != nil {
			return nil, huma.Error500InternalServerError("failed to mark all notifications as read")
		}
		return &struct{ Body bool `json:"body"` }{Body: true}, nil
	})

	// Get Notification Counts
	huma.Register(api, huma.Operation{
		OperationID: "getNotificationCounts",
		Method:      http.MethodGet,
		Path:        "/api/notifications/counts",
		Summary:     "Get unread notification counts for user department and system-wide",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct{}) (*struct {
		Body struct {
			MyDeptCount    int `json:"myDeptCount"`
			AllSystemCount int `json:"allSystemCount"`
		} `json:"body"`
	}, error) {
		user, err := auth.RequireRoles(ctx, "admin", "auditor", "central_staff", "regional_staff", "strategy_finance", "user")
		if err != nil {
			return nil, huma.Error401Unauthorized(err.Error())
		}

		var myDeptCount int
		if user.DepartmentID != "" {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false AND (department_id = $1 OR department_id IS NULL)
			`, user.DepartmentID).Scan(&myDeptCount)
		} else {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false AND department_id IS NULL
			`).Scan(&myDeptCount)
		}

		var allSystemCount int
		if user.Role == "admin" || user.Role == "auditor" {
			_ = pool.QueryRow(ctx, `
				SELECT count(*) FROM notifications
				WHERE is_read = false
			`).Scan(&allSystemCount)
		}

		out := &struct {
			Body struct {
				MyDeptCount    int `json:"myDeptCount"`
				AllSystemCount int `json:"allSystemCount"`
			} `json:"body"`
		}{}
		out.Body.MyDeptCount = myDeptCount
		out.Body.AllSystemCount = allSystemCount
		return out, nil
	})

	// Run Notification Engine
	huma.Register(api, huma.Operation{
		OperationID: "runNotificationEngine",
		Method:      http.MethodPost,
		Path:        "/api/notifications/run-engine",
		Summary:     "Run automated notification engine rules",
		Tags:        []string{"Notifications"},
		Security: []map[string][]string{
			{"bearerAuth": {}},
		},
	}, func(ctx context.Context, input *struct {
		Mode string `query:"mode" doc:"Mode: 'all', 'missing_data', or 'daily'"`
	}) (*struct {
		Body struct {
			Success bool   `json:"success"`
			Message string `json:"message"`
		} `json:"body"`
	}, error) {
		if _, err := auth.RequireRoles(ctx, "admin", "auditor"); err != nil {
			return nil, huma.Error403Forbidden(err.Error())
		}

		mode := input.Mode
		if mode == "" {
			mode = "all"
		}
		now := time.Now()

		// 1. Missing Data Reminder (on or near 23rd of the month, or force in mode missing_data/all)
		if mode == "all" || mode == "missing_data" {
			targetMonth := int(now.Month()) - 1
			targetYear := now.Year()
			if targetMonth == 0 {
				targetMonth = 12
				targetYear -= 1
			}

			// Fetch all department services
			sRows, err := pool.Query(ctx, `
				SELECT ds.department_id, ds.utility_type, ds.service_number, d.full_name
				FROM department_services ds
				LEFT JOIN departments d ON ds.department_id = d.id
				WHERE ds.service_number IS NOT NULL AND ds.service_number != ''
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
					if err := sRows.Scan(&s.departmentID, &s.utilityType, &s.serviceNumber, &s.departmentName); err == nil {
						services = append(services, s)
					}
				}
				sRows.Close()

				// Fetch bills for target month & year
				bRows, err := pool.Query(ctx, `
					SELECT department_id, service_number
					FROM utility_bills
					WHERE billing_month = $1 AND billing_year = $2
				`, targetMonth, targetYear)
				if err == nil {
					billedServices := make(map[string]bool)
					for bRows.Next() {
						var deptID string
						var sNum *string
						if err := bRows.Scan(&deptID, &sNum); err == nil && sNum != nil {
							parts := strings.Split(*sNum, ",")
							for _, p := range parts {
								clean := strings.TrimSpace(p)
								if clean != "" {
									billedServices[deptID+"_"+clean] = true
								}
							}
						}
					}
					bRows.Close()

					// Group missing services by department
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
						_ = pool.QueryRow(ctx, `
							SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'MISSING_DATA' AND department_id = $1 AND title = $2)
						`, deptID, title).Scan(&exists)
						if !exists {
							msg := "ใกล้ถึงกำหนดเวลาบันทึกข้อมูล พบว่ายังมีหมายเลขที่ยังไม่ได้บันทึกบิล ดังนี้:\n" + strings.Join(missingList, ", ")
							if len(msg) > 500 {
								msg = msg[:497] + "..."
							}
							link := "/bills/new"
							_, _ = pool.Exec(ctx, `
								INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
								VALUES ($1, $2, $3, $4, 'MISSING_DATA', 'NORMAL', false, $5, NOW(), NOW())
							`, uuid.New().String(), deptID, title, msg, link)
						}
					}
				}
			}
		}

		// 2. Pending Bills (Unpaid for >= 2 months)
		if mode == "all" || mode == "daily" {
			currentAbsoluteMonth := now.Year()*12 + int(now.Month())
			pRows, err := pool.Query(ctx, `
				SELECT b.id, b.department_id, b.utility_type, b.billing_month, b.billing_year, b.service_number, d.full_name
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
					if err := pRows.Scan(&id, &deptID, &utilityType, &month, &year, &sNum, &deptName); err == nil {
						mName := ""
						if month >= 1 && month <= 12 {
							mName = thMonths[month-1]
						}
						numStr := "-"
						if sNum != nil && *sNum != "" {
							numStr = *sNum
						}
						msg := fmt.Sprintf("[%s] รายการ%s (หมายเลขผู้ใช้: %s) ของรอบบิล %s %d ยังไม่ได้ชำระเงิน (ค้างชำระเกิน 2 เดือน)",
							deptName, utilityType, numStr, mName, year+543)
						link := fmt.Sprintf("/bills/%s/edit", id)

						var exists bool
						_ = pool.QueryRow(ctx, `
							SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'PENDING_BILL' AND link = $1)
						`, link).Scan(&exists)
						if !exists {
							_, _ = pool.Exec(ctx, `
								INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
								VALUES ($1, $2, 'แจ้งเตือนหนี้ค้างชำระ', $3, 'PENDING_BILL', 'URGENT', false, $4, NOW(), NOW())
							`, uuid.New().String(), deptID, msg, link)
						}
					}
				}
				pRows.Close()
			}

			// 3. Late Payment (Received status, no payment within 15 days)
			fifteenDaysAgo := now.Add(-15 * 24 * time.Hour)
			lRows, err := pool.Query(ctx, `
				SELECT b.id, b.department_id, b.utility_type, b.service_number, d.full_name
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
					if err := lRows.Scan(&id, &deptID, &utilityType, &sNum, &deptName); err == nil {
						numStr := "-"
						if sNum != nil && *sNum != "" {
							numStr = *sNum
						}
						msg := fmt.Sprintf("[%s] รายการ%s (หมายเลขผู้ใช้: %s) ยังไม่มีการเบิกจ่าย (เกิน 15 วันหลังจากรับใบแจ้งหนี้)",
							deptName, utilityType, numStr)
						link := fmt.Sprintf("/bills/%s/edit", id)

						var exists bool
						_ = pool.QueryRow(ctx, `
							SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'LATE_PAYMENT' AND link = $1)
						`, link).Scan(&exists)
						if !exists {
							_, _ = pool.Exec(ctx, `
								INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
								VALUES ($1, $2, 'แจ้งเตือนการเบิกจ่ายล่าช้า', $3, 'LATE_PAYMENT', 'WARNING', false, $4, NOW(), NOW())
							`, uuid.New().String(), deptID, msg, link)
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

			recentRows, err := pool.Query(ctx, `
				SELECT b.id, b.department_id, b.utility_type, b.billing_month, b.billing_year, 
				       COALESCE(b.invoice_amount, 0), b.service_number, d.full_name
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
					if err := recentRows.Scan(&id, &deptID, &utilityType, &month, &year, &amount, &sNum, &deptName); err == nil {
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
						msg := fmt.Sprintf("[%s] %s (หมายเลขผู้ใช้: %s) ในเดือนนี้สูงกว่าเดือนที่แล้วมากกว่า 30%%",
							g.deptName, g.utilType, g.serviceNum)
						link := "/reports/utility"
						if g.currentBillID != "" {
							link = fmt.Sprintf("/bills/%s/edit", g.currentBillID)
						}
						var exists bool
						_ = pool.QueryRow(ctx, `
							SELECT EXISTS(SELECT 1 FROM notifications WHERE type = 'ABNORMAL_EXPENSE' AND link = $1)
						`, link).Scan(&exists)
						if !exists {
							_, _ = pool.Exec(ctx, `
								INSERT INTO notifications (id, department_id, title, message, type, severity, is_read, link, created_at, updated_at)
								VALUES ($1, $2, 'แจ้งเตือนค่าใช้จ่ายสูงผิดปกติ', $3, 'ABNORMAL_EXPENSE', 'WARNING', false, $4, NOW(), NOW())
							`, uuid.New().String(), g.deptID, msg, link)
						}
					}
				}
			}
		}

		out := &struct {
			Body struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			} `json:"body"`
		}{}
		out.Body.Success = true
		out.Body.Message = "Notification engine executed successfully"
		return out, nil
	})
}
