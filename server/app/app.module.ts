import { DateController } from '@app/controllers/date/date.controller';
import { GameFromSessionController } from '@app/controllers/game-from-session/game-from-session.controller';
import { RoomController } from '@app/controllers/room/room.controller';
import { ChatGateway } from '@app/gateways/chat/chat.gateway';
import { RoomGateway } from '@app/gateways/room/room.gateway';
import { Games, gameSchema } from '@app/model/database/game';
import { DateService } from '@app/services/date/date.service';
import { GameSessionService } from '@app/services/game-session/game-session.service';
import { GameService } from '@app/services/game/game.service';
import { PlayerService } from '@app/services/player/player.service';
import { RoomService } from '@app/services/room/room.service';
import { VirtualPlayerService } from '@app/services/virtual-player/virtual-player.service';
import { CombatResolutionService } from '@app/services/combat/combat-resolution.service';
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
    controllers: [DateController, GameController, GameFromSessionController, RoomController],
    providers: [
        ChatGateway,
        GameGateway,
        RoomGateway,
        GameService,
        GameSessionService,
        PlayerService,
        VirtualPlayerService,
        CombatResolutionService,
        DateService,
        GameValidationService,
        RoomService,
        Logger,
    ],
})
export class AppModule {}
