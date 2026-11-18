export interface PermissionItem {
  id: string; // The URL path or action ID e.g. "/bills" or "/bills:review"
  title: string;
  description: string;
  subPermissions?: PermissionItem[];
}

export interface PermissionGroup {
  category: string;
  items: PermissionItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: "แดชบอร์ด (Dashboards)",
    items: [
      {
        id: "/dashboard",
        title: "แดชบอร์ดหน่วยงาน",
        description: "ดูข้อมูลสรุปค่าใช้จ่ายและกราฟแนวโน้มของหน่วยงานตนเอง",
      },
      {
        id: "/overview",
        title: "แดชบอร์ดภาพรวม",
        description: "ดูภาพรวมค่าใช้จ่ายทั้งกรมประมง 292 หน่วยงาน",
      },
      {
        id: "/all-ai",
        title: "ผู้ช่วย AI ทั้งกรม (292 หน่วยงาน)",
        description: "ปรึกษาและวิเคราะห์ข้อมูลค่าสาธารณูปโภคภาพรวมทั้ง 292 หน่วยงานด้วย AI",
      },
    ],
  },
  {
    category: "การแจ้งเตือน (Notifications)",
    items: [
      {
        id: "/notifications",
        title: "การแจ้งเตือนหน่วยงาน",
        description: "รายการแจ้งเตือนบิลและสถานะของหน่วยงานตนเอง",
      },
      {
        id: "/all-notifications",
        title: "การแจ้งเตือนทุกหน่วยงาน",
        description: "รายการแจ้งเตือนของทุกหน่วยงานในระบบ",
      },
    ],
  },
  {
    category: "ค่าสาธารณูปโภค (Utility Bills & Services)",
    items: [
      {
        id: "/bills",
        title: "รายการค่าใช้จ่าย",
        description: "ดูและบันทึกบิลค่าสาธารณูปโภคของหน่วยงานตนเอง",
        subPermissions: [
          {
            id: "/bills:review",
            title: "ตรวจสอบแล้ว",
            description: "สิทธิ์กดตรวจรับรองบิลในหน้ารายการค่าใช้จ่ายของหน่วยงานตนเอง",
          },
          {
            id: "/bills:flag",
            title: "ระบุว่าผิดปกติ",
            description: "สิทธิ์กดปักธงความผิดปกติในหน้ารายการค่าใช้จ่ายของหน่วยงานตนเอง",
          },
        ],
      },
      {
        id: "/all-bills",
        title: "รายการค่าใช้จ่ายทั้งหมด",
        description: "ดูและจัดการบิลค่าสาธารณูปโภคของทุกหน่วยงานในระบบ",
        subPermissions: [
          {
            id: "/all-bills:review",
            title: "ตรวจสอบแล้ว",
            description: "สิทธิ์กดตรวจรับรองบิลในหน้ารายการค่าใช้จ่ายทั้งหมด",
          },
          {
            id: "/all-bills:flag",
            title: "ระบุว่าผิดปกติ",
            description: "สิทธิ์กดปักธงความผิดปกติในหน้ารายการค่าใช้จ่ายทั้งหมด",
          },
        ],
      },
      {
        id: "/services",
        title: "รหัสเครื่องวัด / หมายเลขผู้ใช้",
        description: "จัดการหมายเลขมิเตอร์และผู้ใช้บริการสาธารณูปโภคของหน่วยงานตนเอง",
      },
      {
        id: "/service-tracking",
        title: "สถานะการดำเนินงานตามรหัสเครื่องวัด",
        description: "ติดตามขั้นตอนการลงบิลและการเบิกจ่ายของแต่ละรหัสเครื่องวัด/หมายเลขผู้ใช้",
      },
      {
        id: "/all-services",
        title: "รหัสเครื่องวัดทั้งหมด",
        description: "ดูและจัดการหมายเลขมิเตอร์และผู้ใช้บริการของทุกหน่วยงานในระบบ",
      },
      {
        id: "/bill-tracking",
        title: "ติดตามความคืบหน้า",
        description: "ติดตามสถานะการส่งเอกสารและการเบิกจ่ายบิล",
      },
      {
        id: "/archived-bills",
        title: "บิลที่เก็บถาวร (Archived)",
        description: "ดูรายการบิลที่ถูกย้ายมาเก็บถาวร กู้คืน ลบถาวร และตรวจสอบประวัติการลบ",
      },
    ],
  },
  {
    category: "ศูนย์รวมรายงาน (Reports)",
    items: [
      {
        id: "/reports",
        title: "ศูนย์รวมรายงาน",
        description: "เข้าถึงหน้ารวมรายงานและส่งออกข้อมูล Excel / PDF",
      },
      {
        id: "/reports/budget",
        title: "รายงานการใช้งบประมาณ",
        description: "สรุปการเบิกจ่ายตามแหล่งเงินและรหัสงบประมาณ",
      },
      {
        id: "/reports/utility",
        title: "รายงานแยกประเภทสาธารณูปโภค",
        description: "สรุปค่าไฟฟ้า ค่าน้ำ โทรศัพท์ และการสื่อสาร",
      },
      {
        id: "/reports/pending",
        title: "รายงานค้างจ่าย",
        description: "สรุปรายการที่ยังไม่ได้รับใบแจ้งหนี้หรือยังไม่เบิกจ่าย",
      },
    ],
  },
  {
    category: "การจัดการและระบบ (Management & Settings)",
    items: [
      {
        id: "/departments",
        title: "จัดการหน่วยงานและผู้ใช้",
        description: "จัดการข้อมูล 292 หน่วยงานและบัญชีผู้ใช้งาน",
      },
      {
        id: "/line-chat",
        title: "สนทนา LINE OA",
        description: "ดูประวัติการสนทนา LINE OA และสลับโหมดตอบด้วยคนหรือ AI",
      },
      {
        id: "/settings",
        title: "ตั้งค่าระบบ",
        description: "จัดการรหัสงบประมาณและกำหนดสิทธิ์การใช้งาน (RBAC)",
      },
      {
        id: "/audits",
        title: "ตรวจสอบความผิดปกติ",
        description: "ตรวจจับและจัดการรายการบิลที่ผิดปกติ",
      },
    ],
  },
];

