export interface CountryCode {
  iso: string;
  dialCode: string;
  nameAr: string;
  nameEn: string;
}

export const countryCodes: CountryCode[] = [
  { iso: "EG", dialCode: "+20", nameAr: "مصر", nameEn: "Egypt" },
  { iso: "SA", dialCode: "+966", nameAr: "السعودية", nameEn: "Saudi Arabia" },
  { iso: "AE", dialCode: "+971", nameAr: "الإمارات", nameEn: "United Arab Emirates" },
  { iso: "KW", dialCode: "+965", nameAr: "الكويت", nameEn: "Kuwait" },
  { iso: "QA", dialCode: "+974", nameAr: "قطر", nameEn: "Qatar" },
  { iso: "BH", dialCode: "+973", nameAr: "البحرين", nameEn: "Bahrain" },
  { iso: "OM", dialCode: "+968", nameAr: "عُمان", nameEn: "Oman" },
  { iso: "JO", dialCode: "+962", nameAr: "الأردن", nameEn: "Jordan" },
  { iso: "LB", dialCode: "+961", nameAr: "لبنان", nameEn: "Lebanon" },
  { iso: "IQ", dialCode: "+964", nameAr: "العراق", nameEn: "Iraq" },
  { iso: "PS", dialCode: "+970", nameAr: "فلسطين", nameEn: "Palestine" },
  { iso: "SY", dialCode: "+963", nameAr: "سوريا", nameEn: "Syria" },
  { iso: "YE", dialCode: "+967", nameAr: "اليمن", nameEn: "Yemen" },
  { iso: "MA", dialCode: "+212", nameAr: "المغرب", nameEn: "Morocco" },
  { iso: "DZ", dialCode: "+213", nameAr: "الجزائر", nameEn: "Algeria" },
  { iso: "TN", dialCode: "+216", nameAr: "تونس", nameEn: "Tunisia" },
  { iso: "LY", dialCode: "+218", nameAr: "ليبيا", nameEn: "Libya" },
  { iso: "SD", dialCode: "+249", nameAr: "السودان", nameEn: "Sudan" },
  { iso: "DE", dialCode: "+49", nameAr: "ألمانيا", nameEn: "Germany" },
  { iso: "GB", dialCode: "+44", nameAr: "المملكة المتحدة", nameEn: "United Kingdom" },
  { iso: "FR", dialCode: "+33", nameAr: "فرنسا", nameEn: "France" },
  { iso: "US", dialCode: "+1", nameAr: "الولايات المتحدة", nameEn: "United States" },
  { iso: "CA", dialCode: "+1", nameAr: "كندا", nameEn: "Canada" },
  { iso: "TR", dialCode: "+90", nameAr: "تركيا", nameEn: "Turkey" },
  { iso: "IN", dialCode: "+91", nameAr: "الهند", nameEn: "India" },
  { iso: "PK", dialCode: "+92", nameAr: "باكستان", nameEn: "Pakistan" },
];
