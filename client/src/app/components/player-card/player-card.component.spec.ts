import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AvatarName, PlayerAvatar } from '@common/player';
import { PlayerCardComponent } from './player-card.component';

const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const THIRD_INDEX = 2;

/**
 * Strategie :
 * - tester PlayerCardComponent comme composant presentational recevant ses donnees par input
 * - verifier le rendu et la mise a jour quand les inputs changent
 *
 * Cas limites cibles :
 * - changement dynamique des inputs
 * - compatibilite avec plusieurs avatars de reference
 */
describe('PlayerCardComponent', () => {
    let component: PlayerCardComponent;
    let fixture: ComponentFixture<PlayerCardComponent>;

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
        await TestBed.configureTestingModule({
            imports: [PlayerCardComponent],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(PlayerCardComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should have default input properties', () => {
        expect(component.imageUrl).toBe('');
        expect(component.avatarName).toBeUndefined();
    });

    it('should accept imageUrl input from mock data', async () => {
        const kenAvatar = mockPlayerAvatars[SECOND_INDEX];
        component.imageUrl = kenAvatar.imageUrl;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.imageUrl).toBe('ken.png');
    });

    it('should accept avatarName input from mock data', async () => {
        const kenAvatar = mockPlayerAvatars[SECOND_INDEX];
        component.avatarName = kenAvatar.avatarName;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.avatarName).toBe(AvatarName.Ken);
    });

    it('should render avatar image with correct src', async () => {
        component.imageUrl = mockPlayerAvatars[FIRST_INDEX].imageUrl;
        fixture.detectChanges();
        await fixture.whenStable();

        const imgElement = fixture.debugElement.query(By.css('img'));
        expect(imgElement?.nativeElement.src).toContain('barbie.png');
    });
    /*
    it('should render avatar name', async () => {
        component.avatarName = mockPlayerAvatars[FIRST_INDEX].avatarName;
        fixture.detectChanges();
        await fixture.whenStable();

        const nameElement = fixture.debugElement.query(By.css('.avatar-name'));
        expect(nameElement?.nativeElement.textContent).toContain('Barbie');
    });*/
    // je ne veux plus afficher les noms des avatars
    //car je trouve que c'est mélangeant entre les noms des avatars
    // et les noms des personnages

    it('should update when inputs change using mock data', async () => {
        const nikkiAvatar = mockPlayerAvatars[THIRD_INDEX];
        component.imageUrl = nikkiAvatar.imageUrl;
        component.avatarName = nikkiAvatar.avatarName;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.imageUrl).toBe('nikki.png');
        expect(component.avatarName).toBe(AvatarName.Nikki);

        const imgElement = fixture.debugElement.query(By.css('img'));
        expect(imgElement?.attributes['src']).toBe('nikki.png');
    });

    it('should work with all mock avatars', async () => {
        for (const avatar of mockPlayerAvatars) {
            const tempFixture = TestBed.createComponent(PlayerCardComponent);
            const tempComponent = tempFixture.componentInstance;

            tempComponent.imageUrl = avatar.imageUrl;
            tempComponent.avatarName = avatar.avatarName;
            tempFixture.detectChanges();
            await tempFixture.whenStable();

            expect(tempComponent.imageUrl).toBe(avatar.imageUrl);
            expect(tempComponent.avatarName).toBe(avatar.avatarName);
        }
    });
});
