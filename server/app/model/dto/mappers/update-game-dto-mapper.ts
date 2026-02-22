import { Games } from '@app/model/database/game';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';

export class UpdateGameDtoMapper {
    static toModel(updateGameDto: UpdateGameDto): Partial<Games> {
        return {
            name: updateGameDto.name,
            size: updateGameDto.size,
            lastModified: updateGameDto.lastModified,
            imageURL: updateGameDto.imageURL,
            description: updateGameDto.description,
            mode: updateGameDto.mode,
            isVisible: updateGameDto.isVisible,
            cells: updateGameDto.cells ?? [],
        };
    }

    static toDto(game: Games): UpdateGameDto {
        return {
            name: game.name,
            size: game.size,
            lastModified: game.lastModified,
            imageURL: game.imageURL,
            description: game.description,
            mode: game.mode,
            isVisible: game.isVisible,
            cells: game.cells ?? [],
        };
    }
}
