package service

import (
	"fmt"
	"strconv"
	"strings"
)

// GenerateBillPrefix generates the standard Department of Fisheries bill prefix:
// Format: [CostCenterLast3]-[ThaiYear2Digits][Month2Digits]-[UtilityTypeDigit]-
// Example: 001-6701-1-
func GenerateBillPrefix(costCenterCode string, billingYear int, billingMonth int, utilityType string) string {
	// Thai Buddhist Year (AD Year + 543)
	thaiYear := billingYear + 543
	thaiYearStr := strconv.Itoa(thaiYear)
	if len(thaiYearStr) >= 2 {
		thaiYearStr = thaiYearStr[len(thaiYearStr)-2:]
	}

	paddedMonth := fmt.Sprintf("%02d", billingMonth)

	accountLastDigit := "9" // Default fallback
	switch utilityType {
	case "ค่าไฟฟ้า":
		accountLastDigit = "1"
	case "ค่าประปา&น้ำบาดาล":
		accountLastDigit = "3"
	case "ค่าโทรศัพท์":
		accountLastDigit = "5"
	case "ค่าสื่อสาร&โทรคมนาคม":
		accountLastDigit = "6"
	case "ค่าบริการไปรษณีย์":
		accountLastDigit = "7"
	}

	costCenter := costCenterCode
	if costCenter == "" {
		costCenter = "000"
	}
	if len(costCenter) > 3 {
		costCenter = costCenter[len(costCenter)-3:]
	} else {
		costCenter = fmt.Sprintf("%03s", costCenter)
	}

	return fmt.Sprintf("%s-%s%s-%s-", costCenter, thaiYearStr, paddedMonth, accountLastDigit)
}

// GenerateNextBillCode calculates the next sequential code given a prefix and latest code found
func GenerateNextBillCode(prefix string, latestBillCode string) string {
	nextSeq := 1
	if latestBillCode != "" && strings.HasPrefix(latestBillCode, prefix) {
		seqStr := strings.TrimPrefix(latestBillCode, prefix)
		if s, err := strconv.Atoi(seqStr); err == nil {
			nextSeq = s + 1
		}
	}
	return fmt.Sprintf("%s%02d", prefix, nextSeq)
}
