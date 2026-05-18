import {
  BadRequestException,
  Controller,
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

  private buildAvatarResponse(
    file?: Express.Multer.File,
    thumbFile?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gerekli');
    }
    const base =
      process.env.PUBLIC_API_URL?.replace(/\/$/, '') ??
      'http://c6dx2th5a53norwcfwbiu3xn.195.85.201.153.sslip.io';
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
}
