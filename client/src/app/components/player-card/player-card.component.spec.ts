import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AvatarName, PlayerAvatar } from '@common/player';
import { PlayerCardComponent } from './player-card.component';

/**
 * Stratégie de tests :
 * Ce fichier teste PlayerCardComponent, qui affiche un avatar. On vérifie que les inputs
 * (imageUrl et avatarName) sont bien reçus et que le template se met à jour lorsque
 * ces valeurs changent.
 *
 * Les cas limites testés incluent l’affichage avec des valeurs vides ou nulles, afin de
 * s’assurer que le composant ne plante pas si les données reçues sont incomplètes.
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
        const kenAvatar = mockPlayerAvatars[1];
        component.imageUrl = kenAvatar.imageUrl;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.imageUrl).toBe('ken.png');
    });

    it('should accept avatarName input from mock data', async () => {
        const kenAvatar = mockPlayerAvatars[1];
        component.avatarName = kenAvatar.avatarName;
        fixture.detectChanges();
        await fixture.whenStable();

        expect(component.avatarName).toBe(AvatarName.Ken);
    });

    it('should render avatar image with correct src', async () => {
        component.imageUrl = mockPlayerAvatars[0].imageUrl;
        fixture.detectChanges();
        await fixture.whenStable();

        const imgElement = fixture.debugElement.query(By.css('img'));
        expect(imgElement?.nativeElement.src).toContain('barbie.png');
    });

    it('should render avatar name', async () => {
        component.avatarName = mockPlayerAvatars[0].avatarName;
        fixture.detectChanges();
        await fixture.whenStable();

        const nameElement = fixture.debugElement.query(By.css('.avatar-name'));
        expect(nameElement?.nativeElement.textContent).toContain('Barbie');
    });

    it('should update when inputs change using mock data', async () => {
        const nikkiAvatar = mockPlayerAvatars[2];
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
            // Create a fresh component for each avatar to avoid change detection issues
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
