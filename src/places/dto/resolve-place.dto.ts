import { IsString, MaxLength, MinLength } from 'class-validator';

export class ResolvePlaceDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  placeId!: string;
}
