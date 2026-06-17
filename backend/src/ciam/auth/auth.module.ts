import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PlatformModule } from '../../platform/platform.module';
import { EdgeModule } from '../../edge/edge.module';
import { AclModule } from '../../acl/acl.module';
import { MfaModule } from '../mfa/mfa.module';
import { LicensingModule } from '../../domains/licensing/licensing.module';

@Module({
  imports: [
    PlatformModule,
    EdgeModule,
    AclModule,
    MfaModule,
    forwardRef(() => LicensingModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: `${config.get('JWT_ACCESS_EXPIRE_MINUTES', '15')}m` },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
