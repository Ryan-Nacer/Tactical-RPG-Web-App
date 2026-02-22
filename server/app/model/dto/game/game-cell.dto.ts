import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { TileId, ObjectId } from '@common/game';

export class GameCellDto {
    @ApiProperty()
    @IsInt()
    @Min(0)
    row: number;

    @ApiProperty()
    @IsInt()
    @Min(0)
    column: number;

    @ApiProperty()
    @IsString()
    @IsEnum(TileId)
    tile: TileId;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsEnum(ObjectId)
    object?: ObjectId;
}
