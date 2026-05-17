import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
  RegistrationAccountType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/utils/phone.util';
import { InviteDriverDto } from './dto/invite-driver.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    return this.prisma.organizationMember.findMany({
      where: { userId, status: InvitationStatus.accepted },
      include: {
        organization: {
          include: {
            sectors: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDriversOnMap(userId: string, organizationId: string) {
    await this.assertOrgManager(userId, organizationId);

    return this.prisma.$queryRaw<
      Array<{
        user_id: string;
        first_name: string;
        last_name: string;
        phone: string;
        profile_image_url: string | null;
        latitude: number | null;
        longitude: number | null;
        last_location_at: Date | null;
      }>
    >`
      SELECT * FROM public.v_organization_drivers
      WHERE organization_id = ${organizationId}::uuid
    `;
  }

  async inviteDriver(userId: string, organizationId: string, dto: InviteDriverDto) {
    await this.assertOrgManager(userId, organizationId);

    if (!dto.targetPhone && !dto.targetEmail) {
      throw new BadRequestException('Telefon veya e-posta gerekli');
    }

    let targetPhone: string | undefined;
    if (dto.targetPhone) {
      targetPhone = normalizePhone(dto.targetPhone);
    }

    let targetUserId: string | undefined;
    if (targetPhone || dto.targetEmail) {
      const target = await this.prisma.user.findFirst({
        where: {
          OR: [
            targetPhone ? { phone: targetPhone } : undefined,
            dto.targetEmail ? { email: dto.targetEmail.toLowerCase() } : undefined,
          ].filter(Boolean) as object[],
        },
      });
      if (target && target.registrationType !== RegistrationAccountType.driver) {
        throw new BadRequestException('Davet yalnızca şoför hesabına gönderilebilir');
      }
      targetUserId = target?.id;
    }

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId,
        invitedByUserId: userId,
        inviteRole: OrganizationMemberRole.driver,
        targetUserId,
        targetPhone,
        targetEmail: dto.targetEmail?.toLowerCase(),
        message: dto.message,
        status: InvitationStatus.pending,
      },
    });

    return {
      success: true,
      invitation: {
        id: invitation.id,
        inviteCode: invitation.inviteCode,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  async addSelfAsDriver(userId: string, organizationId: string) {
    await this.assertOrgManager(userId, organizationId);

    const existing = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        memberRole: OrganizationMemberRole.driver,
      },
    });
    if (existing) {
      return { success: true, message: 'Zaten şoför olarak kayıtlı' };
    }

    await this.prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        memberRole: OrganizationMemberRole.driver,
        status: InvitationStatus.accepted,
        isSelfDriver: true,
        joinedAt: new Date(),
      },
    });

    return { success: true };
  }

  async setActiveOrganization(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId,
        organizationId,
        status: InvitationStatus.accepted,
      },
    });
    if (!member) throw new ForbiddenException('Bu işletmeye erişiminiz yok');

    await this.prisma.userActiveOrganization.upsert({
      where: { userId },
      create: { userId, organizationId },
      update: { organizationId },
    });

    return { success: true, organizationId };
  }

  private async assertOrgManager(userId: string, organizationId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        status: InvitationStatus.accepted,
        memberRole: { in: [OrganizationMemberRole.owner, OrganizationMemberRole.manager] },
      },
    });
    if (!member) {
      throw new ForbiddenException('Bu işlem için yetkiniz yok');
    }
    return member;
  }
}
