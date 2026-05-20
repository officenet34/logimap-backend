import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RouteWaypointDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province!: string;
}

export class EstimateRouteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  startDistrict!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  startProvince!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  endDistrict!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  endProvince!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RouteWaypointDto)
  intermediates?: RouteWaypointDto[];
}
