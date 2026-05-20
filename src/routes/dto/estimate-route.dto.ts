import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { RoutePointDto } from './route-point.dto';

export class EstimateRouteDto {
  @ValidateNested()
  @Type(() => RoutePointDto)
  start!: RoutePointDto;

  @ValidateNested()
  @Type(() => RoutePointDto)
  end!: RoutePointDto;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => RoutePointDto)
  intermediates?: RoutePointDto[];
}
