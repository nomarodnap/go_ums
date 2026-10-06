import { create } from "zustand";

export interface FilterState {
  fiscalYear: number;
  month: number | null;
  utilityType: string;
  searchQuery: string;
  statusFilter: "ALL" | "PAID" | "PENDING";
  departmentId: string | null;

  // Actions
  setFiscalYear: (year: number) => void;
  setMonth: (month: number | null) => void;
  setUtilityType: (type: string) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (status: "ALL" | "PAID" | "PENDING") => void;
  setDepartmentId: (deptId: string | null) => void;
  resetFilters: () => void;
}

const defaultYear = new Date().getFullYear() + 543; // Buddhist Era year

export const useFilterStore = create<FilterState>((set) => ({
  fiscalYear: defaultYear,
  month: null,
  utilityType: "ALL",
  searchQuery: "",
  statusFilter: "ALL",
  departmentId: null,

  setFiscalYear: (year) => set({ fiscalYear: year }),
  setMonth: (month) => set({ month }),
  setUtilityType: (utilityType) => set({ utilityType }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setDepartmentId: (departmentId) => set({ departmentId }),
  resetFilters: () =>
    set({
      fiscalYear: defaultYear,
      month: null,
      utilityType: "ALL",
      searchQuery: "",
      statusFilter: "ALL",
      departmentId: null,
    }),
}));
