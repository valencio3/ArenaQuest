'use client';

import type { ReactNode } from 'react';
import type { RoleName } from '@arenaquest/shared/constants/roles';
import { useHasRole } from '@web/hooks/use-auth';

export function CanView({ role, children }: { role: RoleName; children: ReactNode }) {
  const can = useHasRole(role);
  return can ? <>{children}</> : null;
}
