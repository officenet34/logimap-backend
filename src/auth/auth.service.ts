import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  InvitationStatus,
  OrganizationMemberRole,
  OrganizationType,
  Prisma,
  RegistrationAccountType,
} from '@prisma/client';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPin, verifyPin } from '../common/utils/password.util';
import { normalizePhone, isValidE164, phoneLookupValues } from '../common/utils/phone.util';
import { resolveSectors } from '../common/utils/sectors.util';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { LoginDto } from './dto/login.dto';
import { RegisterSoleProprietorDto } from './dto/register-sole-proprietor.dto';
import { RegisterCompanyDto } from './dto/register-company.dto';
import { RegisterDriverDto } from './dto/register-driver.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async registerSoleProprietor(dto: RegisterSoleProprietorDto) {
    this.assertPasswordMatch(dto.password, dto.passwordConfirm);
    const phone = normalizePhone(dto.phone);
    if (!isValidE164(phone)) throw new BadRequestException('Geçersiz telefon');
    await this.assertUniqueUser(phone, dto.email);

    const passwordHash = await hashPin(dto.password);
    const sectors = resolveSectors(dto.sectors);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          registrationType: RegistrationAccountType.sole_proprietor,
          email: dto.email.toLowerCase(),
          phone,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: dto.gender,
          nationalId: dto.taxNumber,
          profileImageUrl: dto.profileImageUrl,
        },
      });

      const org = await tx.organization.create({
        data: {
          orgType: OrganizationType.sole_proprietor,
          displayName: dto.businessName,
          taxOffice: dto.taxOffice,
          taxNumber: dto.taxNumber,
          mobilePhone: phone,
          email: dto.email.toLowerCase(),
          city: dto.city,
          district: dto.district,
          country: dto.country ?? 'Türkiye',
          addressLine: dto.addressLine,
          createdByUserId: user.id,
        },
      });

      await tx.organizationSector.createMany({
        data: sectors.map((sector) => ({ organizationId: org.id, sector })),
      });

      if (dto.activityDocuments?.length) {
        await tx.activityDocument.createMany({
          data: dto.activityDocuments.map((doc, i) => ({
            organizationId: org.id,
            documentName: doc.documentName,
            fileUrl: doc.fileUrl,
            fileMime: doc.fileMime,
            fileSizeBytes: doc.fileSizeBytes,
            sortOrder: doc.sortOrder ?? i,
            uploadedByUserId: user.id,
          })),
        });
      }

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          memberRole: OrganizationMemberRole.owner,
          status: InvitationStatus.accepted,
          joinedAt: new Date(),
        },
      });

      if (dto.registerAsDriver) {
        await this.addSelfDriverTx(tx, org.id, user.id);
      }

      await tx.userActiveOrganization.create({
        data: { userId: user.id, organizationId: org.id },
      });

      return { user, organization: org };
    });

    return this.issueTokens(result.user);
  }

  async registerCompany(dto: RegisterCompanyDto) {
    this.assertPasswordMatch(dto.password, dto.passwordConfirm);
    const phone = normalizePhone(dto.phone);
    const mobilePhone = normalizePhone(dto.mobilePhone);
    if (!isValidE164(phone) || !isValidE164(mobilePhone)) {
      throw new BadRequestException('Geçersiz telefon');
    }
    await this.assertUniqueUser(phone, dto.email);

    const passwordHash = await hashPin(dto.password);
    const sectors = resolveSectors(dto.sectors);
    const memberRole =
      dto.companyPosition === 'company_owner'
        ? OrganizationMemberRole.owner
        : OrganizationMemberRole.manager;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          registrationType: RegistrationAccountType.company,
          email: dto.email.toLowerCase(),
          phone,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          gender: dto.gender,
          nationalId: dto.nationalId,
          profileImageUrl: dto.representativeProfileImageUrl,
        },
      });

      const org = await tx.organization.create({
        data: {
          orgType: OrganizationType.company,
          displayName: dto.companyName,
          logoUrl: dto.logoUrl,
          taxOffice: dto.taxOffice,
          taxNumber: dto.taxNumber,
          landlinePhone: dto.landlinePhone,
          mobilePhone,
          email: dto.companyEmail.toLowerCase(),
          websiteUrl: dto.websiteUrl,
          city: dto.city,
          district: dto.district,
          country: dto.country ?? 'Türkiye',
          addressLine: dto.addressLine,
          createdByUserId: user.id,
        },
      });

      await tx.organizationSector.createMany({
        data: sectors.map((sector) => ({ organizationId: org.id, sector })),
      });

      if (dto.activityDocuments?.length) {
        await tx.activityDocument.createMany({
          data: dto.activityDocuments.map((doc, i) => ({
            organizationId: org.id,
            documentName: doc.documentName,
            fileUrl: doc.fileUrl,
            fileMime: doc.fileMime,
            fileSizeBytes: doc.fileSizeBytes,
            sortOrder: doc.sortOrder ?? i,
            uploadedByUserId: user.id,
          })),
        });
      }

      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          memberRole,
          companyPosition: dto.companyPosition,
          status: InvitationStatus.accepted,
          joinedAt: new Date(),
        },
      });

      if (dto.registerAsDriver) {
        await this.addSelfDriverTx(tx, org.id, user.id);
      }

      await tx.userActiveOrganization.create({
        data: { userId: user.id, organizationId: org.id },
      });

      return { user, organization: org };
    });

    return this.issueTokens(result.user);
  }

  async registerDriver(dto: RegisterDriverDto) {
    this.assertPasswordMatch(dto.password, dto.passwordConfirm);
    const phone = normalizePhone(dto.phone);
    if (!isValidE164(phone)) throw new BadRequestException('Geçersiz telefon');
    await this.assertUniqueUser(phone, dto.email);

    const passwordHash = await hashPin(dto.password);

    const user = await this.prisma.$transaction(async (tx) => {
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

      return created;
    });

    return this.issueTokens(user);
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string }) {
    const login = dto.login.trim();
    const isEmail = login.includes('@');
    let phone: string | undefined;
    let email: string | undefined;

    if (isEmail) {
      email = login.toLowerCase();
    } else {
      phone = normalizePhone(login);
    }

    const user = await this.prisma.user.findFirst({
      where: isEmail
        ? { email }
        : { phone: { in: phoneLookupValues(login) } },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Telefon veya şifre hatalı');
    }

    const ok = await verifyPin(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Telefon veya şifre hatalı');

    return this.issueTokens(user, meta);
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const session = await this.prisma.userSession.findFirst({
      where: {
        refreshTokenHash: hash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!session?.user.isActive) {
      throw new UnauthorizedException('Oturum geçersiz');
    }

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(session.user);
  }

  async forgotPassword(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email: normalized } });

    if (user) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await this.prisma.$executeRaw`
        INSERT INTO public.password_reset_codes (email, code_hash, expires_at)
        VALUES (${normalized}::citext, ${codeHash}, ${expiresAt})
        ON CONFLICT (email) DO UPDATE
        SET code_hash = ${codeHash}, expires_at = ${expiresAt}, created_at = NOW()
      `;

      // TODO: SMTP noreply@logimap.com.tr — şimdilik log (Coolify logs)
      console.log(`[LogiMap] Şifre sıfırlama kodu ${normalized}: ${code}`);
    }

    return {
      success: true,
      message:
        'Şifre sıfırlama talimatları e-posta adresinize gönderildi (noreply@logimap.com.tr)',
    };
  }

  async resetPassword(dto: {
    email: string;
    code: string;
    password: string;
    passwordConfirm: string;
  }) {
    if (dto.password !== dto.passwordConfirm) {
      throw new BadRequestException('Şifreler eşleşmiyor');
    }
    const normalized = dto.email.trim().toLowerCase();
    const codeHash = crypto.createHash('sha256').update(dto.code).digest('hex');

    const rows = await this.prisma.$queryRaw<
      Array<{ email: string }>
    >`
      SELECT email::text AS email FROM public.password_reset_codes
      WHERE email = ${normalized}::citext
        AND code_hash = ${codeHash}
        AND expires_at > NOW()
    `;

    if (!rows.length) {
      throw new BadRequestException('Kod geçersiz veya süresi dolmuş');
    }

    const passwordHash = await hashPin(dto.password);
    await this.prisma.user.updateMany({
      where: { email: normalized },
      data: { passwordHash },
    });

    await this.prisma.$executeRaw`
      DELETE FROM public.password_reset_codes WHERE email = ${normalized}::citext
    `;

    return { success: true };
  }

  async resendVerification(email: string) {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { email: normalized } });
    if (!user) {
      return { success: true, message: 'Doğrulama e-postası gönderildi' };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await this.prisma.$executeRaw`
      INSERT INTO public.email_verification_codes (email, code_hash, expires_at)
      VALUES (${normalized}::citext, ${codeHash}, ${expiresAt})
      ON CONFLICT (email) DO UPDATE
      SET code_hash = ${codeHash}, expires_at = ${expiresAt}, created_at = NOW()
    `;

    console.log(`[LogiMap] E-posta doğrulama kodu ${normalized}: ${code}`);

    return { success: true, message: 'Doğrulama e-postası gönderildi' };
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.prisma.userSession.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async updateProfile(
    userId: string,
    dto: {
      firstName?: string;
      lastName?: string;
      phone?: string;
      profileImageUrl?: string;
    },
  ) {
    const data: Prisma.UserUpdateInput = {};
    if (dto.firstName != null) data.firstName = dto.firstName.trim();
    if (dto.lastName != null) data.lastName = dto.lastName.trim();
    if (dto.profileImageUrl != null) {
      data.profileImageUrl = dto.profileImageUrl.trim() || null;
    }
    if (dto.phone != null) {
      const phone = normalizePhone(dto.phone);
      if (!isValidE164(phone)) throw new BadRequestException('Geçersiz telefon');
      const other = await this.prisma.user.findFirst({
        where: { phone, NOT: { id: userId } },
      });
      if (other) throw new ConflictException('Bu telefon başka bir hesapta kayıtlı');
      data.phone = phone;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        profileImageUrl: true,
        profileImageThumbnailUrl: true,
        registrationType: true,
      },
    });
    return user;
  }

  async changePassword(
    userId: string,
    dto: {
      currentPassword: string;
      newPassword: string;
      newPasswordConfirm: string;
    },
  ) {
    this.assertPasswordMatch(dto.newPassword, dto.newPasswordConfirm);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.isActive) throw new UnauthorizedException();

    const ok = await verifyPin(dto.currentPassword, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Mevcut şifre hatalı');

    const passwordHash = await hashPin(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.prisma.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    await this.prisma.$transaction(async (tx) => {
      await tx.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    });

    return { success: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        registrationType: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        gender: true,
        profileImageUrl: true,
        profileImageThumbnailUrl: true,
        driverProfile: true,
        organizationMembers: {
          where: { status: InvitationStatus.accepted },
          include: {
            organization: {
              select: {
                id: true,
                orgType: true,
                displayName: true,
                logoUrl: true,
              },
            },
          },
        },
        activeOrganization: {
          include: { organization: true },
        },
      },
    });
    if (!user) throw new UnauthorizedException();
    return user;
  }

  private async issueTokens(
    user: {
      id: string;
      registrationType: RegistrationAccountType;
      email: string | null;
      phone: string;
    },
    meta?: { ip?: string; userAgent?: string },
  ) {
    const payload: JwtPayload = {
      sub: user.id,
      registrationType: user.registrationType,
      email: user.email,
      phone: user.phone,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
    });

    const refreshToken = crypto.randomBytes(48).toString('hex');
    const refreshDays = 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + refreshDays);

    await this.prisma.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
        ipAddress: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });

    return {
      success: true,
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.config.get('JWT_ACCESS_TTL', '15m'),
      user: {
        id: user.id,
        registrationType: user.registrationType,
        email: user.email,
        phone: user.phone,
      },
    };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private assertPasswordMatch(a: string, b: string) {
    if (a !== b) throw new BadRequestException('Şifreler eşleşmiyor');
  }

  private async assertUniqueUser(phone: string, email: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone }, { email: email.toLowerCase() }] },
    });
    if (existing) {
      throw new ConflictException('Bu telefon veya e-posta zaten kayıtlı');
    }
  }

  private async addSelfDriverTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    userId: string,
  ) {
    const exists = await tx.organizationMember.findFirst({
      where: {
        organizationId,
        userId,
        memberRole: OrganizationMemberRole.driver,
      },
    });
    if (exists) return;

    await tx.organizationMember.create({
      data: {
        organizationId,
        userId,
        memberRole: OrganizationMemberRole.driver,
        status: InvitationStatus.accepted,
        isSelfDriver: true,
        joinedAt: new Date(),
      },
    });
  }
}
