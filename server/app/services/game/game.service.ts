import { GameGateway } from '@app/gateways/game/game.gateway';
import { GameListUpdateType } from '@app/gateways/game/game.gateway.events';
import { GameDocument, Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import {
    DELETE_FAILED_MESSAGE,
    GAME_NOT_FOUND_MESSAGE,
    INSERT_FAILED_MESSAGE,
    UNKNOWN_ERROR_MESSAGE,
    UPDATE_FAILED_MESSAGE,
} from '@app/services/game/game.service.constants';
import { GameValidationService } from '@app/services/game/game.validation.service';
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class GameService {
    constructor(
        @InjectModel(Games.name) private readonly gameModel: Model<GameDocument>,
        private readonly gameValidationService: GameValidationService,
        private readonly gameGateway: GameGateway,
    ) {}

    async getAllGames(): Promise<Games[]> {
        return await this.gameModel.find({});
    }

    async getVisibleGames(): Promise<Games[]> {
        return await this.gameModel.find({ isVisible: true });
    }

    private pushValidationError(errors: string[], error: unknown): void {
        const message = this.extractExceptionMessage(error);
        if (Array.isArray(message)) {
            errors.push(...message);
            return;
        }
        if (typeof message === 'string') {
            errors.push(message);
            return;
        }
        errors.push(UNKNOWN_ERROR_MESSAGE);
    }

    private async captureValidation(errors: string[], fn: () => Promise<void> | void): Promise<void> {
        try {
            await fn();
        } catch (error) {
            this.pushValidationError(errors, error);
        }
    }

    private extractExceptionMessage(error: unknown): string | string[] | undefined {
        if (error instanceof HttpException) {
            return this.extractMessageValue(error.getResponse()) ?? error.message;
        }
        if (error instanceof Error) {
            return error.message;
        }
        return this.extractMessageValue(error);
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && !!value;
    }

    private extractMessageValue(payload: unknown): string | string[] | undefined {
        if (Array.isArray(payload)) {
            return payload.filter((value): value is string => typeof value === 'string');
        }
        if (typeof payload === 'string') {
            return payload;
        }
        if (!this.isRecord(payload)) {
            return undefined;
        }
        return this.extractMessageValue(payload.message);
    }

    async getGame(gameId: string): Promise<Games> {
        return await this.gameModel.findOne({ id: gameId });
    }

    async addGame(game: CreateGameDto): Promise<void> {
        const errors: string[] = [];
        await this.captureValidation(errors, () => this.gameValidationService.checkNameRequired(game.name));
        await this.captureValidation(errors, () => this.gameValidationService.checkDescriptionRequired(game.description));
        await this.captureValidation(errors, () => this.gameValidationService.checkNameUniqueForCreate(game.name));
        await this.captureValidation(errors, () => this.gameValidationService.checkDoors(game.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkTerrainCoverage(game.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkStartPoints(game.cells, game.size));
        await this.captureValidation(errors, () => this.gameValidationService.checkFlagPlacement(game.cells, game.mode));
        await this.captureValidation(errors, () => this.gameValidationService.checkShrines(game.cells, game.size));
        await this.captureValidation(errors, () => this.gameValidationService.hasInaccessibleTiles(game.cells));
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }

        try {
            await this.gameModel.create(game);
            this.gameGateway.emitListUpdated({ type: GameListUpdateType.Created, gameId: game.id, visible: game.isVisible });
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new Error(this.formatOperationError(INSERT_FAILED_MESSAGE, error));
        }
    }

    async deleteGame(gameId: string): Promise<void> {
        try {
            const res = await this.gameModel.deleteOne({
                id: gameId,
            });
            if (res.deletedCount === 0) {
                throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
            }
            this.gameGateway.emitListUpdated({ type: GameListUpdateType.Deleted, gameId });
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new Error(this.formatOperationError(DELETE_FAILED_MESSAGE, error));
        }
    }

    async updateGame(gameId: string, update: UpdateGameDto): Promise<void> {
        const errors: string[] = [];
        await this.validateUpdatedName(gameId, update, errors);
        await this.validateUpdatedDescription(update, errors);
        await this.validateUpdatedCells(gameId, update, errors);
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }
        try {
            const updates = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));
            if (this.shouldResetVisibilityAfterEdit(update)) {
                updates.isVisible = false;
            }

            const res = await this.gameModel.findOneAndUpdate({ id: gameId }, { $set: updates }, { new: true });
            if (!res) {
                throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
            }
            if (updates.isVisible !== undefined) {
                this.gameGateway.emitListUpdated({ type: GameListUpdateType.Visibility, gameId, visible: updates.isVisible as boolean });
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new Error(this.formatOperationError(UPDATE_FAILED_MESSAGE, error));
        }
    }

    private async validateUpdatedName(gameId: string, update: UpdateGameDto, errors: string[]): Promise<void> {
        if (update.name === undefined) {
            return;
        }
        await this.captureValidation(errors, () => this.gameValidationService.checkNameRequired(update.name));
        await this.captureValidation(errors, () => this.gameValidationService.checkNameUniqueForUpdate(gameId, update.name));
    }

    private async validateUpdatedDescription(update: UpdateGameDto, errors: string[]): Promise<void> {
        if (update.description === undefined) {
            return;
        }
        await this.captureValidation(errors, () => this.gameValidationService.checkDescriptionRequired(update.description));
    }

    private async validateUpdatedCells(gameId: string, update: UpdateGameDto, errors: string[]): Promise<void> {
        if (update.cells === undefined) {
            return;
        }
        const context = await this.resolveValidationContext(gameId, update);

        await this.captureValidation(errors, () => this.gameValidationService.checkDoors(update.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkTerrainCoverage(update.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkStartPoints(update.cells, context.size));
        await this.captureValidation(errors, () => this.gameValidationService.checkFlagPlacement(update.cells, context.mode));
        await this.captureValidation(errors, () => this.gameValidationService.checkShrines(update.cells, context.size));
        await this.captureValidation(errors, () => this.gameValidationService.hasInaccessibleTiles(update.cells));
    }

    private async resolveValidationContext(
        gameId: string,
        update: UpdateGameDto,
    ): Promise<{ size: UpdateGameDto['size']; mode: UpdateGameDto['mode'] }> {
        if (update.size !== undefined && update.mode !== undefined) {
            return { size: update.size, mode: update.mode };
        }

        const existingGame = await this.gameModel.findOne({ id: gameId });
        return {
            size: update.size ?? existingGame?.size,
            mode: update.mode ?? existingGame?.mode,
        };
    }

    private shouldResetVisibilityAfterEdit(update: UpdateGameDto): boolean {
        const editableFields: (keyof UpdateGameDto)[] = ['name', 'size', 'lastModified', 'imageURL', 'description', 'mode', 'cells'];
        return editableFields.some((field) => update[field] !== undefined);
    }

    private formatOperationError(prefix: string, error: unknown): string {
        const message = this.extractExceptionMessage(error);
        if (Array.isArray(message)) {
            return `${prefix} ${message.join(', ')}`;
        }
        if (typeof message === 'string' && message.length > 0) {
            return `${prefix} ${message}`;
        }
        return prefix;
    }
}
