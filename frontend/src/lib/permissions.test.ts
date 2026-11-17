import { describe, expect, it } from "vitest";
import { hasPageAccess, getUserLandingPage, getPermissionTitle, ALL_PERMISSION_IDS, PERMISSION_GROUPS } from "./permissions";

describe("Permissions Helper", () => {
  it("should contain all permission groups and items", () => {
    expect(PERMISSION_GROUPS.length).toBeGreaterThan(0);
    expect(ALL_PERMISSION_IDS.length).toBeGreaterThan(0);
    expect(ALL_PERMISSION_IDS).toContain("/dashboard");
    expect(ALL_PERMISSION_IDS).toContain("/bills");
    expect(ALL_PERMISSION_IDS).toContain("/settings");
    expect(ALL_PERMISSION_IDS).toContain("/service-tracking");
  });

  it("should allow /service-tracking if explicitly permitted or user has /services or /dashboard", () => {
    expect(hasPageAccess({ role: "user", permissions: ["/service-tracking"] }, "/service-tracking")).toBe(true);
    expect(hasPageAccess({ role: "user", permissions: ["/services"] }, "/service-tracking")).toBe(true);
    expect(hasPageAccess({ role: "user", permissions: ["/dashboard"] }, "/service-tracking")).toBe(true);
    expect(hasPageAccess({ role: "user", permissions: ["/bills"] }, "/service-tracking")).toBe(false);
  });

  it("should return false for null or undefined user", () => {
    expect(hasPageAccess(null, "/dashboard")).toBe(false);
    expect(hasPageAccess(undefined, "/dashboard")).toBe(false);
  });

  it("should grant full access to admin user regardless of permissions array", () => {
    const adminUser = { role: "admin", permissions: [] };
    expect(hasPageAccess(adminUser, "/dashboard")).toBe(true);
    expect(hasPageAccess(adminUser, "/settings")).toBe(true);
    expect(hasPageAccess(adminUser, "/all-bills")).toBe(true);
  });

  it("should grant full access if user permissions includes wildcard '*'", () => {
    const wildcardUser = { role: "custom_super", permissions: ["*"] };
    expect(hasPageAccess(wildcardUser, "/dashboard")).toBe(true);
    expect(hasPageAccess(wildcardUser, "/settings")).toBe(true);
  });

  it("should grant access only to explicitly permitted pages", () => {
    const normalUser = {
      role: "finance_officer",
      permissions: ["/dashboard", "/bills", "/services"],
    };

    expect(hasPageAccess(normalUser, "/dashboard")).toBe(true);
    expect(hasPageAccess(normalUser, "/bills")).toBe(true);
    expect(hasPageAccess(normalUser, "/services")).toBe(true);

    // Should deny access to pages not in permissions
    expect(hasPageAccess(normalUser, "/settings")).toBe(false);
    expect(hasPageAccess(normalUser, "/departments")).toBe(false);
    expect(hasPageAccess(normalUser, "/all-bills")).toBe(false);
  });

  it("should allow sub-paths when parent path is permitted", () => {
    const billUser = {
      role: "bill_entry",
      permissions: ["/bills"],
    };

    expect(hasPageAccess(billUser, "/bills/new")).toBe(true);
    expect(hasPageAccess(billUser, "/bills/bill-123/edit")).toBe(true);
  });

  it("should allow reports sub-paths when /reports is permitted", () => {
    const reportUser = {
      role: "executive",
      permissions: ["/reports"],
    };

    expect(hasPageAccess(reportUser, "/reports/budget")).toBe(true);
    expect(hasPageAccess(reportUser, "/reports/utility")).toBe(true);
    expect(hasPageAccess(reportUser, "/reports/pending")).toBe(true);
  });

  it("should return configured defaultPath when user has permission for it", () => {
    const user = {
      role: "custom_role",
      permissions: ["/bills", "/services"],
      defaultPath: "/bills",
    };
    expect(getUserLandingPage(user)).toBe("/bills");
  });

  it("should fallback to permitted route if defaultPath is not permitted", () => {
    const user = {
      role: "custom_role",
      permissions: ["/bills", "/services"],
      defaultPath: "/dashboard", // Not in permissions!
    };
    expect(getUserLandingPage(user)).toBe("/bills");
  });

  it("should return /unauthorized if user has no permitted routes", () => {
    const user = {
      role: "empty_role",
      permissions: [],
      defaultPath: "/dashboard",
    };
    expect(getUserLandingPage(user)).toBe("/unauthorized");
  });
});

