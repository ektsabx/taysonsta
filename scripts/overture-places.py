# Overture Maps places → one CSV per country for Yolias Admin → Data import.
# Owner request 2026-10-21. Reads only the region's rows straight from
# Overture's public bucket (no account), keeps open places with confidence
# >= 0.5 and a website, email or phone, and names the columns the importer
# recognises. Licence: CDLA Permissive 2.0 (rows that came from Foursquare are
# Apache 2.0, from AllThePlaces CC0); attribution "© Overture Maps Foundation".
#   python3 -m venv /tmp/duck && /tmp/duck/bin/pip install duckdb
#   /tmp/duck/bin/python scripts/overture-places.py 2026-09-23.1 ~/Desktop/taysonsta-data/overture
# Releases: https://docs.overturemaps.org/release/latest/
import duckdb, os, sys

release, outdir = sys.argv[1], os.path.expanduser(sys.argv[2])
COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM"]
os.makedirs(outdir, exist_ok=True)
c = duckdb.connect()
c.execute("install httpfs; load httpfs; set s3_region='us-west-2';")
region = f"{outdir}/region.parquet"
c.execute(f"""
copy (
  select id, names.primary as name, basic_category as category, taxonomy.primary as taxonomy, confidence, operating_status,
         websites, emails, phones, addresses, list_transform(sources, s -> s.dataset) as datasets
  from read_parquet('s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*', hive_partitioning=1)
  where bbox.xmin between 24 and 60 and bbox.ymin between 12 and 32.5
    and addresses[1].country in ({", ".join(f"'{x}'" for x in COUNTRIES)})
) to '{region}' (format parquet)""")
for cc in COUNTRIES:
    path = f"{outdir}/overture-places-{cc}-{release}.csv"
    c.execute(f"""
copy (
  select id as "external id", name as "company name", websites[1] as website, emails[1] as email, phones[1] as phone,
    addresses[1].country as country, addresses[1].locality as city, addresses[1].freeform as address,
    replace(coalesce(category, taxonomy), '_', ' ') as category, round(confidence, 2) as confidence,
    array_to_string(list_distinct(datasets), ' ') as sources
  from '{region}'
  where addresses[1].country = '{cc}' and coalesce(operating_status, 'open') = 'open' and confidence >= 0.5 and name is not null
    and (len(websites) > 0 or len(emails) > 0 or len(phones) > 0)
  order by confidence desc
) to '{path}' (header, delimiter ',')""")
    n, w, e, p = c.execute(f"select count(*), count(website), count(email), count(phone) from read_csv('{path}')").fetchone()
    print(cc, n, "rows,", w, "website,", e, "email,", p, "phone")
os.remove(region)
