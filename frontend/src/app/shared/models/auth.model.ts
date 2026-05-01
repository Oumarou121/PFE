export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  ok?: boolean;
  token: string;
  username?: string;
  role?: string;
  expiresAt?: string;
  user?: AuthUser;
  redirectTo?: string;
}

export interface AuthUser {
  id: string;
  username?: string;
  email: string;
  name: string;
  organizationId?: string | null;
  role: 'supAdmin' | 'admin' | 'user' | string;
  profile?: string;
}
