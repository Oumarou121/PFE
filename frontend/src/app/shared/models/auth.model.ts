export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  ok?: boolean;
  token: string;
  email?: string;
  name?: string;
  role?: string;
  expiresAt?: string;
  user?: AuthUser;
  redirectTo?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId?: string | null;
  role: 'supAdmin' | 'admin' | 'user' | string;
  profile?: string;
}
