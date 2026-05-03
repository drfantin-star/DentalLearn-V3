import type { IntraRole, OrgType } from '@/lib/auth/rbac'

// Mapping org_type → intra_roles autorisés (cf. matrice T1).
// Source de vérité pour la validation côté API et le filtrage du select côté UI.
export const INTRA_ROLES_BY_ORG_TYPE: Record<OrgType, readonly IntraRole[]> = {
  cabinet: ['titulaire', 'collaborateur', 'assistante'],
  hr_entity: ['admin_rh', 'manager', 'praticien_salarie', 'assistante'],
  training_org: ['admin_of', 'formateur_of', 'apprenant_of'],
} as const

export const INTRA_ROLE_LABELS: Record<IntraRole, string> = {
  titulaire: 'Titulaire',
  collaborateur: 'Collaborateur',
  assistante: 'Assistant·e',
  admin_rh: 'Admin RH',
  manager: 'Manager',
  praticien_salarie: 'Praticien salarié',
  admin_of: 'Admin organisme',
  formateur_of: 'Formateur',
  apprenant_of: 'Apprenant',
}

// Rôles considérés comme "admin" d'une org — utilisé pour la garde
// "ne pas révoquer le dernier admin" lors d'un PATCH membership.
export const ADMIN_INTRA_ROLES: readonly IntraRole[] = [
  'titulaire',
  'admin_rh',
  'admin_of',
] as const

export function isIntraRoleValidForOrgType(
  orgType: OrgType,
  intraRole: IntraRole
): boolean {
  return INTRA_ROLES_BY_ORG_TYPE[orgType].includes(intraRole)
}

export function isAdminIntraRole(intraRole: IntraRole): boolean {
  return ADMIN_INTRA_ROLES.includes(intraRole)
}
