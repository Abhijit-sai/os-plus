export const defaultCustomerStatuses = [
  { name: "Order confirmed", sort_order: 10, is_final_status: false },
  { name: "Design confirmation", sort_order: 20, is_final_status: false },
  { name: "In production", sort_order: 30, is_final_status: false },
  { name: "Finishing", sort_order: 40, is_final_status: false },
  { name: "Quality check", sort_order: 50, is_final_status: false },
  { name: "Packing", sort_order: 60, is_final_status: false },
  { name: "Ready for pickup", sort_order: 70, is_final_status: false },
  { name: "Ready for dispatch", sort_order: 80, is_final_status: false },
  { name: "Dispatched", sort_order: 90, is_final_status: false },
  { name: "Delivered", sort_order: 100, is_final_status: true }
];

export const defaultItemTypes = ["Shirt", "Pant", "Kurtha", "Blazer"];

export const defaultStages = ["Marking", "Cutting", "Design work", "Stitching", "Finishing", "QC", "Packing"];

export const defaultWorkgroups = ["Master", "Tailor", "Designer", "Finisher", "Packer", "QC"];

export const defaultPaymentModes = ["Cash", "UPI", "Shopify", "Bank Transfer", "Card", "Other"];

export const defaultExpenseCategories = [
  "Raw material",
  "Salary",
  "Marketing",
  "Rent",
  "Travel",
  "Utilities",
  "Packaging",
  "Courier",
  "Maintenance",
  "Miscellaneous"
];
