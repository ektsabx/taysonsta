import Image from "next/image";
import type { CaseStudyMedia as CaseStudyMediaItem } from "@/services/case-studies";
import { storageUrl } from "@/lib/storage";

export function CaseStudyMedia({ media }: { media: CaseStudyMediaItem[] }) {
  if (media.length === 0) {
    return null;
  }

  return (
    <div className="case-study-media-grid">
      {media.map((item) => (
        <Image key={item.id} src={storageUrl(item.image_url)} alt={item.caption ?? ""} width={440} height={280} />
      ))}
    </div>
  );
}
