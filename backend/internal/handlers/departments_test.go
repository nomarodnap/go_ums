package handlers

import "testing"

func TestIsTenDigits(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected bool
	}{
		{"empty string", "", false},
		{"9 digits", "123456789", false},
		{"10 digits standard", "1234567890", true},
		{"11 digits", "12345678901", false},
		{"10 chars with letter", "12345a7890", false},
		{"10 chars with dash", "123-456789", false},
		{"valid DOF cost center 1", "0700400000", true},
		{"valid DOF cost center 2", "2500300055", true},
		{"10 Thai numerals", "๑๒๓๔๕๖๗๘๙๐", false},
		{"whitespace included", " 0700400000", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isTenDigits(tt.input); got != tt.expected {
				t.Errorf("isTenDigits(%q) = %v; want %v", tt.input, got, tt.expected)
			}
		})
	}
}
