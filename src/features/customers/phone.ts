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
