import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { GameCellDto } from './game-cell.dto';
import { GAME_NAME_MAX_LENGTH } from './game.dto.constants';

export class UpdateGameDto {
    @ApiProperty({ maxLength: GAME_NAME_MAX_LENGTH })
    @IsOptional()
    @IsString()
    @MaxLength(GAME_NAME_MAX_LENGTH)
    name?: string;

    @ApiProperty()
    @IsOptional()
    @IsString()
    size?: string;

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
    @IsString()
    mode?: string;

    @ApiProperty({ type: [GameCellDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => GameCellDto)
    cells?: GameCellDto[];
}
