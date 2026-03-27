import { canonicalizeCountryCode } from "@/lib/country-utils";

type AddressAutofillInput = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  countryCode?: string;
};

type AddressAutofillOutput = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
};

function normalizeCountryCode(value: string | undefined, fallbackCountryCode: string) {
  return canonicalizeCountryCode(value, fallbackCountryCode);
}

function getExplicitCountryCode(value: string | undefined) {
  const normalizedValue = canonicalizeCountryCode(value);
  return normalizedValue || null;
}

export function parseAddressQuickInput(rawAddress: string, fallbackCountryCode = "CI"): AddressAutofillOutput {
  const normalizedAddress = rawAddress.replace(/\n+/g, ",").trim();
  const segments = normalizedAddress
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const output: AddressAutofillOutput = {
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: fallbackCountryCode,
  };

  if (segments.length === 0) {
    return output;
  }

  const nextSegments = [...segments];
  const detectedCountryCode = getExplicitCountryCode(nextSegments.at(-1));
  if (detectedCountryCode) {
    output.countryCode = detectedCountryCode;
    nextSegments.pop();
  }

  for (let index = nextSegments.length - 1; index >= 0; index -= 1) {
    const segment = nextSegments[index];
    const postalMatch = segment.match(/\b\d{4,6}\b/);
    if (!postalMatch) {
      continue;
    }

    output.postalCode = postalMatch[0];
    const withoutPostalCode = segment.replace(postalMatch[0], "").replace(/\s{2,}/g, " ").replace(/^[\s-]+|[\s-]+$/g, "").trim();
    if (withoutPostalCode) {
      nextSegments[index] = withoutPostalCode;
    } else {
      nextSegments.splice(index, 1);
    }
    break;
  }

  output.addressLine1 = nextSegments[0] ?? normalizedAddress;

  const remainingSegments = nextSegments.slice(1);
  if (remainingSegments.length >= 3) {
    output.addressLine2 = remainingSegments.slice(0, -2).join(", ");
    output.city = remainingSegments.at(-2) ?? "";
    output.state = remainingSegments.at(-1) ?? output.city;
    return output;
  }

  if (remainingSegments.length === 2) {
    output.city = remainingSegments[0];
    output.state = remainingSegments[1];
    return output;
  }

  if (remainingSegments.length === 1) {
    output.city = remainingSegments[0];
    output.state = remainingSegments[0];
    return output;
  }

  output.city = output.city || "";
  output.state = output.state || output.city;
  return output;
}

export function buildAddressQuickInput(input: AddressAutofillInput) {
  const normalizedCountryCode = normalizeCountryCode(input.countryCode, "CI");
  const locationSegments = [input.city?.trim(), input.state?.trim()].filter(Boolean);
  const compactLocation = locationSegments.filter((segment, index) => segment !== locationSegments[index - 1]);

  return [
    input.addressLine1?.trim(),
    input.addressLine2?.trim(),
    compactLocation.join(", "),
    input.postalCode?.trim(),
    normalizedCountryCode,
  ]
    .filter(Boolean)
    .join(", ");
}