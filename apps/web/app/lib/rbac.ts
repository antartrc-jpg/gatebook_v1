// FILE: apps/web/app/lib/rbac.ts
export type Role = "user" | "viewer" | "deputy" | "owner" | "admin" | "superadmin";

export type MeDto = {
  role?: string | null;
  roles?: string[] | null;
  flags?: { superadmin?: boolean; isSuperAdmin?: boolean } | null;
  isSuperAdmin?: boolean | null;
  user?: {
    role?: string | null;
    roles?: string[] | null;
    flags?: { superadmin?: boolean; isSuperAdmin?: boolean } | null;
    isSuperAdmin?: boolean | null;
  } | null;
  permissions?: string[] | null;
};

const VALID_ROLES = new Set<Role>(["user", "viewer", "deputy", "owner", "admin", "superadmin"]);
const norm = (x: unknown) => String(x ?? "").trim().toLowerCase();

function pushRole(set: Set<Role>, value: unknown) {
  const n = norm(value);
  if (VALID_ROLES.has(n as Role)) set.add(n as Role);
}
function pushRoles(set: Set<Role>, values: unknown) {
  if (Array.isArray(values)) {
    for (const v of values) pushRole(set, v);
  } else if (typeof values === "string") {
    // erlaubt "user,admin"
    for (const v of values.split(","))
      pushRole(set, v);
  }
}

export function roleSetFrom(me?: MeDto | null): Set<Role> {
  const s = new Set<Role>();
  if (!me) return s;

  pushRole(s, me.role);
  pushRole(s, me.user?.role);

  pushRoles(s, me.roles ?? []);
  pushRoles(s, me.user?.roles ?? []);

  // Superadmin-Flags vereinheitlichen
  const superFlag =
    !!me.isSuperAdmin ||
    !!me.flags?.superadmin ||
    !!me.flags?.isSuperAdmin ||
    !!me.user?.isSuperAdmin ||
    !!me.user?.flags?.superadmin ||
    !!me.user?.flags?.isSuperAdmin;

  if (superFlag) s.add("superadmin");

  return s;
}

export const has = (roles: Set<Role>, r: Role) => roles.has(r);
export const isSuperAdmin = (roles: Set<Role>) => has(roles, "superadmin");
export const isAdmin = (roles: Set<Role>) => isSuperAdmin(roles) || has(roles, "admin");

/** Wer darf die „User-Rollen vergeben“-Ansicht öffnen? */
export const canEditRoles = (roles: Set<Role>) => isAdmin(roles);

/** Welche Rollen darf der Actor vergeben? (admin nur für superadmin) */
export function assignableRoles(roles: Set<Role>): Role[] {
  const base: Role[] = ["user", "viewer", "deputy", "owner"];
  return isSuperAdmin(roles) ? [...base, "admin"] : base;
}
