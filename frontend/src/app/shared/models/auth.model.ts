export interface LoginRequest {
  identifier: string;
  password: string;
}

export interface LoginResponse {
  ok?: boolean;
  token: string;
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
