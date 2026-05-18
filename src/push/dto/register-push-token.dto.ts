import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @IsNotEmpty()
  fcmToken!: string;

  @IsIn(['android', 'ios', 'web', 'unknown'])
  platform!: 'android' | 'ios' | 'web' | 'unknown';

  @IsOptional()
  @IsString()
  deviceLabel?: string;
}
