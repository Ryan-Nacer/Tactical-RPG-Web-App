import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { GameCellDto } from './game-cell.dto';
import { GAME_NAME_MAX_LENGTH } from './game.dto.constants';
import { GridSize, Mode } from '@common/game';

export class UpdateGameDto {
    @ApiProperty({ maxLength: GAME_NAME_MAX_LENGTH })
    @IsOptional()
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    name?: string;

    @ApiProperty()
    @IsOptional()
    @IsEnum(GridSize)
    size?: GridSize;

    @ApiProperty()
    @IsOptional()
    @IsString()
    lastModified?: string;

    @ApiProperty()
    @IsOptional()
    @IsBoolean()
    isVisible?: boolean;

    @ApiProperty()
    @IsOptional()
    @IsString()
    imageURL?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty()
    @IsOptional()
    @IsEnum(Mode)
    mode?: Mode;

    @ApiProperty({ type: [GameCellDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GameCellDto)
    cells?: GameCellDto[];
}
