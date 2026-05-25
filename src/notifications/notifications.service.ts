import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string, limit = 50) {
    const rows = await this.prisma.appNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return {
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
    };
  }

  async markRead(userId: string, notificationId: string) {
    await this.prisma.appNotification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async createOrgInviteForTarget(params: {
    targetUserId: string;
    organizationId: string;
    organizationName: string;
    inviteCode: string;
    inviteRole: string;
    inviterName: string;
    invitationId: string;
  }) {
    const roleLabel = params.inviteRole === 'manager' ? 'Personel' : 'Şoför';
    const title = `${params.organizationName} işletme daveti`;
    const message = params.inviterName
      ? `${params.inviterName} sizi ${roleLabel} olarak davet ediyor`
      : `Sizi ${roleLabel} olarak davet ediyor`;

    return this.prisma.appNotification.create({
      data: {
        userId: params.targetUserId,
        type: 'org_invite',
        title,
        message,
        data: {
          invitationId: params.invitationId,
          inviteCode: params.inviteCode,
          organizationId: params.organizationId,
          organizationName: params.organizationName,
          inviteRole: params.inviteRole,
          status: 'pending',
        } as Prisma.InputJsonValue,
      },
    });
  }

  async createOrgInviteSentForInviter(params: {
    inviterUserId: string;
    targetName: string;
    organizationName: string;
    inviteRole: string;
    invitationId: string;
  }) {
    const roleLabel = params.inviteRole === 'manager' ? 'Personel' : 'Şoför';
    return this.prisma.appNotification.create({
      data: {
        userId: params.inviterUserId,
        type: 'org_invite_sent',
        title: 'Davet Gönderildi',
        message: `${params.targetName} adlı kullanıcıya ${roleLabel} daveti gönderildi`,
        data: {
          invitationId: params.invitationId,
          organizationName: params.organizationName,
          inviteRole: params.inviteRole,
          status: 'pending',
        } as Prisma.InputJsonValue,
      },
    });
  }

  async createOrgInviteAcceptedForInviter(params: {
    inviterUserId: string;
    accepterName: string;
    organizationName: string;
    invitationId: string;
  }) {
    return this.prisma.appNotification.create({
      data: {
        userId: params.inviterUserId,
        type: 'org_invite_accepted',
        title: 'Davet Kabul Edildi',
        message: `${params.accepterName} ${params.organizationName} davetini kabul etti`,
        data: {
          invitationId: params.invitationId,
          organizationName: params.organizationName,
          status: 'accepted',
        } as Prisma.InputJsonValue,
      },
    });
  }
}
