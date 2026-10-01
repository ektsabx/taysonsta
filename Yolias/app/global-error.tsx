"use client";

// Last-resort screen when the root layout itself fails (no app styles,
// fonts or language context are available here), shown in both languages.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#fff", color: "#141413" }}>
        <main style={{ maxWidth: 460, padding: 24, textAlign: "center" }}>
          <div style={{ fontWeight: 700, letterSpacing: ".06em" }}>YOLIAS</div>
          <h1 style={{ fontSize: 24, margin: "28px 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#747470", lineHeight: 1.6, margin: 0 }}>An unexpected error stopped Yolias from loading.</p>
          <h1 dir="rtl" lang="ar" style={{ fontSize: 22, margin: "24px 0 8px" }}>حدث خطأ ما</h1>
          <p dir="rtl" lang="ar" style={{ color: "#747470", lineHeight: 1.6, margin: 0 }}>منع خطأ غير متوقع تحميل يولـياس.</p>
          <button type="button" onClick={reset} style={{ marginTop: 28, padding: "10px 18px", border: 0, borderRadius: 8, background: "#cf2525", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again · حاول مرة أخرى
          </button>
        </main>
      </body>
    </html>
  );
}
