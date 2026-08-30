import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { DoorState, GridSize, Mode, ObjectId, ShrinePart, TileId } from '@common/game';

export type GameDocument = Games & Document;

export interface GameCell {
    row: number;
    column: number;
    tile: TileId;
    object?: ObjectId;
    doorState?: DoorState;
    shrineId?: string;
    shrinePart?: ShrinePart;
    shrineCooldownTurns?: number;
}

const GAME_CELL_SCHEMA = {
    row: { type: Number, required: true },
    column: { type: Number, required: true },
    tile: { type: String, required: true },
    object: { type: String, required: false },
    doorState: { type: String, required: false },
    shrineId: { type: String, required: false },
    shrinePart: { type: String, required: false },
    shrineCooldownTurns: { type: Number, required: false },
};

@Schema()
export class Games {
    @ApiProperty()
    @Prop({ required: true })
    name: string;

    @ApiProperty()
    @Prop({ required: true })
    id: string;

    @ApiProperty()
    @Prop({ required: false })
    image?: string;

    @ApiProperty()
    @Prop({ required: false })
    imageURL?: string;

    @ApiProperty()
    @Prop({ required: true })
    mode: Mode;

    @ApiProperty()
    @Prop({ required: true })
    size: GridSize;

    @ApiProperty()
    @Prop({ required: true })
    description: string;

    @ApiProperty()
    @Prop({ required: false })
    lastModified?: string;

    @ApiProperty()
    @Prop({ default: false })
    isVisible: boolean;

    @ApiProperty()
    _id?: string;

    @Prop({
        type: [GAME_CELL_SCHEMA],
        default: [],
    })
    cells: GameCell[];
}

export const gameSchema = SchemaFactory.createForClass(Games);
