import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request } from 'express';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';

const uploadDir = join(process.cwd(), 'uploads', 'avatars');
if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
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

function avatarFileInterceptor() {
  return FileInterceptor('file', {
    storage: diskStorage({
      destination: uploadDir,
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
  });
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
  @UseInterceptors(avatarFileInterceptor())
  async uploadMyAvatar(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    const result = this.buildAvatarResponse(file);
    await this.prisma.user.update({
      where: { id: user.sub },
      data: { profileImageUrl: result.url },
    });
    return result;
  }

  private buildAvatarResponse(file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
      'http://c6dx2th5a53norwcfwbiu3xn.195.85.201.153.sslip.io';
    return {
      url: `${base}/uploads/avatars/${file.filename}`,
      filename: file.filename,
    };
  }
}
