"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}>
      Print / Save as PDF
    </button>
  );
}
