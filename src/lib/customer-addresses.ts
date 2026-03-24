export type CustomerAddressRecord = {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};