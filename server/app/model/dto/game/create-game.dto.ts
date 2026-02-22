import { GAME_NAME_MAX_LENGTH } from '@app/model/dto/game/game.dto.constants';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { GameCellDto } from './game-cell.dto';

export class CreateGameDto {
    @ApiProperty()
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({ maxLength: GAME_NAME_MAX_LENGTH, required: false })
    @IsOptional()
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    name?: string;

    @ApiProperty()
    @IsString()
    size: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    lastModified?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    imageURL?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    mode: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    isVisible?: boolean;

    @ApiProperty({ type: [GameCellDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GameCellDto)
    cells?: GameCellDto[];
}
