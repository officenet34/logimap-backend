import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ResolvePlaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  placeId!: string;

  /** Nominatim seçiminde zaten gelen koordinatlar (DB kayıt, ek API yok). */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  displayLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  formattedAddress?: string;
}
