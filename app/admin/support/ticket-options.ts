// Ticket priorities and categories, shared by server pages and the client
// controls. Kept out of SupportControls ("use client"): a server component
// that imports plain values from a client module gets a reference, not the
// array (".map is not a function" on the tickets page).
type Opt = { value: string; label: string };

export const priorities: Opt[] = [
  { value: "low", label: "منخفضة" },
  { value: "medium", label: "متوسطة" },
  { value: "high", label: "عالية" },
  { value: "urgent", label: "عاجلة" },
];
export const ticketCategories: Opt[] = [
  { value: "general", label: "عام" },
  { value: "technical", label: "تقني" },
  { value: "billing", label: "مالي" },
  { value: "access", label: "وصول / حساب" },
  { value: "content", label: "محتوى" },
  { value: "bug", label: "خطأ" },
];
