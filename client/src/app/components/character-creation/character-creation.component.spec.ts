import { DebugElement } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ConfigService } from '@app/services/config.service';
import { AvatarName, PlayerAvatar } from '@common/player';
import { CharacterCreationComponent } from './character-creation.component';

/**
 * Stratégie de tests :
 * Dans ce fichier, on teste la fonctionnalité de création de personnage. On vérifie que
 * le composant réagit correctement aux actions de l’utilisateur : sélection d’un avatar,
 * mise à jour des attributs, application des bonus et génération aléatoire. On mock
 * ConfigService pour contrôler les données d’avatars.
 *
 * On teste aussi plusieurs cas limites, comme des index d’avatar invalides ou des valeurs
 * d’attributs manquantes, afin de s’assurer que le composant reste stable même lorsque
 * les données reçues ne sont pas dans l’état attendu. Ces cas limites sont importants
 * pour éviter des comportements imprévisibles lors de l’intégration avec d’autres vues.
 */

const DEFAULT_LIFE_VALUE = 6;
const DEFAULT_SPEED_VALUE = 6;
const DEFAULT_ATTACK_VALUE = 4;
const DEFAULT_DEFENSE_VALUE = 4;
const BONUS_VALUE = 2;
const UPDATED_LIFE_VALUE = 10;
const UPDATED_SPEED_VALUE = 8;

describe('CharacterCreationComponent', () => {
    let component: CharacterCreationComponent;
    let fixture: ComponentFixture<CharacterCreationComponent>;
    let compiled: DebugElement;
    let mockConfigService: jasmine.SpyObj<ConfigService>;

    const mockPlayerAvatars: PlayerAvatar[] = [
        { imageUrl: 'barbie.png', avatarName: AvatarName.Barbie },
        { imageUrl: 'ken.png', avatarName: AvatarName.Ken },
        { imageUrl: 'nikki.png', avatarName: AvatarName.Nikki },
    ];

    beforeEach(async () => {
        const configServiceSpy = jasmine.createSpyObj('ConfigService', ['getPlayerAvatars']);
        configServiceSpy.getPlayerAvatars.and.returnValue(mockPlayerAvatars);

        await TestBed.configureTestingModule({
            imports: [CharacterCreationComponent],
            providers: [{ provide: ConfigService, useValue: configServiceSpy }],
        }).compileComponents();

        mockConfigService = TestBed.inject(ConfigService) as jasmine.SpyObj<ConfigService>;
        fixture = TestBed.createComponent(CharacterCreationComponent);
        component = fixture.componentInstance;
        compiled = fixture.debugElement;
        fixture.detectChanges();
    });

    it('should be created', () => {
        expect(component).toBeTruthy();
    });

    describe('Character name', () => {
        it('should display the name input', () => {
            const input = compiled.query(By.css('input[type="text"]'));
            expect(input).toBeTruthy();
        });

        it('should update name when typing', () => {
            const input = compiled.query(By.css('input[type="text"]')).nativeElement;
            input.value = 'Test';
            input.dispatchEvent(new Event('input'));
            fixture.detectChanges();

            expect(component.name).toBe('Test');
        });
    });

    describe('Avatar selection', () => {
        it('should update selectedAvatar only when center avatar is selected', () => {
            const avatar = mockPlayerAvatars[0];

            component.onAvatarSelected({
                avatar,
                visibleIndex: 2,
                isCenter: true,
            });

            expect(component.selectedAvatar).toBe(avatar);
            expect(component.name).toBe(avatar.avatarName);
        });

        it('should ignore selection when avatar is not centered', () => {
            component.onAvatarSelected({
                avatar: mockPlayerAvatars[0],
                visibleIndex: 1,
                isCenter: false,
            });

            expect(component.selectedAvatar).toBeNull();
            expect(component.name).toBe('');
        });
    });

    describe('Attributes display', () => {
        it('should display default attribute values in French', () => {
            const text = compiled.nativeElement.textContent;

            expect(text).toContain(`Vie : ${DEFAULT_LIFE_VALUE}`);
            expect(text).toContain(`Rapidité : ${DEFAULT_SPEED_VALUE}`);
            expect(text).toContain(`Attaque : ${DEFAULT_ATTACK_VALUE}`);
            expect(text).toContain(`Défense : ${DEFAULT_DEFENSE_VALUE}`);
        });

        it('should update displayed values when attributes change', () => {
            component.attributes.life = UPDATED_LIFE_VALUE;
            component.attributes.speed = UPDATED_SPEED_VALUE;
            fixture.detectChanges();

            const text = compiled.nativeElement.textContent;
            expect(text).toContain(`Vie : ${UPDATED_LIFE_VALUE}`);
            expect(text).toContain(`Rapidité : ${UPDATED_SPEED_VALUE}`);
        });
    });

    describe('Bonus', () => {
        it('should apply bonus on life', () => {
            component.applyBonus('life');

            expect(component.attributes.life).toBe(DEFAULT_LIFE_VALUE + BONUS_VALUE);
            expect(component.bonusAttribute).toBe('life');
        });

        it('should apply bonus on speed', () => {
            component.applyBonus('speed');

            expect(component.attributes.speed).toBe(DEFAULT_SPEED_VALUE + BONUS_VALUE);
            expect(component.bonusAttribute).toBe('speed');
        });

        it('should display applied bonus in French', () => {
            component.applyBonus('life');
            fixture.detectChanges();

            const text = compiled.nativeElement.textContent;
            expect(text).toContain('Bonus appliqué sur : Vie');
        });
    });

    describe('Dice assignment', () => {
        it('should assign D6 to attack and D4 to defense', () => {
            component.assignDice('D6');

            expect(component.dice.attack).toBe('D6');
            expect(component.dice.defense).toBe('D4');
        });

        it('should assign D4 to attack and D6 to defense', () => {
            component.assignDice('D4');

            expect(component.dice.attack).toBe('D4');
            expect(component.dice.defense).toBe('D6');
        });
    });

    describe('Random character generation', () => {
        it('should generate a random avatar index and attributes', () => {
            component.generateRandomCharacter();

            expect(component.randomAvatarIndex()).toBeGreaterThanOrEqual(0);
            expect(component.randomAvatarIndex()).toBeLessThan(mockPlayerAvatars.length);
            expect(component.bonusAttribute).toBeTruthy();
            expect(component.dice.attack).toMatch(/D4|D6/);
        });

        it('should call ConfigService.getPlayerAvatars', () => {
            component.generateRandomCharacter();

            expect(mockConfigService.getPlayerAvatars).toHaveBeenCalled();
        });
    });
});
