// Shown while a Prospects tab loads: the same card grid, so the page never
// flashes another layout.
export default function Loading() {
  return (
    <div className="page-view" aria-busy="true">
      <div className="view-content-padding">
        <ul className="people-grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => <li key={i} className="skeleton-card" />)}
        </ul>
      </div>
    </div>
  );
}
