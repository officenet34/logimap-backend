import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GenderType, SectorCode } from '@prisma/client';
import { ActivityDocumentDto } from './activity-document.dto';

export class RegisterSoleProprietorDto {
  @IsOptional()
  @IsString()
  profileImageUrl?: string;

  @IsString()
  @IsNotEmpty()
  businessName!: string;

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
  taxOffice!: string;

  @IsString()
  @IsNotEmpty()
  taxNumber!: string;

  @IsString()
  @IsNotEmpty()
  @Length(11, 11)
  @Matches(/^\d{11}$/)
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

  /** Sektör kodları veya register sırasında ["all"] */
  @IsArray()
  sectors!: (SectorCode | 'all')[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDocumentDto)
  activityDocuments?: ActivityDocumentDto[];

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  password!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passwordConfirm!: string;

  /** Kurucu aynı anda şoför olarak da eklensin */
  @IsOptional()
  @IsBoolean()
  registerAsDriver?: boolean;
}
