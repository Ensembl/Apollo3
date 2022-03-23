import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { MongooseModule } from '@nestjs/mongoose'

import { AssembliesModule } from './assemblies/assemblies.module'
import { AuthenticationModule } from './authentication/authentication.module'
import { ChangeModule } from './change/change.module'
import { FeaturesModule } from './features/features.module'
import { FileHandlingModule } from './fileHandling/fileHandling.module'
// import { RefSeqsModule } from './refSeqs/' './refSeqs/refSeqs.module'
import { RolesGuard } from './utils/role/role.guards'
import { RefseqsModule } from './refseqs/refseqs.module'

const nodeEnv = process.env.NODE_ENV || 'production'

@Module({
  imports: [
    FileHandlingModule,
    AuthenticationModule,
    ConfigModule.forRoot({
      envFilePath: nodeEnv === 'production' ? '.env' : '.development.env',
    }),
    FileHandlingModule,
    ChangeModule,
    AssembliesModule,
    FeaturesModule,
    RefseqsModule,
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('DB_CONN_STR'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
