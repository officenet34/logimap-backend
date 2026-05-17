import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { GenderType } from '@prisma/client';

export class RegisterDriverDto {
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsEnum(GenderType)
  gender!: GenderType;

  @IsString()
  @IsNotEmpty()
  nationalId!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @IsNotEmpty()
  addressLine!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  password!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passwordConfirm!: string;
}
