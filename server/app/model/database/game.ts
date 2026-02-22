import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document } from 'mongoose';
import { TileId, ObjectId } from '@common/game';

export type GameDocument = Games & Document;

export interface GameCell {
    row: number;
    column: number;
    tile: TileId;
    object?: ObjectId;
}

const GAME_CELL_SCHEMA = {
    row: { type: Number, required: true },
    column: { type: Number, required: true },
    tile: { type: String, required: true },
    object: { type: String, required: false },
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
    mode: string;

    @ApiProperty()
    @Prop({ required: true })
    size: string;

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
