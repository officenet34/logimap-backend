import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  /** E-posta veya telefon (+905... veya 05...) */
  @IsString()
  @IsNotEmpty()
  login!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'Şifre 6 haneli sayı olmalıdır' })
  password!: string;
}
