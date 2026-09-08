import type { AdminRole } from "./types";

export interface AdminLoginBody {
  email: string;
  password: string;
  totp_code?: string;
  recovery_code?: string;
}

export interface AdminInvitationBody {
  email: string;
  roles: AdminRole[];
}

export interface AdminAcceptInvitationBody {
  password: string;
}
