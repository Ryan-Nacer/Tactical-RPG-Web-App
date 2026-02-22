import { DateController } from '@app/controllers/date/date.controller';
import { GameFromSessionController } from '@app/controllers/game-from-session/game-from-session.controller';
import { Games, gameSchema } from '@app/model/database/game';
import { DateService } from '@app/services/date/date.service';
import { GameService } from '@app/services/game/game.service';
import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { GameController } from './controllers/game/game.controller';
import { GameGateway } from './gateways/game/game.gateway';
import { GameValidationService } from './services/game/game.validation.service';

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        MongooseModule.forFeature([{ name: Games.name, schema: gameSchema }]),
    ],
    controllers: [DateController, GameController, GameFromSessionController],
    providers: [GameGateway, GameService, DateService, GameValidationService, Logger],
})
export class AppModule {}
