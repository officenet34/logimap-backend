import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  isValidUserMemberCode,
  normalizeUserMemberCode,
} from '../common/utils/member-code.util';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async lookupByMemberCode(rawCode: string) {
    const code = normalizeUserMemberCode(rawCode);
    if (!isValidUserMemberCode(code)) {
      throw new BadRequestException('Üye kodu 7 haneli rakam olmalıdır');
    }

    const user = await this.prisma.user.findFirst({
      where: { memberCode: code, isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        registrationType: true,
        profileImageUrl: true,
        profileImageThumbnailUrl: true,
        phone: true,
        email: true,
        memberCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Bu üye kodu geçersiz');
    }

    return {
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        registrationType: user.registrationType,
        profileImageUrl: user.profileImageUrl,
        profileImageThumbnailUrl: user.profileImageThumbnailUrl,
        phone: user.phone,
        email: user.email,
        memberCode: user.memberCode,
      },
    };
  }
}
