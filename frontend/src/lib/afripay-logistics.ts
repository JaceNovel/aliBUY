export const AFRIPAY_COMPANY_NAME = "AfriPay Sourcing";
export const AFRIPAY_COMPANY_ADDRESS = "5 avenue de l'Europe, 69500 Bron, Lyon, France";
export const AFRIPAY_COMPANY_PHONE = "+33 6 88 63 92 94";
export const AFRIPAY_COMPANY_EMAIL = "contact@afripay.space";
export const AFRIPAY_COMPANY_ROLE = "Entreprise emettrice et coordination logistique";
export const AFRIPAY_DEFAULT_COURIER_NAME = "Service logistique AfriPay";
export const AFRIPAY_DEFAULT_COURIER_CHECKPOINT = "Remise client / dernier kilometre";

export function getAfripayCourierFallbackName(input?: string | null) {
  const value = input?.trim();
  return value || AFRIPAY_DEFAULT_COURIER_NAME;
}

export function getAfripayCourierFallbackPhone(input?: string | null) {
  const value = input?.trim();
  return value || AFRIPAY_COMPANY_PHONE;
}