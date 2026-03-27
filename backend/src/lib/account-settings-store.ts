import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export type AccountSettingsRecord = {
  userId: string;
  profilePhotoUrl?: string;
  bio?: string;
  memberRole?: string;
  companyName?: string;
  activitySummary?: string;
  connectedGoogleEmail?: string;
  connectedAppleEmail?: string;
  connectedWhatsapp?: string;
  taxId?: string;
  businessId?: string;
  billingAddress?: string;
  twoFactorEnabled: boolean;
  twoFactorPhone?: string;
  phone?: string;
  smsSecurityAlerts: boolean;
  smsOrderUpdates: boolean;
  smsLogisticsReminders: boolean;
  privacyProfileVisible: boolean;
  privacyActivityVisible: boolean;
  privacyPersonalizedData: boolean;
  emailOrderUpdates: boolean;
  emailMarketing: boolean;
  emailWeeklyDigest: boolean;
  adsPersonalized: boolean;
  adsInterestBased: boolean;
  adsCampaignFrequency: "faible" | "normale" | "elevee";
  updatedAt: string;
};

function resolveCustomerDir() {
  const isServerlessRuntime = Boolean(
    process.env.VERCEL
    || process.env.VERCEL_ENV
    || process.env.VERCEL_URL
    || process.env.AWS_EXECUTION_ENV
    || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );

  if (process.env.NODE_ENV === "production" || isServerlessRuntime) {
    return path.join(os.tmpdir(), "afripay", "data", "customer");
  }

  return path.join(process.cwd(), "data", "customer");
}

const CUSTOMER_DIR = resolveCustomerDir();
const SETTINGS_PATH = path.join(CUSTOMER_DIR, "account-settings.json");

function defaultSettings(userId: string): AccountSettingsRecord {
  return {
    userId,
    twoFactorEnabled: false,
    smsSecurityAlerts: true,
    smsOrderUpdates: true,
    smsLogisticsReminders: true,
    privacyProfileVisible: true,
    privacyActivityVisible: false,
    privacyPersonalizedData: true,
    emailOrderUpdates: true,
    emailMarketing: false,
    emailWeeklyDigest: false,
    adsPersonalized: true,
    adsInterestBased: true,
    adsCampaignFrequency: "normale",
    updatedAt: new Date().toISOString(),
  };
}

async function ensureCustomerDir() {
  await mkdir(CUSTOMER_DIR, { recursive: true });
}

async function readAllSettings() {
  try {
    await ensureCustomerDir();
    const raw = await readFile(SETTINGS_PATH, "utf8");
    return JSON.parse(raw) as AccountSettingsRecord[];
  } catch {
    try {
      await ensureCustomerDir();
      await writeFile(SETTINGS_PATH, "[]\n", "utf8");
    } catch {
      return [] as AccountSettingsRecord[];
    }

    return [] as AccountSettingsRecord[];
  }
}

async function writeAllSettings(records: AccountSettingsRecord[]) {
  try {
    await ensureCustomerDir();
    await writeFile(SETTINGS_PATH, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  } catch {
    // On serverless platforms this storage can be ephemeral or unavailable.
  }
}

export async function getAccountSettings(userId: string) {
  const records = await readAllSettings();
  return records.find((entry) => entry.userId === userId) ?? defaultSettings(userId);
}

export async function updateAccountSettings(userId: string, input: Partial<Omit<AccountSettingsRecord, "userId" | "updatedAt">>) {
  const records = await readAllSettings();
  const current = records.find((entry) => entry.userId === userId) ?? defaultSettings(userId);
  const next: AccountSettingsRecord = {
    ...current,
    ...input,
    userId,
    updatedAt: new Date().toISOString(),
  };

  const nextRecords = records.some((entry) => entry.userId === userId)
    ? records.map((entry) => entry.userId === userId ? next : entry)
    : [...records, next];

  await writeAllSettings(nextRecords);
  return next;
}

export async function deleteAccountSettings(userId: string) {
  const records = await readAllSettings();
  await writeAllSettings(records.filter((entry) => entry.userId !== userId));
}
