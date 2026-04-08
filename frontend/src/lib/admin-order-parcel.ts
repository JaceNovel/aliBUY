export type AdminOrderParcelPhoto = {
  id: string;
  url: string;
  label?: string;
  source: "manual" | "proof" | "source";
  createdAt?: string;
};

export type AdminOrderParcelItem = {
  slug: string;
  title: string;
  quantity: number;
  selectionLabel?: string;
  image: string;
  gallery: string[];
  sourceProductId?: string;
  sourceUrl?: string;
  supplierName?: string;
  supplierLocation?: string;
  packaging?: string;
  itemWeightGrams?: number;
  overview: string[];
  specs: Array<{ label: string; value: string }>;
};

export type AdminOrderParcelRouting = {
  routeLabel: string;
  destinationLabel: string;
  pickupLabel: string;
  pickupAddress?: string;
  pickupReadyAt?: string;
  clientAddressLines: string[];
};

export type AdminOrderParcelSnapshot = {
  parcelHref: string;
  printHref: string;
  totalItems: number;
  totalUnits: number;
  supplierNames: string[];
  manualNote?: string;
  manualPhotos: AdminOrderParcelPhoto[];
  proofMedia: string[];
  primaryGallery: string[];
  photoEntries: AdminOrderParcelPhoto[];
  sourceLinks: string[];
  routing: AdminOrderParcelRouting;
  items: AdminOrderParcelItem[];
};