import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type NormalizedCustomerPhone = {
  countryCode: CountryCode;
  displayPhone: string;
  e164: string;
};

function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";
  return /^[A-Z]{2}$/.test(normalized) ? (normalized as CountryCode) : undefined;
}

export function normalizeCustomerPhone(
  value: string | null | undefined,
  defaultCountryCode?: string | null,
): NormalizedCustomerPhone | null {
  const input = value?.trim() ?? "";

  if (!input) {
    return null;
  }

  const countryCode = normalizeCountryCode(defaultCountryCode);
  const explicitInternational = input.startsWith("+")
    ? input
    : input.startsWith("00")
      ? `+${input.slice(2)}`
      : null;

  // A supplied non-Indian country is authoritative. Without this branch,
  // valid national numbers beginning 6-9 can be mistaken for Indian mobiles.
  if (!explicitInternational && countryCode && countryCode !== "IN") {
    const parsedNational = parsePhoneNumberFromString(input, countryCode);
    if (!parsedNational?.isValid() || !parsedNational.country) return null;
    return {
      countryCode: parsedNational.country,
      displayPhone: parsedNational.number,
      e164: parsedNational.number,
    };
  }

  const indianMobile = normalizeIndianMobile(input);
  if (indianMobile) {
    return {
      countryCode: "IN",
      displayPhone: indianMobile,
      e164: `+91${indianMobile}`,
    };
  }

  if (!explicitInternational && !countryCode) {
    return null;
  }

  const parsed = parsePhoneNumberFromString(
    explicitInternational ?? input,
    explicitInternational ? undefined : countryCode,
  );

  if (!parsed?.isValid() || !parsed.country) {
    return null;
  }

  return {
    countryCode: parsed.country,
    displayPhone: parsed.country === "IN" ? parsed.nationalNumber : parsed.number,
    e164: parsed.number,
  };
}

export function normalizeIndianMobile(
  value: string | null | undefined,
): string | null {
  const input = value?.trim() ?? "";

  if (!input) {
    return null;
  }

  const digits = input.replace(/\D/g, "");
  let mobile: string | null = null;

  if (/^\d{10}$/.test(digits)) {
    mobile = digits;
  } else if (/^0\d{10}$/.test(digits) && input.startsWith("0")) {
    mobile = digits.slice(1);
  } else if (/^91\d{10}$/.test(digits) && input.startsWith("+91")) {
    mobile = digits.slice(2);
  } else if (/^0091\d{10}$/.test(digits) && input.startsWith("0091")) {
    mobile = digits.slice(4);
  }

  return mobile && /^[6-9]\d{9}$/.test(mobile) ? mobile : null;
}