export const ALL_PERMISSION_IDS: string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.items.flatMap((item) => [
    item.id,
    ...(item.subPermissions ? item.subPermissions.map((s) => s.id) : []),
  ]),
);

/**
 * Checks if a user has access to a specific page route.
 */
export function hasPageAccess(
  user: { role?: string; permissions?: string[] | null } | null | undefined,
  path: string,
): boolean {
  if (!user) return false;

  // Admin or wildcard has full access to everything
  if (user.role === "admin") return true;
  if (user.permissions?.includes("*")) return true;

  const userPerms = user.permissions || [];
  if (userPerms.length === 0) return false;

  // Exact match
  if (userPerms.includes(path)) return true;

  // Sub-path access: if user has "/bills", they can access "/bills/new", "/bills/123/edit"
  if (path.startsWith("/bills/") && userPerms.includes("/bills")) {
    return true;
  }

  // Reports sub-paths: if user has any specific report or "/reports"
  if (path.startsWith("/reports/") && userPerms.includes("/reports")) {
    return true;
  }

  // Fallback for /service-tracking: if user has /services or /dashboard
  if (
    path === "/service-tracking" &&
    (userPerms.includes("/services") || userPerms.includes("/dashboard"))
  ) {
    return true;
  }

  // Fallback for /all-ai: central staff and auditors
  if (
    path === "/all-ai" &&
    ["admin", "central_staff", "auditor", "strategy_finance"].includes(user.role || "")
  ) {
    return true;
  }

  // Fallback for /archived-bills: staff roles with bill archive/audit access
  if (
    path === "/archived-bills" &&
    ["admin", "central_staff", "regional_staff", "auditor", "strategy_finance"].includes(
      user.role || "",
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Gets the readable title for a permission route path or action ID.
 */
export function getPermissionTitle(id: string): string {
  for (const group of PERMISSION_GROUPS) {
    for (const item of group.items) {
      if (item.id === id) return item.title;
      if (item.subPermissions) {
        const sub = item.subPermissions.find((s) => s.id === id);
        if (sub) return `${item.title} → ${sub.title}`;
      }
    }
  }
  if (id === "*") return "ทุกหน้าในระบบ (สิทธิ์สูงสุด)";
  return id;
}

/**
 * Checks if user has permission to review bills on a given page (/bills or /all-bills).
 */
export function canReviewBills(
  user: { role?: string; permissions?: string[] | null } | null | undefined,
  pagePath: string = "/bills",
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions?.includes("*")) return true;

  const perms = user.permissions || [];
  const requiredSubPerm = pagePath.startsWith("/all-bills")
    ? "/all-bills:review"
    : "/bills:review";

  if (perms.includes(requiredSubPerm)) return true;

  // Fallback for legacy roles before subset permissions are assigned:
  // If role is authorized in backend and has access to the page, permit review
  const legacyAllowed = ["auditor", "strategy_finance", "central_staff"];
  if (legacyAllowed.includes(user.role || "")) {
    const parentPage = pagePath.startsWith("/all-bills") ? "/all-bills" : "/bills";
    if (perms.includes(parentPage) && !perms.some((p) => p.endsWith(":review"))) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if user has permission to flag manual anomalies on a given page (/bills or /all-bills).
 */
export function canFlagAnomaly(
  user: { role?: string; permissions?: string[] | null } | null | undefined,
  pagePath: string = "/bills",
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.permissions?.includes("*")) return true;

  const perms = user.permissions || [];
  const requiredSubPerm = pagePath.startsWith("/all-bills")
    ? "/all-bills:flag"
    : "/bills:flag";

  if (perms.includes(requiredSubPerm)) return true;

  // Fallback for legacy auditor role before subset permissions are assigned
  if (user.role === "auditor") {
    const parentPage = pagePath.startsWith("/all-bills") ? "/all-bills" : "/bills";
    if (perms.includes(parentPage) && !perms.some((p) => p.endsWith(":flag"))) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the default landing page for a user based on role defaultPath or permitted pages.
 */
export function getUserLandingPage(
  user: { role?: string; permissions?: string[] | null; defaultPath?: string | null } | null | undefined,
): string {
  if (!user) return "/sign-in";

  // 1. If role has a specified defaultPath and user has access to it
  if (user.defaultPath && hasPageAccess(user, user.defaultPath)) {
    return user.defaultPath;
  }

  // 2. If user is admin, default to /dashboard
  if (user.role === "admin") {
    return user.defaultPath || "/dashboard";
  }

  // 3. Fallback: check priority routes
  const priorityRoutes = [
    "/dashboard",
    "/overview",
    "/bills",
    "/all-bills",
    "/services",
    "/service-tracking",
    "/bill-tracking",
    "/reports",
    "/departments",
    "/settings",
    "/audits",
    "/notifications",
  ];

  for (const path of priorityRoutes) {
    if (hasPageAccess(user, path)) {
      return path;
    }
  }

  // 4. Any permitted page (exclude action sub-permissions)
  const perms = user.permissions || [];
  const firstPerm = perms.find((p) => p !== "*" && p.startsWith("/") && !p.includes(":"));
  if (firstPerm) {
    return firstPerm;
  }

  return "/unauthorized";
}
