import { GameGateway, GameListUpdateType } from '@app/gateways/game/game.gateway';
import { GameDocument, Games } from '@app/model/database/game';
import { CreateGameDto } from '@app/model/dto/game/create-game.dto';
import { UpdateGameDto } from '@app/model/dto/game/update-game.dto';
import { GameValidationService } from '@app/services/game/game.validation.service';
import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

const UNKNOWN_ERROR_MESSAGE = 'Erreur inconnue.';
const GAME_NOT_FOUND_MESSAGE = 'Jeu introuvable.';
const INSERT_FAILED_MESSAGE = "Echec de l'insertion du jeu.";
const DELETE_FAILED_MESSAGE = 'Echec de la suppression du jeu.';
const UPDATE_FAILED_MESSAGE = 'Echec de la mise a jour du jeu.';

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
            const response = error.getResponse();
            if (Array.isArray(response)) {
                return response.filter((value): value is string => typeof value === 'string');
            }
            if (typeof response === 'string') {
                return response;
            }
            if (this.isRecord(response)) {
                const message = response.message;
                if (Array.isArray(message)) {
                    return message.filter((value): value is string => typeof value === 'string');
                }
                if (typeof message === 'string') {
                    return message;
                }
            }
        }
        if (error instanceof Error) {
            return error.message;
        }
        if (this.isRecord(error)) {
            const message = error.message;
            if (Array.isArray(message)) {
                return message.filter((value): value is string => typeof value === 'string');
            }
            if (typeof message === 'string') {
                return message;
            }
        }
        return undefined;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    async getGame(gameId: string): Promise<Games> {
        return await this.gameModel.findOne({ id: gameId });
    }

    async addGame(game: CreateGameDto): Promise<void> {
        // Regroupe toutes les erreurs de validation pour une seule reponse
        const errors: string[] = [];
        await this.captureValidation(errors, () => this.gameValidationService.checkNameRequired(game.name));
        await this.captureValidation(errors, () => this.gameValidationService.checkDescriptionRequired(game.description));
        await this.captureValidation(errors, () => this.gameValidationService.checkNameUniqueForCreate(game.name));
        await this.captureValidation(errors, () => this.gameValidationService.checkDoors(game.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkTerrainCoverage(game.cells));
        await this.captureValidation(errors, () => this.gameValidationService.checkStartPoints(game.cells, game.size));
        await this.captureValidation(errors, () => this.gameValidationService.checkFlagPlacement(game.cells, game.mode));
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
        // Regroupe toutes les erreurs de validation pour une seule reponse
        const errors: string[] = [];
        if (update.name !== undefined) {
            await this.captureValidation(errors, () => this.gameValidationService.checkNameRequired(update.name));
            await this.captureValidation(errors, () => this.gameValidationService.checkNameUniqueForUpdate(gameId, update.name));
        }
        if (update.description !== undefined) {
            await this.captureValidation(errors, () => this.gameValidationService.checkDescriptionRequired(update.description));
        }
        if (update.cells !== undefined) {
            let sizeValue = update.size;
            let modeValue = update.mode;
            let existingGame: Games | null = null;
            if (sizeValue === undefined || modeValue === undefined) {
                existingGame = await this.gameModel.findOne({ id: gameId });
            }
            if (sizeValue === undefined) {
                sizeValue = existingGame?.size;
            }
            if (modeValue === undefined) {
                modeValue = existingGame?.mode;
            }

            await this.captureValidation(errors, () => this.gameValidationService.checkDoors(update.cells));
            await this.captureValidation(errors, () => this.gameValidationService.checkTerrainCoverage(update.cells));
            await this.captureValidation(errors, () => this.gameValidationService.checkStartPoints(update.cells, sizeValue));
            await this.captureValidation(errors, () => this.gameValidationService.checkFlagPlacement(update.cells, modeValue));
            await this.captureValidation(errors, () => this.gameValidationService.hasInaccessibleTiles(update.cells));
        }
        if (errors.length > 0) {
            throw new BadRequestException(errors);
        }
        try {
            const updates = Object.fromEntries(Object.entries(update).filter(([, value]) => value !== undefined));

            const res = await this.gameModel.findOneAndUpdate({ id: gameId }, { $set: updates }, { new: true });
            if (res === null) {
                throw new NotFoundException(GAME_NOT_FOUND_MESSAGE);
            }
            if (update.isVisible !== undefined) {
                this.gameGateway.emitListUpdated({ type: GameListUpdateType.Visibility, gameId, visible: update.isVisible });
            }
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new Error(this.formatOperationError(UPDATE_FAILED_MESSAGE, error));
        }
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
