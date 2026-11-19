package ai

import (
	"context"
	"testing"
)

func TestKnowledgeServiceSearch(t *testing.T) {
	svc := NewKnowledgeService()

	// 1. Search phone ceiling
	phoneHits := svc.Search(context.Background(), "หัวหน้าศูนย์เบิกค่าโทรศัพท์ได้กี่บาท", "")
	if len(phoneHits) == 0 {
		t.Fatalf("expected at least 1 hit for phone ceiling, got 0")
	}
	if phoneHits[0].Topic != TopicPhoneCeilings {
		t.Errorf("expected top hit to be phone ceilings, got %s", phoneHits[0].Topic)
	}

	// 2. Search water leak waiver proof
	leakHits := svc.Search(context.Background(), "น้ำรั่วต้องใช้เอกสารอะไรบ้าง", "")
	if len(leakHits) == 0 {
		t.Fatalf("expected at least 1 hit for water leak, got 0")
	}
	if leakHits[0].Topic != TopicWaiverAndProof {
		t.Errorf("expected top hit to be waiver and proof, got %s", leakHits[0].Topic)
	}

	// 3. Search fiscal year rollover
	rolloverHits := svc.Search(context.Background(), "บิลเดือนกันยายนมาเดือนพฤศจิกายนเบิกอย่างไร", "")
	if len(rolloverHits) == 0 {
		t.Fatalf("expected at least 1 hit for rollover, got 0")
	}
	if rolloverHits[0].Topic != TopicFiscalRollover {
		t.Errorf("expected top hit to be fiscal rollover, got %s", rolloverHits[0].Topic)
	}

	// 4. Topic filter
	topicHits := svc.Search(context.Background(), "", "audit_criteria")
	if len(topicHits) == 0 {
		t.Fatalf("expected hit for audit_criteria topic, got 0")
	}
	if topicHits[0].Topic != TopicAuditCriteria {
		t.Errorf("expected audit criteria item, got %s", topicHits[0].Topic)
	}
}
