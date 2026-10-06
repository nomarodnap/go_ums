import { notFound } from "next/navigation";
import { EditBillForm } from "@/components/bills/edit-bill-form";

const BACKEND_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:8080";

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const billId = resolvedParams.id;

  // Fetch bill, departments, services, and budget codes in parallel on server
  const [billRes, deptRes, servicesRes, codesRes] = await Promise.all([
    fetch(`${BACKEND_URL}/api/bills/${billId}`, {
      cache: "no-store",
    }).catch(() => null),
    fetch(`${BACKEND_URL}/api/departments`, {
      cache: "no-store",
    }).catch(() => null),
    fetch(`${BACKEND_URL}/api/departments/services`, {
      cache: "no-store",
    }).catch(() => null),
    fetch(`${BACKEND_URL}/api/budgets/codes`, {
      cache: "no-store",
    }).catch(() => null),
  ]);

  if (!billRes || !billRes.ok) {
    notFound();
  }

  const bill = await billRes.json();
  const departments = deptRes && deptRes.ok ? await deptRes.json() : [];
  const services = servicesRes && servicesRes.ok ? await servicesRes.json() : [];
  const budgetCodes = codesRes && codesRes.ok ? await codesRes.json() : [];

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">
          อัพเดทรายการค่าใช้จ่าย
        </h2>
      </div>
      <EditBillForm
        departments={departments}
        services={services}
        budgetCodes={budgetCodes}
        initialData={bill}
      />
    </div>
  );
}
