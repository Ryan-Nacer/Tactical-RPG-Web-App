import { HttpStatusCode, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '@app/services/notifications/notification.service';
import { Game, GridSize, Mode } from '@common/game';
import { of } from 'rxjs';
import { GameClientService } from './game-client.service';
import { ImageCaptureService } from './image-capture.service';

const NEW_GAME_ID = 123456789;
const NOT_FOUND_STATUS = HttpStatusCode.NotFound;
const SERVER_ERROR_STATUS = HttpStatusCode.InternalServerError;

/**
 * Strategie :
 * - tester GameClientService comme couche client Sprint 1 qui transforme un jeu
 *   avant sa persistence HTTP et qui centralise l'extraction des erreurs
 * - verifier surtout la logique metier autour de `saveGame` plutot que de recopier
 *   tous les endpoints triviaux de lecture
 *
 * Cas limites cibles :
 * - un jeu sans id doit etre cree apres capture d'image avec un id genere
 * - un jeu supprime cote serveur doit etre recree localement pour proteger le
 *   travail de l'utilisateur pendant l'edition
 * - creation et mise a jour doivent remettre le jeu invisible pour respecter la regle metier
 * - les erreurs peuvent arriver sous plusieurs formes imbriquees et doivent etre
 *   transforme es en messages exploitables par les composants Sprint 1
 */
describe('GameClientService', () => {
    let service: GameClientService;
    let httpMock: HttpTestingController;
    let imageCaptureServiceSpy: jasmine.SpyObj<ImageCaptureService>;
    let notificationServiceSpy: jasmine.SpyObj<NotificationService>;
    let baseUrl: string;

    const gridCapture = { nativeElement: document.createElement('div') } as ElementRef<HTMLElement>;

    const createGame = (overrides: Partial<Game> = {}): Game => ({
        id: 'game-1',
        name: 'Test Game',
        description: 'Description',
        mode: Mode.Classic,
        size: GridSize.Small,
        isVisible: true,
        lastModified: '2026-03-16',
        cells: [],
        ...overrides,
    });

    beforeEach(() => {
        imageCaptureServiceSpy = jasmine.createSpyObj('ImageCaptureService', ['captureImage']);
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['success']);
        imageCaptureServiceSpy.captureImage.and.returnValue(of('captured-image'));

        TestBed.configureTestingModule({
            providers: [
                GameClientService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
                { provide: ImageCaptureService, useValue: imageCaptureServiceSpy },
                { provide: NotificationService, useValue: notificationServiceSpy },
            ],
        });

        service = TestBed.inject(GameClientService);
        httpMock = TestBed.inject(HttpTestingController);
        baseUrl = service['baseUrl'];
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should create a new game with a generated id and captured image when the game has no id', () => {
        spyOn(Date, 'now').and.returnValue(NEW_GAME_ID);
        const gameWithoutId = createGame({ id: '' });

        service.saveGame(gameWithoutId, gridCapture).subscribe({
            next: () => undefined,
            error: fail,
        });

        expect(imageCaptureServiceSpy.captureImage).toHaveBeenCalledWith(gridCapture.nativeElement);
        const request = httpMock.expectOne(`${baseUrl}/game`);
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(
            jasmine.objectContaining({
                id: String(NEW_GAME_ID),
                imageURL: 'captured-image',
                name: 'Test Game',
                isVisible: false,
            }),
        );
        request.flush({});
    });

    it('should update an existing game with the captured image when the game has an id', () => {
        const existingGame = createGame();

        service.saveGame(existingGame, gridCapture).subscribe({
            next: () => undefined,
            error: fail,
        });

        const request = httpMock.expectOne(`${baseUrl}/game/${existingGame.id}`);
        expect(request.request.method).toBe('PATCH');
        expect(request.request.body).toEqual(
            jasmine.objectContaining({
                id: existingGame.id,
                imageURL: 'captured-image',
                isVisible: false,
            }),
        );
        request.flush({});
    });

    it('should recreate the game and notify the user when the original game no longer exists', () => {
        spyOn(Date, 'now').and.returnValue(NEW_GAME_ID);
        const existingGame = createGame();

        service.saveGame(existingGame, gridCapture).subscribe({
            next: () => undefined,
            error: fail,
        });

        httpMock
            .expectOne(`${baseUrl}/game/${existingGame.id}`)
            .flush({ message: 'Could not find game' }, { status: NOT_FOUND_STATUS, statusText: 'Not Found' });

        const createRequest = httpMock.expectOne(`${baseUrl}/game`);
        expect(createRequest.request.method).toBe('POST');
        expect(createRequest.request.body.id).toBe(String(NEW_GAME_ID));
        expect(createRequest.request.body.isVisible).toBeFalse();
        createRequest.flush({});

        expect(notificationServiceSpy.success).toHaveBeenCalledWith('Le jeu original a ete supprime. Un nouveau jeu a ete cree avec succes');
    });

    it('should propagate non not-found update errors', () => {
        const existingGame = createGame();
        let receivedStatus: number | undefined;

        service.saveGame(existingGame, gridCapture).subscribe({
            next: fail,
            error: (error) => {
                receivedStatus = error.status;
            },
        });

        httpMock
            .expectOne(`${baseUrl}/game/${existingGame.id}`)
            .flush({ message: 'Server failure' }, { status: SERVER_ERROR_STATUS, statusText: 'Server Error' });

        expect(receivedStatus).toBe(SERVER_ERROR_STATUS);
    });

    it('should extract nested backend messages as a flat string array', () => {
        const errors = service.extractErrors({
            error: {
                message: ['Nom invalide', 'Description trop longue'],
            },
        });

        expect(errors).toEqual(['Nom invalide', 'Description trop longue']);
    });

    it('should fall back to the Error message and to an unknown error when needed', () => {
        expect(service.extractErrors(new Error('Boom'))).toEqual(['Boom']);
        expect(service.extractErrors({ error: { message: [] } })).toEqual(['Erreur inconnue']);
    });
});
