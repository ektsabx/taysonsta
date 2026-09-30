import Link from "next/link";
import { defaultLocale, localizedPath } from "@/lib/i18n";
import { getDictionary } from "@/content/dictionaries";

export default function NotFound() {
  const dictionary = getDictionary(defaultLocale);

  return (
    <section className="notfound-section">
      <div className="notfound-inner">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">{dictionary.common.notFoundTitle}</h1>
        <p className="notfound-sub">{dictionary.common.notFoundDesc}</p>
        <Link className="btn-home" href={localizedPath(defaultLocale, "/")}>
          {dictionary.common.backHome}
        </Link>
      </div>
    </section>
  );
}
