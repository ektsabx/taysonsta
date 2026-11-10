import type { PlayableTutorial } from "@/lib/tutorials";

/** The article's walkthrough video, at the top of the article (owner, 2026-11-10). */
export function ArticleVideo({ video }: { video: PlayableTutorial }) {
  return (
    <figure className="article-video">
      <div className="tutorial-frame">
        {video.kind === "iframe"
          ? <iframe src={video.src} title={video.title} allow="fullscreen; picture-in-picture; encrypted-media" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
          : <video src={video.src} controls preload="metadata" />}
      </div>
      {video.description && <figcaption dir="auto">{video.description}</figcaption>}
    </figure>
  );
}
