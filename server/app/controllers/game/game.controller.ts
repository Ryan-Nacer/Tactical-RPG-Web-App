import { ADD_GAME_DESC, GAME_CREATED_MSG, MODIFY_GAME_DESC, NOT_FOUND_DESC } from '@app/controllers/controller.constants';
import { getErrorMessage } from '@app/controllers/controller.utils';
import { Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameService } from '@app/services/game/game.service';
import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpException,
    HttpStatus,
    InternalServerErrorException,
    NotFoundException,
    Param,
    Patch,
    Post,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiNotFoundResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';

interface CreateGameResponse {
    message: string;
    id?: string;
}

@ApiTags('Games')
@Controller('game')
export class GameController {
    constructor(private readonly gameServices: GameService) {}

    @Get('/')
    async allGames(): Promise<Games[]> {
        try {
            return await this.gameServices.getAllGames();
        } catch (error) {
            this.rethrowAsInternalServerError(error);
        }
    }

    @Get('/visible')
    async visibleGames(): Promise<Games[]> {
        try {
            return await this.gameServices.getVisibleGames();
        } catch (error) {
            this.rethrowAsInternalServerError(error);
        }
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    @ApiCreatedResponse({
        description: ADD_GAME_DESC,
    })
    @ApiNotFoundResponse({
        description: NOT_FOUND_DESC,
    })
    async addGame(@Body() gameDto: CreateGameDto): Promise<CreateGameResponse> {
        try {
            await this.gameServices.addGame(gameDto);
            return { message: GAME_CREATED_MSG, id: gameDto.id };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.rethrowAsInternalServerError(error);
        }
    }

    @ApiOkResponse({
        description: MODIFY_GAME_DESC,
        type: Games,
    })
    @ApiNotFoundResponse({
        description: NOT_FOUND_DESC,
    })
    @Get('/:id')
    async getGameById(@Param('id') id: string): Promise<Games> {
        try {
            const game = await this.gameServices.getGame(id);
            if (!game) {
                throw new NotFoundException('Jeu introuvable.');
            }
            return game;
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.rethrowAsInternalServerError(error);
        }
    }

    @Patch('/:id')
    async updateGame(@Param('id') gameId: string, @Body() gameDto: UpdateGameDto): Promise<void> {
        try {
            await this.gameServices.updateGame(gameId, gameDto);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.rethrowAsInternalServerError(error);
        }
    }

    @Delete('/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteGame(@Param('id') id: string): Promise<void> {
        try {
            await this.gameServices.deleteGame(id);
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            this.rethrowAsInternalServerError(error);
        }
    }

    private rethrowAsInternalServerError(error: unknown): never {
        throw new InternalServerErrorException(getErrorMessage(error));
    }
}
