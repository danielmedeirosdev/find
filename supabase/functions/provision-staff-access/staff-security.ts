export const MANAGED_STAFF_FLAG = "onefind_managed_staff";

export type StaffMetadata = {
  role: "staff";
  barber_id: string;
  shop_id: string;
  staff_name: string;
  onefind_managed_staff: true;
};

export function buildManagedStaffMetadata(
  shopId: string,
  barberId: string,
  staffName: string,
): StaffMetadata {
  return {
    role: "staff",
    barber_id: barberId,
    shop_id: shopId,
    staff_name: staffName,
    onefind_managed_staff: true,
  };
}

export function isManagedStaffAccount(
  appMetadata: Record<string, unknown> | null | undefined,
  shopId: string,
  barberId: string,
): boolean {
  return appMetadata?.[MANAGED_STAFF_FLAG] === true &&
    appMetadata.shop_id === shopId &&
    appMetadata.barber_id === barberId &&
    appMetadata.role === "staff";
}

export function isShopOwner(actorUserId: string, ownerUserId: string): boolean {
  return actorUserId === ownerUserId;
}

export function isDuplicateEmailError(message: string | undefined | null): boolean {
  if (!message) return false;
  return /already\s+(been\s+)?registered|already\s+exists|email.?exists|duplicate|user_already_exists/i
    .test(message);
}
