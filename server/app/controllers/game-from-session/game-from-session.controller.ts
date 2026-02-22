import { UNKNOWN_ERROR } from '@app/controllers/controller.constants';
import { Games } from '@app/model/database/game';
import { CreateGameDtoMapper } from '@app/model/dto/mappers/create-game-dto-mapper';
import { GameService } from '@app/services/game/game.service';
import { Body, Controller, Post } from '@nestjs/common';

export interface GameFromSessionDto {
    name: string;
    gameData: Games;
}

export interface SaveGameResponse {
    success: boolean;
    message: string;
    game?: unknown;
    error?: string;
}

@Controller('api/game')
export class GameFromSessionController {
    constructor(private readonly gameService: GameService) {}

    /**
     * Endpoint pour recevoir les données d'un jeu depuis sessionStorage côté client
     * et les sauvegarder en base de données
     */
    @Post('from-session')
    async saveGameFromSession(@Body() gameFromSession: GameFromSessionDto): Promise<SaveGameResponse> {
        try {
            const gameDto = CreateGameDtoMapper.toDto(gameFromSession.gameData);
            await this.gameService.addGame(gameDto);

            return {
                success: true,
                message: `Jeu '${gameFromSession.name}' sauvegardé avec succès`,
                game: gameDto,
            };
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            return {
                success: false,
                message: `Erreur lors de la sauvegarde du jeu '${gameFromSession.name}': ${errorMessage}`,
                error: errorMessage,
            };
        }
    }

    private getErrorMessage(error: unknown): string {
        if (error instanceof Error) {
            return error.message;
        }
        return UNKNOWN_ERROR;
    }
}
