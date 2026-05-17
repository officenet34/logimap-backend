import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GenderType, SectorCode } from '@prisma/client';
import { ActivityDocumentDto } from './activity-document.dto';

export class RegisterCompanyDto {
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  @IsString()
  @IsNotEmpty()
  taxOffice!: string;

  @IsString()
  @IsNotEmpty()
  taxNumber!: string;

  @IsOptional()
  @IsString()
  landlinePhone?: string;

  @IsString()
  @IsNotEmpty()
  mobilePhone!: string;

  @IsEmail()
  companyEmail!: string;

  @IsOptional()
  @IsUrl()
  websiteUrl?: string;

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

  @IsArray()
  sectors!: (SectorCode | 'all')[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActivityDocumentDto)
  activityDocuments?: ActivityDocumentDto[];

  // Yetkili kişi
  @IsOptional()
  @IsString()
  representativeProfileImageUrl?: string;

  @IsIn(['company_owner', 'manager'])
  companyPosition!: 'company_owner' | 'manager';

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
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  password!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  passwordConfirm!: string;

  @IsOptional()
  @IsBoolean()
  registerAsDriver?: boolean;
}
