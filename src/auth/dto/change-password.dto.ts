import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(6, 6)
  currentPassword!: string;

  @IsString()
  @Length(6, 6)
  newPassword!: string;

  @IsString()
  @Length(6, 6)
  newPasswordConfirm!: string;
}
