import { WORLD_PATHS, WORLD_VIEWBOX } from "@/lib/yolias/world-map";

// A world heat map for Yolias Admin (D-276): each country's color is its
// share of the largest value; the number shows on hover. Server-rendered SVG.
export function GeoMap({ values, label }: { values: Record<string, number>; label: (code: string, v: number) => string }) {
  const max = Math.max(0, ...Object.values(values));
  const level = (v: number | undefined) => (!v || !max ? 0 : Math.max(1, Math.ceil((Math.sqrt(v) / Math.sqrt(max)) * 5)));
  return (
    <div className="yd-map">
      <svg viewBox={WORLD_VIEWBOX} role="img">
        {WORLD_PATHS.map(([code, d]) => {
          const v = values[code];
          return <path key={code} d={d} className={`yd-geo l${level(v)}`}><title>{label(code, v ?? 0)}</title></path>;
        })}
      </svg>
      <div className="yd-map-scale" aria-hidden="true"><span className="l1" /><span className="l2" /><span className="l3" /><span className="l4" /><span className="l5" /></div>
    </div>
  );
}
