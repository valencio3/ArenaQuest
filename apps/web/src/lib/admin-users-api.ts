import type { Entities } from '@arenaquest/shared/types/entities';
import type { RoleName } from '@arenaquest/shared/constants/roles';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export type CreateUserInput = {
  name: string;
  email: string;
  password: string;
  roles?: RoleName[];
};

export type UpdateUserInput = {
  name?: string;
  roles?: RoleName[];
  status?: Entities.Config.UserStatus;
};

async function apiFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

export const adminUsersApi = {
  async list(
    token: string,
    page = 1,
    pageSize = 20,
  ): Promise<{ data: Entities.Identity.User[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const res = await apiFetch(
      `/admin/users?limit=${pageSize}&offset=${offset}`,
      token,
    );
    if (!res.ok) throw new Error(`Failed to list users (${res.status})`);
    return res.json();
  },

  async create(token: string, data: CreateUserInput): Promise<Entities.Identity.User> {
    const res = await apiFetch('/admin/users', token, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to create user (${res.status})`);
    }
    return res.json();
  },

  async update(
    token: string,
    id: string,
    data: Partial<UpdateUserInput>,
  ): Promise<Entities.Identity.User> {
    const res = await apiFetch(`/admin/users/${id}`, token, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `Failed to update user (${res.status})`);
    }
    return res.json();
  },

  async deactivate(token: string, id: string): Promise<void> {
    const res = await apiFetch(`/admin/users/${id}`, token, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) {
      throw new Error(`Failed to deactivate user (${res.status})`);
    }
  },
};
