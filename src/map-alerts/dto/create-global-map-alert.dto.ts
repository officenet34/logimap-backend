import { IsEnum, IsNumber, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { MapAlertKind } from '@prisma/client';

export class CreateGlobalMapAlertDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsEnum(MapAlertKind)
  kind!: MapAlertKind;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  message?: string;

  /** `24h` veya `forever` */
  @IsOptional()
  @IsString()
  ttl?: string;
}
