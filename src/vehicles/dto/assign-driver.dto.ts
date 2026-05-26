import { IsOptional, IsUUID } from 'class-validator';

export class AssignDriverDto {
  @IsOptional()
  @IsUUID()
  driverUserId?: string | null;
}
