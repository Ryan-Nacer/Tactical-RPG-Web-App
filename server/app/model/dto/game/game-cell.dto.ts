import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsEnum, Min } from 'class-validator';
import { DoorState, ObjectId, ShrinePart, TileId } from '@common/game';

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

    @ApiProperty({ required: false, enum: DoorState })
    @IsOptional()
    @IsEnum(DoorState)
    doorState?: DoorState;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    shrineId?: string;

    @ApiProperty({ required: false, enum: ShrinePart })
    @IsOptional()
    @IsEnum(ShrinePart)
    shrinePart?: ShrinePart;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsInt()
    @Min(0)
    shrineCooldownTurns?: number;
}
