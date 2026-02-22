import { Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';

export class CreateGameDtoMapper {
    static toModel(createGameDto: CreateGameDto): Games {
        return {
            id: createGameDto.id,
            name: createGameDto.name,
            size: createGameDto.size,
            lastModified: createGameDto.lastModified,
            imageURL: createGameDto.imageURL,
            description: createGameDto.description,
            mode: createGameDto.mode,
            cells: createGameDto.cells ?? [],
            isVisible: true,
        };
    }

    static toDto(game: Games): CreateGameDto {
        return {
            id: game.id,
            name: game.name,
            size: game.size,
            lastModified: game.lastModified,
            imageURL: game.imageURL,
            description: game.description,
            mode: game.mode,
            cells: game.cells ?? [],
        };
    }
}
