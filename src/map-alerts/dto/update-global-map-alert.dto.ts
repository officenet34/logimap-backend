import { IsEnum, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MapAlertKind } from '@prisma/client';

export class UpdateGlobalMapAlertDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsEnum(MapAlertKind)
  kind?: MapAlertKind;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;
}
