import { OrganizationMemberRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';

export class InviteMemberDto {
  @IsUUID()
  targetUserId!: string;

  @IsEnum(OrganizationMemberRole)
  inviteRole!: OrganizationMemberRole;

  @IsOptional()
  @IsString()
  message?: string;
}
