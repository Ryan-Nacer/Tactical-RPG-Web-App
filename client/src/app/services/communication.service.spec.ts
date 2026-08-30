import { HttpErrorResponse, HttpResponse, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CommunicationService } from '@app/services/communication.service';
import { Message } from '@common/message';
import { JoinableRoomSummary } from '@common/wait-room';
import { Observable } from 'rxjs';

const CREATED_STATUS = 201;
const SERVER_ERROR_STATUS = 500;

/**
 * Strategie :
 * - tester CommunicationService comme facade HTTP reutilisee par plusieurs ecrans
 * - verifier le contrat reseau nominal de lecture et d'ecriture
 * - verifier separement les comportements d'echec pour les lectures passives
 *   et pour les actions explicites de l'utilisateur
 *
 * Cas limites cibles :
 * - basicGet doit convertir une panne reseau en valeur de secours `undefined`
 *   pour eviter de casser un abonnement passif cote composant
 * - getJoinableRooms doit aussi fournir une valeur de secours vide si le reseau
 *   tombe au mauvais moment
 * - basicPost doit au contraire propager l'erreur HTTP, parce qu'une action
 *   utilisateur explicite ne doit pas etre silencieusement ignoree
 */
describe('CommunicationService', () => {
    let httpMock: HttpTestingController;
    let service: CommunicationService;
    let baseUrl: string;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(withInterceptorsFromDi()), provideHttpClientTesting()],
        });

        service = TestBed.inject(CommunicationService);
        httpMock = TestBed.inject(HttpTestingController);
        baseUrl = service['baseUrl'];
    });

    afterEach(() => {
        httpMock.verify();
    });

    const expectRequest = (url: string, method: string) => {
        const request = httpMock.expectOne(url);
        expect(request.request.method).toBe(method);
        return request;
    };

    const expectGetFallback = <T>(observable: Observable<T>, url: string, fallbackValue: T) => {
        let receivedValue: T | undefined;

        observable.subscribe({
            next: (response) => {
                receivedValue = response;
            },
            error: fail,
        });

        expectRequest(url, 'GET').error(new ProgressEvent('Network error'));
        expect(receivedValue).toEqual(fallbackValue);
    };

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should return the message returned by basicGet', () => {
        const expectedMessage: Message = { body: 'Hello', title: 'World' };

        service.basicGet().subscribe({
            next: (response: Message) => {
                expect(response).toEqual(expectedMessage);
            },
            error: fail,
        });

        expectRequest(`${baseUrl}/example`, 'GET').flush(expectedMessage);
    });

    it('should return undefined when basicGet fails with a network error', () => {
        expectGetFallback(service.basicGet(), `${baseUrl}/example`, undefined);
    });

    it('should send the provided message through basicPost', () => {
        const sentMessage: Message = { body: 'Hello', title: 'World' };
        let responseStatus: number | undefined;

        service.basicPost(sentMessage).subscribe({
            next: (response: HttpResponse<string>) => {
                responseStatus = response.status;
            },
            error: fail,
        });

        const request = expectRequest(`${baseUrl}/example/send`, 'POST');
        expect(request.request.body).toEqual(sentMessage);
        request.flush('Created', { status: CREATED_STATUS, statusText: 'Created' });

        expect(responseStatus).toBe(CREATED_STATUS);
    });

    it('should propagate the backend error when basicPost fails', () => {
        const sentMessage: Message = { body: 'Hello', title: 'World' };
        let receivedError: HttpErrorResponse | undefined;

        service.basicPost(sentMessage).subscribe({
            next: fail,
            error: (error: HttpErrorResponse) => {
                receivedError = error;
            },
        });

        expectRequest(`${baseUrl}/example/send`, 'POST').flush('Server error', {
            status: SERVER_ERROR_STATUS,
            statusText: 'Server Error',
        });

        expect(receivedError?.status).toBe(SERVER_ERROR_STATUS);
    });

    it('should return the joinable rooms returned by the backend', () => {
        const rooms: JoinableRoomSummary[] = [
            { roomId: 'ROOM01', hostName: 'Host', gameName: 'Jeux test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
        ];

        service.getJoinableRooms().subscribe({
            next: (response) => {
                expect(response).toEqual(rooms);
            },
            error: fail,
        });

        expectRequest(`${baseUrl}/rooms/joinable`, 'GET').flush(rooms);
    });

    it('should return an empty room list when the joinable endpoint fails', () => {
        expectGetFallback(service.getJoinableRooms(), `${baseUrl}/rooms/joinable`, []);
    });
});
