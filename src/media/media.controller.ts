import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OrganizationMemberRole, InvitationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const uploadDir = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

const vehicleUploadDir = join(process.cwd(), 'uploads', 'vehicles');
if (!existsSync(vehicleUploadDir)) {
  mkdirSync(vehicleUploadDir, { recursive: true });
}

const orgLogoUploadDir = join(process.cwd(), 'uploads', 'org-logos');
if (!existsSync(orgLogoUploadDir)) {
  mkdirSync(orgLogoUploadDir, { recursive: true });
}

const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.heic',
  '.heif',
]);

function isAcceptedImage(file: Express.Multer.File): boolean {
  const mime = (file.mimetype ?? '').toLowerCase();
  if (mime.startsWith('image/')) return true;
  const ext = extname(file.originalname).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(ext)) return false;
  return (
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream' ||
    mime === ''
  );
}

const avatarMulterOptions = {
  storage: diskStorage({
    destination: uploadDir,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext =
        file.fieldname === 'thumbnail'
          ? '.jpg'
          : extname(file.originalname).toLowerCase() || '.jpg';
      const prefix = file.fieldname === 'thumbnail' ? 'thumb_' : '';
      cb(null, `${prefix}${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!isAcceptedImage(file)) {
      cb(new BadRequestException('Sadece resim dosyası yüklenebilir'), false);
      return;
    }
    cb(null, true);
  },
};

function avatarFileInterceptor() {
  return FileInterceptor('file', avatarMulterOptions);
}

function avatarWithThumbInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ],
    avatarMulterOptions,
  );
}

const vehicleMulterOptions = {
  storage: diskStorage({
    destination: vehicleUploadDir,
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, filename: string) => void,
    ) => {
      const ext =
        file.fieldname === 'thumbnail'
          ? '.jpg'
          : extname(file.originalname).toLowerCase() || '.jpg';
      const prefix = file.fieldname === 'thumbnail' ? 'thumb_' : '';
      cb(null, `${prefix}${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!isAcceptedImage(file)) {
      cb(new BadRequestException('Sadece resim dosyası yüklenebilir'), false);
      return;
    }
    cb(null, true);
  },
};

function vehicleWithThumbInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: 'file', maxCount: 1 },
      { name: 'thumbnail', maxCount: 1 },
    ],
    vehicleMulterOptions,
  );
}

@Controller('media')
export class MediaController {
  constructor(private readonly prisma: PrismaService) {}

  /** Kayıt öncesi (JWT yok) — yalnızca dosya yükler, URL döner */
  @Post('avatar')
  @UseInterceptors(avatarFileInterceptor())
  uploadAvatarPublic(@UploadedFile() file?: Express.Multer.File) {
    return this.buildAvatarResponse(file);
  }

  /** Oturum açıkken profil fotoğrafı + users.profile_image_url güncelleme */
  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(avatarWithThumbInterceptor())
  async uploadMyAvatar(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
    @CurrentUser() user: JwtPayload,
  ) {
    const main = files.file?.[0];
    const thumb = files.thumbnail?.[0];
    const result = this.buildAvatarResponse(main, thumb);
    await this.prisma.user.update({
      where: { id: user.sub },
      data: {
        profileImageUrl: result.url,
        profileImageThumbnailUrl: result.thumbnailUrl,
      },
    });
    return result;
  }

  /** İşletme logosu — organizations.logo_url (yalnızca owner) */
  @Post('me/org-logo')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        storage: diskStorage({
          destination: orgLogoUploadDir,
          filename: (
            _req: Request,
            file: Express.Multer.File,
            cb: (error: Error | null, filename: string) => void,
          ) => {
            const ext = extname(file.originalname).toLowerCase() || '.jpg';
            cb(null, `${randomUUID()}${ext}`);
          },
        }),
        limits: { fileSize: 5 * 1024 * 1024 },
        fileFilter: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, accept: boolean) => void,
        ) => {
          if (!isAcceptedImage(file)) {
            cb(new BadRequestException('Sadece resim dosyası yüklenebilir'), false);
            return;
          }
          cb(null, true);
        },
      },
    ),
  )
  async uploadOrgLogo(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
    @Body('organizationId') organizationId?: string,
  ) {
    if (!file) throw new BadRequestException('Dosya gerekli');
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
      'https://api.logimap.com.tr';
    const url = `${base}/uploads/org-logos/${file.filename}`;

    const orgId = await this.resolveOwnerOrganizationId(
      user.sub,
      organizationId?.trim(),
    );
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { logoUrl: url },
    });
    return { url, organizationId: orgId };
  }

  private async resolveOwnerOrganizationId(
    userId: string,
    organizationId?: string,
  ): Promise<string> {
    let orgId = organizationId;
    if (!orgId) {
      const active = await this.prisma.userActiveOrganization.findUnique({
        where: { userId },
      });
      orgId = active?.organizationId;
    }
    if (!orgId) {
      const member = await this.prisma.organizationMember.findFirst({
        where: {
          userId,
          status: InvitationStatus.accepted,
          memberRole: OrganizationMemberRole.owner,
        },
        orderBy: { joinedAt: 'desc' },
      });
      orgId = member?.organizationId;
    }
    if (!orgId) {
      throw new BadRequestException('İşletme bulunamadı');
    }
    const owner = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId,
        memberRole: OrganizationMemberRole.owner,
        status: InvitationStatus.accepted,
      },
    });
    if (!owner) {
      throw new ForbiddenException(
        'Firma logosunu yalnızca işletme yöneticisi değiştirebilir',
      );
    }
    return orgId;
  }

  /** Araç galerisi — DB kaydı PUT /vehicles/me ile yapılır; burada sadece dosya URL döner */
  @Post('me/vehicle-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(vehicleWithThumbInterceptor())
  uploadVehicleImage(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      thumbnail?: Express.Multer.File[];
    },
  ) {
    const main = files.file?.[0];
    const thumb = files.thumbnail?.[0];
    return this.buildVehicleImageResponse(main, thumb);
  }

  private buildAvatarResponse(
    file?: Express.Multer.File,
    thumbFile?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
      'https://api.logimap.com.tr';
    const url = `${base}/uploads/avatars/${file.filename}`;
    const thumbnailUrl = thumbFile
      ? `${base}/uploads/avatars/${thumbFile.filename}`
      : url;
    return {
      url,
      thumbnailUrl,
      filename: file.filename,
    };
  }

  private buildVehicleImageResponse(
    file?: Express.Multer.File,
    thumbFile?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
      'https://api.logimap.com.tr';
    const url = `${base}/uploads/vehicles/${file.filename}`;
    const thumbnailUrl = thumbFile
      ? `${base}/uploads/vehicles/${thumbFile.filename}`
      : url;
    return {
      url,
      thumbnailUrl,
      filename: file.filename,
    };
  }
}
