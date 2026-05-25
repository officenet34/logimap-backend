import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
  Prisma,
  RegistrationAccountType,
} from '@prisma/client';
type DriverUserWithProfile = Prisma.UserGetPayload<{
  include: { driverProfile: true };
}>;
import { PrismaService } from '../prisma/prisma.service';
import { hashPin } from '../common/utils/password.util';
import { normalizePhone, isValidE164 } from '../common/utils/phone.util';
import { InviteDriverDto } from './dto/invite-driver.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateOrgDriverDto } from './dto/create-org-driver.dto';
import { UpdateOrgDriverDto } from './dto/update-org-driver.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
      targetUserId = target?.id;
    }

    if (!targetUserId) {
      throw new BadRequestException('Kullanıcı bulunamadı');
    }

    return this.inviteMember(userId, organizationId, {
      targetUserId,
      inviteRole: OrganizationMemberRole.driver,
      message: dto.message,
    });
  }

  async inviteMember(userId: string, organizationId: string, dto: InviteMemberDto) {
    await this.assertCanInviteMembers(userId, organizationId);

    if (
      dto.inviteRole !== OrganizationMemberRole.driver &&
      dto.inviteRole !== OrganizationMemberRole.manager
    ) {
      throw new BadRequestException('Yalnızca şoför veya personel rolü seçilebilir');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: dto.targetUserId },
    });
    if (!target || !target.isActive) {
      throw new NotFoundException('Kullanıcı bulunamadı');
    }
    if (target.registrationType !== RegistrationAccountType.driver) {
      throw new BadRequestException(
        'Davet yalnızca şoför hesabı (çalışan) kullanıcılarına gönderilebilir',
      );
    }

    const existing = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: target.id,
        status: {
          in: [InvitationStatus.accepted, InvitationStatus.pending],
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Bu kullanıcı zaten işletmede veya bekleyen daveti var');
    }

    const pendingInvite = await this.prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        targetUserId: target.id,
        status: InvitationStatus.pending,
        expiresAt: { gt: new Date() },
      },
    });
    if (pendingInvite) {
      throw new BadRequestException('Bu kullanıcıya zaten bekleyen bir davet var');
    }

    const inviter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });
    const inviterName =
      `${inviter?.firstName ?? ''} ${inviter?.lastName ?? ''}`.trim();

    const invitation = await this.prisma.organizationInvitation.create({
      data: {
        organizationId,
        invitedByUserId: userId,
        inviteRole: dto.inviteRole,
        targetUserId: target.id,
        targetPhone: target.phone,
        targetEmail: target.email?.toLowerCase(),
        message: dto.message,
        status: InvitationStatus.pending,
      },
      include: {
        organization: { select: { displayName: true } },
      },
    });

    const orgName = invitation.organization.displayName;
    const targetName = `${target.firstName} ${target.lastName}`.trim();
    try {
      await this.notifications.createOrgInviteForTarget({
        targetUserId: target.id,
        organizationId,
        organizationName: orgName,
        inviteCode: invitation.inviteCode,
        inviteRole: invitation.inviteRole,
        inviterName,
        invitationId: invitation.id,
      });
      await this.notifications.createOrgInviteSentForInviter({
        inviterUserId: userId,
        targetName,
        organizationName: orgName,
        inviteRole: invitation.inviteRole,
        invitationId: invitation.id,
      });
    } catch {
      /* bildirim tablosu henüz migrate edilmemiş olabilir */
    }

    return {
      success: true,
      invitation: {
        id: invitation.id,
        inviteCode: invitation.inviteCode,
        inviteRole: invitation.inviteRole,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        organizationName: invitation.organization.displayName,
      },
      targetUser: {
        id: target.id,
        firstName: target.firstName,
        lastName: target.lastName,
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

  async listDrivers(userId: string, organizationId: string) {
    await this.assertCanInviteMembers(userId, organizationId);

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        memberRole: {
          in: [OrganizationMemberRole.driver, OrganizationMemberRole.manager],
        },
        status: InvitationStatus.accepted,
      },
      include: {
        user: { include: { driverProfile: true } },
      },
      orderBy: [{ joinedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      drivers: members
        .filter((m) => m.user.registrationType === RegistrationAccountType.driver)
        .map((m) => ({
          ...this.formatDriver(m.user),
          memberRole: m.memberRole,
        })),
    };
  }

  async getDriver(userId: string, organizationId: string, driverUserId: string) {
    await this.assertCanInviteMembers(userId, organizationId);
    const member = await this.findOrgDriverMember(organizationId, driverUserId);
    return {
      driver: {
        ...this.formatDriver(member.user),
        memberRole: member.memberRole,
      },
    };
  }

  async createDriver(
    userId: string,
    organizationId: string,
    dto: CreateOrgDriverDto,
  ) {
    await this.assertOrgManager(userId, organizationId);
    this.assertPasswordMatch(dto.password, dto.passwordConfirm);

    const phone = normalizePhone(dto.phone);
    if (!isValidE164(phone)) throw new BadRequestException('Geçersiz telefon');
    await this.assertUniqueUser(phone, dto.email);

    const passwordHash = await hashPin(dto.password);

    const driver = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          registrationType: RegistrationAccountType.driver,
          email: dto.email.toLowerCase(),
          phone,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: dto.gender,
          nationalId: dto.nationalId,
          profileImageUrl: dto.profileImageUrl,
        },
      });

      await tx.driverProfile.create({
        data: {
          userId: created.id,
          city: dto.city,
          district: dto.district,
          country: dto.country ?? 'Türkiye',
          addressLine: dto.addressLine,
        },
      });

      await tx.organizationMember.create({
        data: {
          organizationId,
          userId: created.id,
          memberRole: OrganizationMemberRole.driver,
          status: InvitationStatus.accepted,
          joinedAt: new Date(),
        },
      });

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        include: { driverProfile: true },
      });
    });

    return { driver: this.formatDriver(driver) };
  }

  async updateDriver(
    userId: string,
    organizationId: string,
    driverUserId: string,
    dto: UpdateOrgDriverDto,
  ) {
    await this.assertOrgManager(userId, organizationId);
    const member = await this.findOrgDriverMember(organizationId, driverUserId);
    const target = member.user;

    let phone: string | undefined;
    if (dto.phone != null) {
      phone = normalizePhone(dto.phone);
      if (!isValidE164(phone)) throw new BadRequestException('Geçersiz telefon');
      const clash = await this.prisma.user.findFirst({
        where: { phone, NOT: { id: target.id } },
      });
      if (clash) throw new ConflictException('Bu telefon başka bir hesapta kayıtlı');
    }

    if (dto.email != null) {
      const email = dto.email.toLowerCase();
      const clash = await this.prisma.user.findFirst({
        where: { email, NOT: { id: target.id } },
      });
      if (clash) throw new ConflictException('Bu e-posta başka bir hesapta kayıtlı');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: target.id },
        data: {
          ...(dto.firstName != null ? { firstName: dto.firstName } : {}),
          ...(dto.lastName != null ? { lastName: dto.lastName } : {}),
          ...(dto.email != null ? { email: dto.email.toLowerCase() } : {}),
          ...(phone != null ? { phone } : {}),
          ...(dto.profileImageUrl !== undefined
            ? { profileImageUrl: dto.profileImageUrl }
            : {}),
          ...(dto.gender != null ? { gender: dto.gender } : {}),
          ...(dto.nationalId != null ? { nationalId: dto.nationalId } : {}),
        },
      });

      const profileData = {
        ...(dto.city != null ? { city: dto.city } : {}),
        ...(dto.district != null ? { district: dto.district } : {}),
        ...(dto.country != null ? { country: dto.country } : {}),
        ...(dto.addressLine != null ? { addressLine: dto.addressLine } : {}),
      };

      if (Object.keys(profileData).length > 0) {
        await tx.driverProfile.upsert({
          where: { userId: target.id },
          create: {
            userId: target.id,
            city: dto.city ?? '',
            district: dto.district ?? '',
            country: dto.country ?? 'Türkiye',
            addressLine: dto.addressLine ?? '',
          },
          update: profileData,
        });
      }

      return tx.user.findUniqueOrThrow({
        where: { id: target.id },
        include: { driverProfile: true },
      });
    });

    return { driver: this.formatDriver(updated) };
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

  private formatDriver(user: DriverUserWithProfile) {
    const dp = user.driverProfile;
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      profileImageUrl: user.profileImageUrl,
      gender: user.gender,
      nationalId: user.nationalId,
      city: dp?.city ?? null,
      district: dp?.district ?? null,
      country: dp?.country ?? null,
      addressLine: dp?.addressLine ?? null,
    };
  }

  private async findOrgDriverMember(organizationId: string, driverUserId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: driverUserId,
        memberRole: {
          in: [OrganizationMemberRole.driver, OrganizationMemberRole.manager],
        },
        status: InvitationStatus.accepted,
      },
      include: {
        user: { include: { driverProfile: true } },
      },
    });
    if (!member) {
      throw new NotFoundException('Üye bulunamadı');
    }
    return member;
  }

  private assertPasswordMatch(a: string, b: string) {
    if (a !== b) throw new BadRequestException('Şifreler eşleşmiyor');
  }

  private async assertUniqueUser(phone: string, email: string) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ phone }, { email: email.toLowerCase() }],
      },
    });
    if (existing) {
      throw new ConflictException('Bu telefon veya e-posta zaten kayıtlı');
    }
  }

  /** Yalnızca işletmeyi kuran yönetici (owner) personel davet edebilir. */
  private async assertCanInviteMembers(userId: string, organizationId: string) {
    const ownerMember = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        memberRole: OrganizationMemberRole.owner,
        status: InvitationStatus.accepted,
      },
    });
    if (!ownerMember) {
      throw new ForbiddenException(
        'Personel daveti yalnızca işletme yöneticisi tarafından gönderilebilir',
      );
    }

    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { createdByUserId: true },
    });
    if (!org || org.createdByUserId !== userId) {
      throw new ForbiddenException(
        'Personel daveti yalnızca işletme hesabını oluşturan yönetici tarafından gönderilebilir',
      );
    }

    const inviter = await this.prisma.user.findUnique({ where: { id: userId } });
    if (
      !inviter ||
      (inviter.registrationType !== RegistrationAccountType.sole_proprietor &&
        inviter.registrationType !== RegistrationAccountType.company)
    ) {
      throw new ForbiddenException(
        'Personel daveti yalnızca şahıs firması veya şirket hesabından gönderilebilir',
      );
    }
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
