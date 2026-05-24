import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSavedLocationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsString()
  address?: string;
}
