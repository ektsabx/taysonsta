# Data sources registry (2026-10-21, D-248, D-251)

Free sources for companies and local businesses, checked against their published terms. "Integrated" means it is wired into Yolias Admin → Data import → Open sources (each pull becomes a dataset with its licence, goes through the same cleaning, matching, report and delete-by-source) and its customer-facing rows are searched by the `yolias_datasets` provider before any paid source.

Categories: **1** free for this use, no paid plan; **2** free with technical limits; **3** free download with licence conditions (attribution / share-alike); **4** free to browse only, no commercial reuse; **5** trial or limited free tier (not a free source).

| Source | Data | Coverage | Access | Key | Limits | Licence and terms | Cat. | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [OpenStreetMap / Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API) | Businesses on the map: name, category, address, phone, website, email | World; thin for B2B offices in Egypt (154 Cairo offices with a contact) | API (Overpass QL) | No | Public servers are shared; busy servers answer 429/502/504, back off. Mirrors used: overpass-api.de, maps.mail.ru, overpass.private.coffee | [ODbL 1.0](https://www.openstreetmap.org/copyright): attribution "© OpenStreetMap contributors"; a derived database stays ODbL | 3 | Integrated, with backoff and mirrors |
| [Geofabrik extracts](https://download.geofabrik.de/) | Full OSM data per country (PBF) | World | Download | No | Daily files; processing needs a PBF reader (not in the Worker) | ODbL 1.0 | 3 | Not integrated: same data as Overpass, needs an offline converter to CSV |
| [Wikidata SPARQL](https://query.wikidata.org/) | Known companies: name, official website, industry, HQ city, employees | World; 1,076 companies with a website in Egypt, 569 in Saudi Arabia, 107 in Kuwait (counted 2026-10-21) | API (SPARQL) | No | 60 s per query, fair use; send a User-Agent | [CC0 1.0](https://www.wikidata.org/wiki/Wikidata:Licensing): no conditions | 1 | Integrated |
| [GLEIF LEI API](https://www.gleif.org/en/lei-data/gleif-api) | Legal entities with an LEI: legal name, address, city, status | World; 335 active in Egypt, 5,961 in Saudi Arabia, 9,447 in the UAE, 225 in Kuwait | API (JSON:API) | No | 60 requests a minute | [CC0 1.0](https://www.gleif.org/en/meta/lei-data-terms-of-use) | 1 | Integrated (no websites: matching and legal names) |
| [France Sirene, API Recherche d'entreprises](https://recherche-entreprises.api.gouv.fr/docs/) | Every active French company: legal name, SIREN, address, NAF activity, headcount band | France | API | No | 7 requests a second | [Licence Ouverte 2.0](https://www.etalab.gouv.fr/licence-ouverte-open-licence/): attribution | 2 | Integrated |
| [UK Companies House](https://developer.company-information.service.gov.uk/) | Active UK companies by SIC and location: name, number, registered address | UK | API | Yes, free | 600 requests per 5 minutes | [Open Government Licence v3](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/): attribution | 2 | Integrated (needs the key in the Integration Hub) |
| [Common Crawl index](https://index.commoncrawl.org/) | Websites seen under a domain suffix (e.g. com.eg) | World | API (CDX) | No | Shared, often overloaded (504 on 2026-10-20/21) | [Terms of use](https://commoncrawl.org/terms-of-use) | 2 | Integrated, not tested live (index down) |
| Yolias crawler | Name, description, email, phone, social profiles a company's own website publishes | Any site | Fetch (home + contact page) | No | One site at a time, 5 s timeout, public sites only | Facts published by the company itself | 1 | Integrated (dataset enrichment) |
| [Foursquare Open Source Places](https://opensource.foursquare.com/os-places/) | 100M+ places: name, category, address, phone, website | World | Parquet download (Hugging Face) | Free account | Very large files | [Apache 2.0](https://www.apache.org/licenses/LICENSE-2.0): keep the notice | 3 | File import (DuckDB export to CSV, steps in Admin) |
| [Overture Maps places](https://docs.overturemaps.org/guides/places/) | Places with categories, websites, phones (Meta / Microsoft / Foursquare data) | World | GeoParquet download (S3 / Azure) | No | Very large files | [CDLA Permissive 2.0](https://cdla.dev/permissive-2-0/) | 3 | File import, same path as Foursquare |
| [OpenCorporates](https://opencorporates.com/plug-in-our-data/) | Company registers of 140+ jurisdictions | World | API | Yes | Free only for open-data / public-benefit projects | Commercial use needs a paid licence | 5 | Not integrated |
| Business directories (Yellow Pages, Kompass, chambers of commerce) | Listings | Varies | Websites | - | Their terms forbid scraping and reuse | All rights reserved | 4 | Not integrated |
| LinkedIn | People and companies | World | - | - | Scraping is forbidden by its terms | All rights reserved | 4 | Not integrated |
| Government open-data portals of Egypt, Saudi Arabia, UAE, Kuwait | Some establishment lists | Varies | Files | - | Not checked dataset by dataset | Licence differs per dataset; verify before import | - | Import as a file after checking the dataset's licence |
| Paid people / email providers (Prospeo, LeadMagic, People Data Labs, MillionVerifier) | People, emails, verification | World | API | Yes | Paid credits; free tiers are trials | Contract | 5 | MillionVerifier adapter ready (key in the Integration Hub); a people provider needs the owner's choice |

## Measured on 2026-10-21 (local database, real pulls for Egypt)

| Pull | Rows | New companies | Matched another source | Duplicates in the file |
| --- | --- | --- | --- | --- |
| Wikidata, Egypt | 377 | 294 | 0 | 83 (same website listed twice) |
| GLEIF, Egypt | 335 | 327 | 8 | 0 |
| OpenStreetMap, Cairo offices with a contact | 180 | 154 | 7 | 19 |

- Egyptian companies in the shared database: 13 before, 788 after.
- Of the 778 companies these pulls brought: 432 (56%) have a website, 448 (58%) have a website, email, phone or LinkedIn page.
- Cross-source matches: 15 of 892 rows (1.7%); in-file duplicates: 102 (11%), all merged.
- Freshness: Wikidata and OpenStreetMap are live (pulled today); GLEIF's golden copy was published 2026-10-20.
- Search over these datasets: about 12 ms in the database, no AI cost. Website discovery (Gemini) still runs when the datasets have nothing for a search.
