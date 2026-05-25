import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvitationStatus,
  OrganizationMemberRole,
  RegistrationAccountType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/utils/phone.util';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listPending(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();

    const rows = await this.prisma.organizationInvitation.findMany({
      where: {
        status: InvitationStatus.pending,
        expiresAt: { gt: new Date() },
        OR: [
          { targetUserId: userId },
          { targetPhone: user.phone },
          user.email ? { targetEmail: user.email } : undefined,
        ].filter(Boolean) as object[],
      },
      include: {
        organization: {
          select: { id: true, displayName: true, orgType: true, logoUrl: true },
        },
        invitedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invitations: rows.map((inv) => ({
        id: inv.id,
        inviteCode: inv.inviteCode,
        inviteRole: inv.inviteRole,
        message: inv.message,
        expiresAt: inv.expiresAt,
        organization: inv.organization,
        invitedBy: inv.invitedBy,
      })),
    };
  }

  async accept(userId: string, inviteCode: string) {
    const invitation = await this.findInvitationForUser(userId, inviteCode);

    if (invitation.status !== InvitationStatus.pending) {
      throw new BadRequestException('Davet artık geçerli değil');
    }
    if (invitation.expiresAt < new Date()) {
      await this.prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: InvitationStatus.expired },
      });
      throw new BadRequestException('Davet süresi dolmuş');
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.registrationType !== RegistrationAccountType.driver) {
      throw new BadRequestException('Yalnızca şoför hesabı daveti kabul edebilir');
    }

    const memberRole = invitation.inviteRole;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.organizationMember.findFirst({
        where: {
          organizationId: invitation.organizationId,
          userId,
          memberRole,
        },
      });

      if (!existing) {
        await tx.organizationMember.create({
          data: {
            organizationId: invitation.organizationId,
            userId,
            memberRole,
            status: InvitationStatus.accepted,
            invitedByUserId: invitation.invitedByUserId,
            joinedAt: new Date(),
          },
        });
      } else if (existing.status !== InvitationStatus.accepted) {
        await tx.organizationMember.update({
          where: { id: existing.id },
          data: {
            status: InvitationStatus.accepted,
            joinedAt: new Date(),
          },
        });
      }

      await tx.organizationInvitation.update({
        where: { id: invitation.id },
        data: {
          status: InvitationStatus.accepted,
          targetUserId: userId,
          respondedAt: new Date(),
        },
      });
    });

    const org = await this.prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { displayName: true },
    });
    const accepterName = `${user.firstName} ${user.lastName}`.trim();
    try {
      await this.notifications.createOrgInviteAcceptedForInviter({
        inviterUserId: invitation.invitedByUserId,
        accepterName,
        organizationName: org?.displayName ?? 'İşletme',
        invitationId: invitation.id,
      });
    } catch {
      /* app_notifications tablosu yoksa API yine başarılı */
    }

    return { success: true, organizationId: invitation.organizationId };
  }

  async reject(userId: string, inviteCode: string) {
    const invitation = await this.findInvitationForUser(userId, inviteCode);

    await this.prisma.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: InvitationStatus.rejected,
        respondedAt: new Date(),
      },
    });

    return { success: true };
  }

  private async findInvitationForUser(userId: string, inviteCode: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const invitation = await this.prisma.organizationInvitation.findUnique({
      where: { inviteCode },
    });

    if (!invitation) throw new NotFoundException('Davet bulunamadı');

    const matches =
      invitation.targetUserId === userId ||
      invitation.targetPhone === user.phone ||
      (user.email && invitation.targetEmail === user.email);

    if (!matches) throw new ForbiddenException('Bu davet size ait değil');

    return invitation;
  }
}
