import { IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteDriverDto {
  @IsOptional()
  @IsString()
  targetPhone?: string;

  @IsOptional()
  @IsEmail()
  targetEmail?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
