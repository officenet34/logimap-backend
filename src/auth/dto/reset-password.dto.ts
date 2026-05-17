import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  password!: string;

  @IsString()
  @Length(6, 6)
  passwordConfirm!: string;
}
