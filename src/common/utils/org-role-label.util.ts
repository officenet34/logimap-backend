import { OrganizationMemberRole, RegistrationAccountType } from '@prisma/client';

/** Hesabım / profil — görünen rol etiketi. */
export function profileRoleLabel(
  registrationType: RegistrationAccountType,
  orgMemberRole: OrganizationMemberRole | null | undefined,
): string {
  if (
    (registrationType === RegistrationAccountType.sole_proprietor ||
      registrationType === RegistrationAccountType.company) &&
    orgMemberRole === OrganizationMemberRole.owner
  ) {
    return 'Yönetici';
  }
  if (orgMemberRole === OrganizationMemberRole.manager) {
    return 'Personel';
  }
  if (orgMemberRole === OrganizationMemberRole.driver) {
    return 'Şoför';
  }
  if (registrationType === RegistrationAccountType.driver) {
    return 'Şoför';
  }
  if (
    registrationType === RegistrationAccountType.sole_proprietor ||
    registrationType === RegistrationAccountType.company
  ) {
    return 'Yönetici';
  }
  return 'Şoför';
}

export function memberRoleDisplayLabel(role: OrganizationMemberRole): string {
  switch (role) {
    case OrganizationMemberRole.owner:
      return 'Yönetici';
    case OrganizationMemberRole.manager:
      return 'Personel';
    case OrganizationMemberRole.driver:
      return 'Şoför';
    default:
      return role;
  }
}
