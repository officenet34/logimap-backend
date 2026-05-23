import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class FreightRouteStopDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  breakMinutes?: number;
}

export class FreightRouteLegDto {
  @IsNumber()
  @Min(0)
  distanceKm!: number;

  @IsInt()
  @Min(0)
  durationSeconds!: number;
}

export class FreightLoadAtStopDto {
  @IsInt()
  @Min(0)
  routeStopIndex!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  fillPercent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  tonnageKg?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cargoM3?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  loadCriteria?: string;
}

export class FreightSurroundingLoadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  province!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  district!: string;
}

export class CreateFreightShipmentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  startProvince!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  startDistrict!: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  startBreakMinutes?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  endProvince!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  endDistrict!: string;

  @IsDateString()
  vehicleReturnAt!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  endRestMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDistanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimatedDurationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  estimatedRouteFromLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  estimatedRouteToLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FreightRouteLegDto)
  routeLegs?: FreightRouteLegDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FreightRouteStopDto)
  routeStops!: FreightRouteStopDto[];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  returnStartProvince!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  returnStartDistrict!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  returnEndProvince!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  returnEndDistrict!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  returnStartBreakMinutes?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  returnEstimatedDistanceKm?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  returnEstimatedDurationSeconds?: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  returnEstimatedRouteFromLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  returnEstimatedRouteToLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => FreightRouteLegDto)
  returnRouteLegs?: FreightRouteLegDto[];

  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => FreightRouteStopDto)
  returnRouteStops!: FreightRouteStopDto[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  outboundHasLoad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  outboundLoadStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  outboundCanTakeExtraLoad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outboundLoadDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  outboundFillPercent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  outboundTonnageFullness?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  outboundCargoSpaceEmpty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  outboundTonnageEmpty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outboundLoadCriteria?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FreightLoadAtStopDto)
  outboundLoadAtStops?: FreightLoadAtStopDto[];

  @IsOptional()
  @IsString()
  @MaxLength(16)
  returnHasLoad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  returnLoadStatus?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  returnLoadDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  returnCanTakeExtraLoad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  returnFillPercent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  returnTonnageFullness?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  returnCargoSpaceEmpty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  returnTonnageEmpty?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  returnOnlySameDirection?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  returnLoadCriteria?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => FreightLoadAtStopDto)
  returnLoadAtStops?: FreightLoadAtStopDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => FreightSurroundingLoadDto)
  returnSurroundingLoads?: FreightSurroundingLoadDto[];

  @IsBoolean()
  acceptedTerms!: boolean;
}
