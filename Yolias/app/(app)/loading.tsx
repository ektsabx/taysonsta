// Shown the moment a page is clicked, inside the sidebar, while its data arrives
// (owner, 2026-11-05): a click always answers at once. Pages already opened
// come back from the browser with no wait (next.config staleTimes).
export default function Loading() {
  return (
    <div className="sdr-page page-skeleton" aria-busy="true">
      <div className="sk sk-title" />
      <div className="sk sk-sub" />
      <div className="sk-row">{[0, 1, 2, 3].map((i) => <div key={i} className="sk sk-card" />)}</div>
      <div className="sk sk-panel" />
    </div>
  );
}
