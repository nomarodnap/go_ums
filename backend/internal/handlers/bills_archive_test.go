package handlers

import (
	"context"
	"net/http"
	"reflect"
	"testing"

	"github.com/danielgtaylor/huma/v2"
	"github.com/dof/ums-backend/internal/auth"
)

func TestParseServiceNumbers(t *testing.T) {
	got := parseServiceNumbers(" 02-562-0600 , , 02-562-0601,02-562-0602 ")
	want := []string{"02-562-0600", "02-562-0601", "02-562-0602"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("parseServiceNumbers() = %v, want %v", got, want)
	}

	if empty := parseServiceNumbers("  , ,  "); len(empty) != 0 {
		t.Fatalf("expected empty slice, got %v", empty)
	}
}

func TestFindOverlappingServiceNumber(t *testing.T) {
	cases := []struct {
		name     string
		target   string
		existing string
		wantHit  bool
		wantSN   string
	}{
		{
			name:     "exact match",
			target:   "1234567890",
			existing: "1234567890",
			wantHit:  true,
			wantSN:   "1234567890",
		},
		{
			name:     "comma separated overlap",
			target:   "02-111-1111, 02-222-2222",
			existing: "02-222-2222, 02-333-3333",
			wantHit:  true,
			wantSN:   "02-222-2222",
		},
		{
			name:     "case insensitive overlap with spaces",
			target:   " ca-9001 ",
			existing: "CA-8000, CA-9001",
			wantHit:  true,
			wantSN:   "ca-9001",
		},
		{
			name:     "no overlap",
			target:   "02-111-1111, 02-222-2222",
			existing: "02-333-3333, 02-444-4444",
			wantHit:  false,
			wantSN:   "",
		},
		{
			name:     "empty existing",
			target:   "02-111-1111",
			existing: "",
			wantHit:  false,
			wantSN:   "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			sn, hit := findOverlappingServiceNumber(parseServiceNumbers(tc.target), tc.existing)
			if hit != tc.wantHit || sn != tc.wantSN {
				t.Fatalf("got (%q, %v), want (%q, %v)", sn, hit, tc.wantSN, tc.wantHit)
			}
		})
	}
}

func TestArchiveBillTxRequiresReason(t *testing.T) {
	err := archiveBillTx(
		context.Background(),
		nil,
		&auth.Claims{UserID: "u-1", Role: "admin"},
		"bill-1",
		"   ",
		nil,
	)
	if err == nil {
		t.Fatal("expected 400 error when archive reason is empty, got nil")
	}
	statusErr, ok := err.(huma.StatusError)
	if !ok {
		t.Fatalf("expected huma.StatusError, got %T (%v)", err, err)
	}
	if statusErr.GetStatus() != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", statusErr.GetStatus())
	}
}
