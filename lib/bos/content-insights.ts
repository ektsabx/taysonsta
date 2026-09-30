// Content performance analysis (docs/bos/30 §13.4). Pure functions over real
// published-post rows: group by a dimension, average the metrics that exist,
// and flag groups too small to conclude anything from. No values are filled
// in for missing metrics.

export interface PerfRow {
  platform: string;
  contentType: string | null;
  publishedAt: string;             // ISO
  hook: string | null;
  topic: string | null;
  videoLengthSec: number | null;
  reach: number | null;
  engagement: number | null;       // % (engagementRate)
  views: number | null;
}

export type Dimension = "platform" | "content_type" | "weekday" | "hour" | "hook" | "topic" | "video_length";

export const MIN_SAMPLE = 3;

export function hourBucket(iso: string, tz = "Africa/Cairo") {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));
  return h < 6 ? "00–06" : h < 12 ? "06–12" : h < 17 ? "12–17" : h < 21 ? "17–21" : "21–24";
}

export function weekday(iso: string, tz = "Africa/Cairo") {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(iso));
}

export function lengthBucket(sec: number | null) {
  if (sec == null) return null;
  return sec <= 15 ? "≤15s" : sec <= 30 ? "16–30s" : sec <= 60 ? "31–60s" : sec <= 180 ? "1–3m" : ">3m";
}

function key(r: PerfRow, d: Dimension, tz: string): string | null {
  switch (d) {
    case "platform": return r.platform;
    case "content_type": return r.contentType;
    case "weekday": return weekday(r.publishedAt, tz);
    case "hour": return hourBucket(r.publishedAt, tz);
    case "hook": return r.hook == null ? null : r.hook.trim() ? "with_hook" : "no_hook";
    case "topic": return r.topic?.trim().toLowerCase() || null;
    case "video_length": return lengthBucket(r.videoLengthSec);
  }
}

const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

export interface Group { value: string; posts: number; withEngagement: number; avgEngagement: number | null; avgReach: number | null; avgViews: number | null; lowSample: boolean }

export function groupBy(rows: PerfRow[], d: Dimension, tz = "Africa/Cairo"): { groups: Group[]; missing: number } {
  const m = new Map<string, PerfRow[]>();
  let missing = 0;
  for (const r of rows) {
    const k = key(r, d, tz);
    if (k == null) {
      missing++;
      continue;
    }
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  const groups = [...m.entries()].map(([value, rs]) => {
    const eng = rs.map((r) => r.engagement).filter((x): x is number => x != null);
    return {
      value,
      posts: rs.length,
      withEngagement: eng.length,
      avgEngagement: avg(eng),
      avgReach: avg(rs.map((r) => r.reach).filter((x): x is number => x != null)),
      avgViews: avg(rs.map((r) => r.views).filter((x): x is number => x != null)),
      lowSample: eng.length < MIN_SAMPLE,
    };
  });
  groups.sort((a, b) => (b.avgEngagement ?? -1) - (a.avgEngagement ?? -1));
  return { groups, missing };
}

// What the data can't tell us (shown next to the report and sent to the AI).
export function missingData(rows: PerfRow[]) {
  const out: string[] = [];
  const n = rows.length;
  if (!n) return ["no_published_posts"];
  if (rows.filter((r) => r.reach == null).length / n > 0.3) out.push("reach_missing");
  if (rows.filter((r) => r.contentType == null).length / n > 0.3) out.push("not_linked_to_content");
  if (rows.filter((r) => r.hook == null).length / n > 0.3) out.push("hook_unknown");
  if (rows.filter((r) => r.videoLengthSec == null && r.contentType?.includes("video")).length) out.push("video_length_missing");
  out.push("retention_not_collected");
  if (n < 10) out.push("small_sample");
  return out;
}
