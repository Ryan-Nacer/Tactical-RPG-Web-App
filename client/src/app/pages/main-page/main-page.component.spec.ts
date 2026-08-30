import { HttpResponse } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Routes, provideRouter } from '@angular/router';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { CommunicationService } from '@app/services/communication.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { of } from 'rxjs';
import SpyObj = jasmine.SpyObj;

const routes: Routes = [];
const WAIT_ROOM_NOTICE_KEY = 'wait-room-notice';
const WAIT_ROOM_NOTICE = 'La salle a ete fermee.';
const HOME_REDIRECT_NOTICE_KEY = 'home-redirect-notice';
const HOME_REDIRECT_NOTICE_LEVEL_KEY = 'home-redirect-notice-level';
const HOME_REDIRECT_NOTICE = 'La partie classique est annulee, car il ne reste qu un seul joueur en jeu.';

/**
 * Strategie :
 * - tester MainPageComponent comme facade minimale vers CommunicationService et
 *   NotificationService, sans recoder les details HTTP deja verifies ailleurs
 * - garder les tests centres sur les effets visibles pour l'utilisateur:
 *   message de salle d'attente et notifications de succes/lecture
 */
describe('MainPageComponent', () => {
    let component: MainPageComponent;
    let fixture: ComponentFixture<MainPageComponent>;
    let communicationServiceSpy: SpyObj<CommunicationService>;
    let notificationServiceSpy: SpyObj<NotificationService>;

    beforeEach(async () => {
        communicationServiceSpy = jasmine.createSpyObj('ExampleService', ['basicGet', 'basicPost']);
        notificationServiceSpy = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info', 'warning']);
        communicationServiceSpy.basicGet.and.returnValue(of({ title: '', body: '' }));
        communicationServiceSpy.basicPost.and.returnValue(of(new HttpResponse<string>({ status: 201, statusText: 'Created' })));

        await TestBed.configureTestingModule({
            imports: [MainPageComponent],
            providers: [
                {
                    provide: CommunicationService,
                    useValue: communicationServiceSpy,
                },
                {
                    provide: NotificationService,
                    useValue: notificationServiceSpy,
                },
                provideHttpClientTesting(),
                provideRouter(routes),
            ],
        }).compileComponents();
    });

    beforeEach(() => {
        sessionStorage.clear();
        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture?.destroy();
        sessionStorage.clear();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should read and then remove the wait room notice from sessionStorage', () => {
        sessionStorage.setItem(WAIT_ROOM_NOTICE_KEY, WAIT_ROOM_NOTICE);

        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(component.waitRoomNotice).toBe(WAIT_ROOM_NOTICE);
        expect(sessionStorage.getItem(WAIT_ROOM_NOTICE_KEY)).toBeNull();
    });

    it('shows a warning notification when a redirect notice is present in sessionStorage', () => {
        sessionStorage.setItem(HOME_REDIRECT_NOTICE_KEY, HOME_REDIRECT_NOTICE);
        sessionStorage.setItem(HOME_REDIRECT_NOTICE_LEVEL_KEY, 'warning');

        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(notificationServiceSpy.warning).toHaveBeenCalledWith(HOME_REDIRECT_NOTICE);
        expect(sessionStorage.getItem(HOME_REDIRECT_NOTICE_KEY)).toBeNull();
        expect(sessionStorage.getItem(HOME_REDIRECT_NOTICE_LEVEL_KEY)).toBeNull();
    });

    it('shows a success notification when a winning redirect notice is present in sessionStorage', () => {
        sessionStorage.setItem(HOME_REDIRECT_NOTICE_KEY, 'Vous avez remporte la partie.');
        sessionStorage.setItem(HOME_REDIRECT_NOTICE_LEVEL_KEY, 'success');

        fixture = TestBed.createComponent(MainPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        expect(notificationServiceSpy.success).toHaveBeenCalledWith('Vous avez remporte la partie.');
    });

    it('shows a success notification when posting the time succeeds', () => {
        component.sendTimeToServer();

        expect(notificationServiceSpy.success).toHaveBeenCalled();
    });

    it('shows an info notification when retrieving a server message', () => {
        communicationServiceSpy.basicGet.and.returnValue(of({ title: 'Hello', body: 'World' }));

        component.getMessagesFromServer();

        expect(notificationServiceSpy.info).toHaveBeenCalledWith('Hello World');
    });
});
