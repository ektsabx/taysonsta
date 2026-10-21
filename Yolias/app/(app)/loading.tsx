// Shown at once while any app page loads (owner 2026-10-21: a click must
// change the screen right away). The sidebar stays; only the page area waits.
export default function Loading() {
  return (
    <div className="page-view" aria-busy="true">
      <header className="view-header">
        <div className="view-title-group">
          <span className="skeleton-line" style={{ width: 180, height: 22 }} />
          <span className="skeleton-line" style={{ width: 320, height: 12, marginTop: 10 }} />
        </div>
      </header>
      <div className="view-content-padding" aria-hidden="true">
        <span className="skeleton-line" style={{ width: "100%", height: 40 }} />
        <span className="skeleton-block" />
      </div>
    </div>
  );
}
