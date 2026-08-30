import { getErrorMessage } from '@app/controllers/controller.utils';
import { Games } from '@app/model/database/game';
import { CreateGameDtoMapper } from '@app/model/dto/mappers/create-game-dto-mapper';
import { GameService } from '@app/services/game/game.service';
import { BadRequestException, Body, Controller, HttpCode, HttpException, HttpStatus, InternalServerErrorException, Post } from '@nestjs/common';

interface GameFromSessionDto {
    name: string;
    gameData: Games;
}

interface SaveGameResponse {
    message: string;
    game?: unknown;
}

@Controller('api/game')
export class GameFromSessionController {
    constructor(private readonly gameService: GameService) {}

    @Post('from-session')
    @HttpCode(HttpStatus.CREATED)
    async saveGameFromSession(@Body() gameFromSession: GameFromSessionDto): Promise<SaveGameResponse> {
        try {
            const gameDto = CreateGameDtoMapper.toDto(gameFromSession.gameData);
            await this.gameService.addGame(gameDto);

            return {
                message: `Jeu '${gameFromSession.name}' sauvegarde avec succes`,
                game: gameDto,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            if (error instanceof Error && error.message === 'Mapping error') {
                throw new BadRequestException(error.message);
            }
            throw new InternalServerErrorException(getErrorMessage(error));
        }
    }
}
