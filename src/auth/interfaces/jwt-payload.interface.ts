import { RegistrationAccountType } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  registrationType: RegistrationAccountType;
  email?: string | null;
  phone: string;
}
