import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { InvitationsModule } from './invitations/invitations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LocationsModule } from './locations/locations.module';
import { PushModule } from './push/push.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MediaModule } from './media/media.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { UsersModule } from './users/users.module';
import { RoutesModule } from './routes/routes.module';
import { FreightShipmentsModule } from './freight-shipments/freight-shipments.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MediaModule,
    OrganizationsModule,
    UsersModule,
    InvitationsModule,
    NotificationsModule,
    LocationsModule,
    PushModule,
    VehiclesModule,
    RoutesModule,
    FreightShipmentsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
