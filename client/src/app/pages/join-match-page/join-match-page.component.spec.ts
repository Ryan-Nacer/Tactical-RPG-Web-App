import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { CommunicationService } from '@app/services/communication.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { JoinableRoomSummary } from '@common/wait-room';
import { Subject, of } from 'rxjs';
import { JoinMatchPageComponent } from './join-match-page.component';

/**
 * Strategie :
 * - tester la page de jonction comme facade de presentation au-dessus du service HTTP
 *   et du flux socket des salles joignables
 * - verifier le chargement initial, les mises a jour temps reel et les calculs affiches
 *
 * Cas limites cibles :
 * - salle pleine => aucune place restante et progression a 100%
 * - mise a jour socket qui remplace la liste chargee au depart
 * - mise a jour socket quand toutes les salles deviennent indisponibles
 *
 * Ces cas sont utiles parce que la fonctionnalite "joindre une partie" repose sur une
 * liste de salles fiable et reactive avant toute navigation vers la salle d'attente.
 */
describe('JoinMatchPageComponent', () => {
    const FULL_PROGRESS_PERCENTAGE = 100;
    let component: JoinMatchPageComponent;
    let fixture: ComponentFixture<JoinMatchPageComponent>;
    let routerSpy: jasmine.SpyObj<Router>;
    let communicationServiceSpy: jasmine.SpyObj<CommunicationService>;
    let roomSocketServiceSpy: jasmine.SpyObj<RoomSocketService>;
    let joinableRoomsSubject: Subject<JoinableRoomSummary[]>;

    const initialRooms: JoinableRoomSummary[] = [
        { roomId: 'ROOM01', hostName: 'Host', gameName: 'Jeux test', currentPlayers: 1, maxPlayers: 2, isLocked: false, mode: 'CLASSIC' },
    ];

    beforeEach(async () => {
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        communicationServiceSpy = jasmine.createSpyObj('CommunicationService', ['getJoinableRooms']);
        communicationServiceSpy.getJoinableRooms.and.returnValue(of(initialRooms));
        joinableRoomsSubject = new Subject<JoinableRoomSummary[]>();
        roomSocketServiceSpy = jasmine.createSpyObj('RoomSocketService', [], {
            joinableRooms$: joinableRoomsSubject,
        });

        await TestBed.configureTestingModule({
            imports: [JoinMatchPageComponent],
            providers: [
                { provide: Router, useValue: routerSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: {
                            queryParamMap: convertToParamMap({}),
                        },
                    },
                },
                { provide: CommunicationService, useValue: communicationServiceSpy },
                { provide: RoomSocketService, useValue: roomSocketServiceSpy },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(JoinMatchPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should render the room information in the template', () => {
        const compiled = fixture.nativeElement as HTMLElement;

        expect(compiled.textContent).toContain('Jeux test');
        expect(compiled.textContent).toContain('Host');
        expect(compiled.textContent).toContain('1/2');
        expect(compiled.textContent).toContain('1 places restantes');
    });

    it('should render a join button for each joinable room', () => {
        const joinButtons = fixture.nativeElement.querySelectorAll('.join-button');
        expect(joinButtons.length).toBe(initialRooms.length);
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should load joinable rooms from the communication service on init', () => {
        expect(communicationServiceSpy.getJoinableRooms).toHaveBeenCalled();
        expect(component.rooms).toEqual(initialRooms);
    });

    it('should replace rooms when the socket emits fresher joinable rooms', () => {
        const updatedRooms: JoinableRoomSummary[] = [
            { roomId: 'ROOM02', hostName: 'Host 2', gameName: 'Jeux test', currentPlayers: 2, maxPlayers: 4, isLocked: false, mode: 'CTF' },
        ];

        joinableRoomsSubject.next(updatedRooms);

        expect(component.rooms).toEqual(updatedRooms);
    });

    it('should clear the rooms list when the socket emits no more joinable rooms', () => {
        joinableRoomsSubject.next([]);

        expect(component.rooms).toEqual([]);
    });

    it('should compute the remaining places for a room', () => {
        expect(component.getRemainingPlaces(initialRooms[0])).toBe(1);
    });

    it('should compute a full progress percentage when the room is full', () => {
        const fullRoom: JoinableRoomSummary = {
            roomId: 'ROOM03',
            hostName: 'Host 3',
            gameName: 'Jeux test',
            currentPlayers: 2,
            maxPlayers: 2,
            isLocked: true,
            mode: 'CLASSIC',
        };

        expect(component.getProgressPercentage(fullRoom)).toBe(FULL_PROGRESS_PERCENTAGE);
    });
});
