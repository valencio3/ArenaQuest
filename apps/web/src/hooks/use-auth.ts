import type { Entities } from '@arenaquest/shared/types/entities';
import type { RoleName } from '@arenaquest/shared/constants/roles';
import { useAuthContext, type AuthContextValue } from '@web/context/auth-context';

/** Full auth context: user, token, loading state, login/logout actions. */
export function useAuth(): AuthContextValue {
  return useAuthContext();
}

/** Convenience hook — returns only the current user (or null when unauthenticated). */
export function useCurrentUser(): Entities.Identity.User | null {
  return useAuthContext().user;
}

/** Returns true when the authenticated user has at least one of the specified roles. */
export function useHasRole(...roles: RoleName[]): boolean {
  const user = useAuthContext().user;
  if (!user) return false;
  return roles.some((role) => user.roles.some((r) => r.name === role));
}
