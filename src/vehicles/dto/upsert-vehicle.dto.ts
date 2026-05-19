import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class VehicleImageRowDto {
  @IsString()
  imageUrl!: string;

  @IsString()
  thumbnailUrl!: string;

  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class UpsertVehicleDto {
  @IsString()
  makeModel!: string;

  @IsString()
  plateVehicle!: string;

  @IsOptional()
  @IsString()
  plateTrailer?: string;

  @IsString()
  vehicleType!: string;

  @IsString()
  modelYear!: string;

  @IsString()
  color!: string;

  @IsString()
  bodyType!: string;

  @IsString()
  widthCm!: string;

  @IsString()
  lengthCm!: string;

  @IsString()
  heightCm!: string;

  @IsString()
  bodyVolumeM3!: string;

  @IsString()
  tonnageKg!: string;

  @IsString()
  extraInfo!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleImageRowDto)
  images?: VehicleImageRowDto[];
}
