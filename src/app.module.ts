import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { InvitationsModule } from './invitations/invitations.module';
import { LocationsModule } from './locations/locations.module';
import { PushModule } from './push/push.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MediaModule } from './media/media.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MediaModule,
    OrganizationsModule,
    InvitationsModule,
    LocationsModule,
    PushModule,
    VehiclesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
