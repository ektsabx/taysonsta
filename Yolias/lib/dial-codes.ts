// Country calling codes (ITU-T E.164 assignments), for the phone field's
// country picker (owner, 2026-11-03): pick the country, then type the number.
// Countries that share +1 / +7 keep the shared code.

export const DIAL_CODES: Record<string, string> = {
  AF: "93", AL: "355", DZ: "213", AS: "1", AD: "376", AO: "244", AI: "1", AG: "1", AR: "54", AM: "374", AW: "297", AU: "61", AT: "43", AZ: "994",
  BS: "1", BH: "973", BD: "880", BB: "1", BY: "375", BE: "32", BZ: "501", BJ: "229", BM: "1", BT: "975", BO: "591", BA: "387", BW: "267", BR: "55",
  BN: "673", BG: "359", BF: "226", BI: "257", KH: "855", CM: "237", CA: "1", CV: "238", KY: "1", CF: "236", TD: "235", CL: "56", CN: "86", CO: "57",
  KM: "269", CG: "242", CD: "243", CR: "506", CI: "225", HR: "385", CU: "53", CW: "599", CY: "357", CZ: "420", DK: "45", DJ: "253", DM: "1", DO: "1",
  EC: "593", EG: "20", SV: "503", GQ: "240", ER: "291", EE: "372", SZ: "268", ET: "251", FJ: "679", FI: "358", FR: "33", GF: "594", PF: "689", GA: "241",
  GM: "220", GE: "995", DE: "49", GH: "233", GI: "350", GR: "30", GL: "299", GD: "1", GP: "590", GU: "1", GT: "502", GN: "224", GW: "245", GY: "592",
  HT: "509", HN: "504", HK: "852", HU: "36", IS: "354", IN: "91", ID: "62", IR: "98", IQ: "964", IE: "353", IL: "972", IT: "39", JM: "1", JP: "81",
  JO: "962", KZ: "7", KE: "254", KI: "686", KP: "850", KR: "82", XK: "383", KW: "965", KG: "996", LA: "856", LV: "371", LB: "961", LS: "266", LR: "231",
  LY: "218", LI: "423", LT: "370", LU: "352", MO: "853", MG: "261", MW: "265", MY: "60", MV: "960", ML: "223", MT: "356", MH: "692", MQ: "596", MR: "222",
  MU: "230", YT: "262", MX: "52", FM: "691", MD: "373", MC: "377", MN: "976", ME: "382", MS: "1", MA: "212", MZ: "258", MM: "95", NA: "264", NR: "674",
  NP: "977", NL: "31", NC: "687", NZ: "64", NI: "505", NE: "227", NG: "234", MK: "389", NO: "47", OM: "968", PK: "92", PW: "680", PS: "970", PA: "507",
  PG: "675", PY: "595", PE: "51", PH: "63", PL: "48", PT: "351", PR: "1", QA: "974", RE: "262", RO: "40", RU: "7", RW: "250", KN: "1", LC: "1",
  VC: "1", WS: "685", SM: "378", ST: "239", SA: "966", SN: "221", RS: "381", SC: "248", SL: "232", SG: "65", SX: "1", SK: "421", SI: "386", SB: "677",
  SO: "252", ZA: "27", SS: "211", ES: "34", LK: "94", SD: "249", SR: "597", SE: "46", CH: "41", SY: "963", TW: "886", TJ: "992", TZ: "255", TH: "66",
  TL: "670", TG: "228", TO: "676", TT: "1", TN: "216", TR: "90", TM: "993", TC: "1", TV: "688", UG: "256", UA: "380", AE: "971", GB: "44", US: "1",
  UY: "598", UZ: "998", VU: "678", VA: "39", VE: "58", VN: "84", VG: "1", VI: "1", YE: "967", ZM: "260", ZW: "263",
};

/** "+201001234567" → { country: "EG", national: "1001234567" } (the longest matching code; +1 → US, +7 → RU unless a hint says otherwise). */
export function splitPhone(e164: string | null | undefined, hint?: string | null): { country: string | null; national: string } {
  const v = (e164 ?? "").replace(/^\+/, "");
  if (!v) return { country: hint && DIAL_CODES[hint] ? hint : null, national: "" };
  if (hint && DIAL_CODES[hint] && v.startsWith(DIAL_CODES[hint])) return { country: hint, national: v.slice(DIAL_CODES[hint].length) };
  for (const len of [3, 2, 1]) {
    const code = v.slice(0, len);
    const preferred = code === "1" ? "US" : code === "7" ? "RU" : code === "44" ? "GB" : code === "39" ? "IT" : code === "262" ? "RE" : null;
    const country = preferred ?? Object.keys(DIAL_CODES).find((c) => DIAL_CODES[c] === code);
    if (country) return { country, national: v.slice(len) };
  }
  return { country: null, national: v };
}

/** The country's code and the typed number as one international number; a leading 0 of the national number is dropped. */
export function joinPhone(country: string | null, national: string): string {
  const digits = national
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[^\d+]/g, "");
  if (!digits) return "";
  if (digits.startsWith("+") || digits.startsWith("00") || !country || !DIAL_CODES[country]) return digits;
  return `+${DIAL_CODES[country]}${digits.replace(/^0+/, "")}`;
}
