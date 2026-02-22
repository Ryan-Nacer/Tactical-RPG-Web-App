import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfigService } from '@app/services/config.service';
import { AvatarName, PlayerAvatar } from '@common/player';
import { AvatarListComponent } from './avatar-list.component';

/**
 * Stratégie de tests :
 * Ce fichier teste la logique complète d’AvatarListComponent. On mock ConfigService
 * pour contrôler la liste d’avatars. On vérifie l’initialisation, la navigation, la mise à
 * jour des avatars visibles et l’émission de l’événement avatarSelected.
 *
 * On inclut des cas limites comme la navigation au début et à la fin de la liste, ainsi
 * que le wrap-around. Ces cas sont testés pour s’assurer que la navigation reste
 * cohérente même lorsque l’utilisateur dépasse les bornes normales de la liste.
 */
const INTERVAL_DELAY = 100;
const VISIBLE_CHARACTERS_COUNT = 5;
const CENTER_INDEX = 2;
const NAVIGATION_BUTTONS_COUNT = 2; // boutons Précédent et Suivant

describe('AvatarListComponent', () => {
    let component: AvatarListComponent;
    let fixture: ComponentFixture<AvatarListComponent>;
    let mockConfigService: jasmine.SpyObj<ConfigService>;

    const CHARACTER_INDEX0 = 0;
    const CHARACTER_INDEX1 = 1;
    const CHARACTER_INDEX2 = 2;
    const CHARACTER_INDEX3 = 3;
    const CHARACTER_INDEX4 = 4;

    const mockPlayerAvatars: PlayerAvatar[] = [
        {
            imageUrl: 'barbie.png',
            avatarName: AvatarName.Barbie,
        },
        {
            imageUrl: 'ken.png',
            avatarName: AvatarName.Ken,
        },
        {
            imageUrl: 'nikki.png',
            avatarName: AvatarName.Nikki,
        },
        {
            imageUrl: 'raquelle.png',
            avatarName: AvatarName.Raquelle,
        },
        {
            imageUrl: 'teresa.png',
            avatarName: AvatarName.Teresa,
        },
    ];

    beforeEach(async () => {
        const configServiceSpy = jasmine.createSpyObj('ConfigService', ['getPlayerAvatars']);
        configServiceSpy.isLoaded = false;

        await TestBed.configureTestingModule({
            imports: [AvatarListComponent],
            providers: [{ provide: ConfigService, useValue: configServiceSpy }],
        }).compileComponents();

        mockConfigService = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
        mockConfigService.getPlayerAvatars.and.returnValue(mockPlayerAvatars);
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(AvatarListComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should initialize with empty arrays', () => {
        expect(component.playerAvatars).toEqual([]);
        expect(component.visibleAvatars).toEqual([]);
        expect(component.currentAvatarIndex).toBe(CHARACTER_INDEX0);
    });

    it('should load player avatars when config service is ready', fakeAsync(() => {
        mockConfigService.isLoaded = true;

        component.ngOnInit();
        tick(INTERVAL_DELAY);

        expect(component.playerAvatars).toEqual(mockPlayerAvatars);
        expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
    }));

    it('should wait for config service to load', (done) => {
        mockConfigService.isLoaded = false;

        component.ngOnInit();

        expect(component.playerAvatars).toEqual([]);

        setTimeout(() => {
            expect(component.playerAvatars).toEqual([]);
            mockConfigService.isLoaded = true;

            setTimeout(() => {
                expect(component.playerAvatars).toEqual(mockPlayerAvatars);
                expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
                done();
            }, INTERVAL_DELAY);
        }, INTERVAL_DELAY);
    });

    describe('Navigation', () => {
        beforeEach(() => {
            component.playerAvatars = [...mockPlayerAvatars];
            component.updateVisibleAvatars();
        });

        it('should move to next avatar', () => {
            const initialIndex = component.currentAvatarIndex;

            component.nextAvatar();

            expect(component.currentAvatarIndex).toBe((initialIndex + 1) % mockPlayerAvatars.length);
        });

        it('should move to previous avatar', () => {
            component.currentAvatarIndex = CHARACTER_INDEX2;

            component.prevAvatar();

            expect(component.currentAvatarIndex).toBe(CHARACTER_INDEX1);
        });

        it('should wrap around when going to previous from first avatar', () => {
            component.currentAvatarIndex = 0;

            component.prevAvatar();

            expect(component.currentAvatarIndex).toBe(mockPlayerAvatars.length - 1);
        });

        it('should wrap around when going to next from last avatar', () => {
            component.currentAvatarIndex = mockPlayerAvatars.length - 1;

            component.nextAvatar();

            expect(component.currentAvatarIndex).toBe(CHARACTER_INDEX0);
        });
    });

    describe('Visible Avatars', () => {
        beforeEach(() => {
            component.playerAvatars = [...mockPlayerAvatars];
        });

        it('should update visible avatars correctly', () => {
            component.currentAvatarIndex = CHARACTER_INDEX2;

            component.updateVisibleAvatars();

            expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
            expect(component.visibleAvatars[CENTER_INDEX]).toEqual(mockPlayerAvatars[CHARACTER_INDEX2]); // Center should be current
        });

        it('should handle edge cases when current index is at start', () => {
            component.currentAvatarIndex = CHARACTER_INDEX0;

            component.updateVisibleAvatars();

            expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
            expect(component.visibleAvatars[CENTER_INDEX]).toEqual(mockPlayerAvatars[CHARACTER_INDEX0]); // Center should be first avatar
        });

        it('should handle edge cases when current index is at end', () => {
            component.currentAvatarIndex = mockPlayerAvatars.length - 1;

            component.updateVisibleAvatars();

            expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
            expect(component.visibleAvatars[CENTER_INDEX]).toEqual(mockPlayerAvatars[mockPlayerAvatars.length - 1]); // Center should be last avatar
        });
    });

    describe('isActive', () => {
        it('should return true for center index', () => {
            expect(component.isActive(CHARACTER_INDEX2)).toBe(true);
        });

        it('should return false for non-center indices', () => {
            expect(component.isActive(CHARACTER_INDEX0)).toBe(false);
            expect(component.isActive(CHARACTER_INDEX1)).toBe(false);
            expect(component.isActive(CHARACTER_INDEX3)).toBe(false);
            expect(component.isActive(CHARACTER_INDEX4)).toBe(false);
        });
    });

    describe('sendChoice', () => {
        beforeEach(() => {
            component.playerAvatars = [...mockPlayerAvatars];
            component.updateVisibleAvatars();
        });

        it('should emit avatarSelected event when clicking on active (center) avatar', () => {
            const centerAvatar = mockPlayerAvatars[CHARACTER_INDEX0];
            spyOn(component.avatarSelected, 'emit');

            component.sendChoice(centerAvatar, CENTER_INDEX);

            expect(component.avatarSelected.emit).toHaveBeenCalledWith({
                avatar: centerAvatar,
                visibleIndex: CENTER_INDEX,
                isCenter: true,
            });
        });

        it('should emit avatarSelected event and navigate when clicking non-center avatar', () => {
            component.currentAvatarIndex = CHARACTER_INDEX2;
            const initialIndex = component.currentAvatarIndex;
            spyOn(component.avatarSelected, 'emit');

            component.sendChoice(mockPlayerAvatars[CHARACTER_INDEX0], CHARACTER_INDEX1); // Click on left side

            expect(component.currentAvatarIndex).not.toBe(initialIndex);
            expect(component.avatarSelected.emit).toHaveBeenCalledWith({
                avatar: mockPlayerAvatars[CHARACTER_INDEX0],
                visibleIndex: CHARACTER_INDEX1,
                isCenter: false,
            });
        });

        it('should update visible avatars after navigation', () => {
            spyOn(component, 'updateVisibleAvatars');

            component.sendChoice(mockPlayerAvatars[CHARACTER_INDEX0], CHARACTER_INDEX1);

            expect(component.updateVisibleAvatars).toHaveBeenCalled();
        });
    });

    describe('Random Avatar Selection', () => {
        it('should react to randomAvatarIndex signal changes', fakeAsync(() => {
            component.playerAvatars = [...mockPlayerAvatars];
            fixture.detectChanges();
            spyOn(component.avatarSelected, 'emit');

            fixture.componentRef.setInput('randomAvatarIndex', CHARACTER_INDEX3);
            tick();

            expect(component.currentAvatarIndex).toBe(CHARACTER_INDEX3);
            expect(component.avatarSelected.emit).toHaveBeenCalledWith({
                avatar: mockPlayerAvatars[CHARACTER_INDEX3],
                visibleIndex: CENTER_INDEX,
                isCenter: true,
            });
        }));

        it('should update visible avatars when random index changes', fakeAsync(() => {
            component.playerAvatars = [...mockPlayerAvatars];
            fixture.detectChanges();

            fixture.componentRef.setInput('randomAvatarIndex', CHARACTER_INDEX4);
            tick();

            expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
            expect(component.visibleAvatars[CENTER_INDEX]).toEqual(mockPlayerAvatars[CHARACTER_INDEX4]);
        }));
    });

    describe('Integration Tests', () => {
        beforeEach(async () => {
            mockConfigService.isLoaded = true;

            spyOn(window, 'setInterval').and.callFake(((callback: TimerHandler) => {
                if (typeof callback === 'function') {
                    callback();
                }
                return INTERVAL_DELAY;
            }) as typeof setInterval);

            spyOn(window, 'clearInterval');

            component.ngOnInit();
            fixture.detectChanges();
            await fixture.whenStable();
        });

        it('should render player cards', () => {
            expect(component.visibleAvatars.length).toBe(VISIBLE_CHARACTERS_COUNT);
            const playerCards = fixture.debugElement.queryAll(By.css('app-player-card'));
            expect(playerCards.length).toBe(VISIBLE_CHARACTERS_COUNT);
        });

        it('should have navigation buttons', () => {
            const buttons = fixture.debugElement.queryAll(By.css('button'));
            expect(buttons.length).toBe(NAVIGATION_BUTTONS_COUNT);

            const prevButton = buttons[0];
            const nextButton = buttons[1];

            expect(prevButton.nativeElement.textContent.trim()).toBe('Précédent');
            expect(nextButton.nativeElement.textContent.trim()).toBe('Suivant');
        });

        it('should navigate when clicking prev button', () => {
            component.currentAvatarIndex = CHARACTER_INDEX1;
            const initialIndex = component.currentAvatarIndex;

            const prevButton = fixture.debugElement.query(By.css('button'));
            prevButton.nativeElement.click();
            fixture.detectChanges();

            expect(component.currentAvatarIndex).toBe(initialIndex - 1);
        });

        it('should navigate when clicking next button', () => {
            const initialIndex = component.currentAvatarIndex;

            const buttons = fixture.debugElement.queryAll(By.css('button'));
            const nextButton = buttons[CHARACTER_INDEX1];
            nextButton.nativeElement.click();
            fixture.detectChanges();

            expect(component.currentAvatarIndex).toBe((initialIndex + 1) % mockPlayerAvatars.length);
        });

        it('should apply active class to center avatar card', () => {
            const avatarCards = fixture.debugElement.queryAll(By.css('.avatar-card'));
            const centerCard = avatarCards[CENTER_INDEX];

            expect(centerCard.nativeElement.classList).toContain('active');
        });

        it('should not apply active class to non-center avatar cards', () => {
            const avatarCards = fixture.debugElement.queryAll(By.css('.avatar-card'));

            expect(avatarCards[CHARACTER_INDEX0].nativeElement.classList).not.toContain('active');
            expect(avatarCards[CHARACTER_INDEX1].nativeElement.classList).not.toContain('active');
            expect(avatarCards[CHARACTER_INDEX3].nativeElement.classList).not.toContain('active');
            expect(avatarCards[CHARACTER_INDEX4].nativeElement.classList).not.toContain('active');
        });

        it('should handle avatar card clicks', () => {
            spyOn(component, 'sendChoice');

            const avatarCards = fixture.debugElement.queryAll(By.css('.avatar-card'));
            const firstCard = avatarCards[CHARACTER_INDEX0];

            firstCard.nativeElement.click();
            fixture.detectChanges();

            expect(component.sendChoice).toHaveBeenCalledWith(component.visibleAvatars[CHARACTER_INDEX0], CHARACTER_INDEX0);
        });
    });
});
