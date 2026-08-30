import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Config } from '@app/interfaces/config';
import { TileId } from '@common/game';
import { AvatarName, PlayerAvatar } from '@common/player';
import { ConfigService } from './config.service';

/**
 * Strategie :
 * - verifier le chargement initial de la configuration Sprint 1 depuis assets/config.json
 * - verifier les transformations appliquees aux avatars et les getters utilises par le client
 *
 * Cas limites cibles :
 * - les avatars doivent conserver leur AvatarName tout en recevant le prefixe local attendu
 * - les getters doivent retourner exactement les valeurs chargees pour eviter un decalage
 *   entre la configuration et l'interface
 */
describe('ConfigService', () => {
    let service: ConfigService;
    let httpMock: HttpTestingController;

    const NUMBER_OF_AVATARS = 2;
    const GAME_DESCRIPTION_LIMIT = 150;
    const GAME_NAME_LIMIT = 40;

    const getMockConfig = (): Config => ({
        title: 'Test Game',
        logo: 'test-logo.png',
        teamNames: ['Barbie', 'Raquelle', 'Blissa'],
        playerAvatars: [
            { imageUrl: 'avatar1.png', avatarName: AvatarName.Barbie },
            { imageUrl: 'avatar2.png', avatarName: AvatarName.Blissa },
        ] as PlayerAvatar[],
        toolDescriptionMap: {
            base: '',
            water: '',
            ice: '',
            wall: '',
            flag: '',
            door: '',
            start: '',
            heal: '',
            combat: '',
        },
        gameDescriptionLimit: GAME_DESCRIPTION_LIMIT,
        gameNameLimit: GAME_NAME_LIMIT,
    });

    const initializeService = () => {
        service = TestBed.inject(ConfigService);
        const request = httpMock.expectOne('assets/config.json');
        request.flush(getMockConfig());
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [ConfigService, provideHttpClient(), provideHttpClientTesting()],
        });

        httpMock = TestBed.inject(HttpTestingController);
        initializeService();
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should load config from assets on initialization', () => {
        expect(service.isLoaded).toBe(true);
        expect(service.getTitle()).toBe('Test Game');
        expect(service.getLogoPath()).toBe('assets/test-logo.png');
    });

    it('should transform player avatar imageUrls with correct path', () => {
        const avatars = service.getPlayerAvatars();
        expect(avatars[0].imageUrl).toBe('assets/characters/avatar1.png');
        expect(avatars[1].imageUrl).toBe('assets/characters/avatar2.png');
    });

    it('should preserve avatar names after transformation', () => {
        const avatars = service.getPlayerAvatars();
        expect(avatars[0].avatarName).toBe(AvatarName.Barbie);
        expect(avatars[1].avatarName).toBe(AvatarName.Blissa);
    });

    it('should return team names', () => {
        const teamNames = service.getTeamNames();
        expect(teamNames).toEqual(['Barbie', 'Raquelle', 'Blissa']);
    });

    it('should return logo path with prefix', () => {
        const logoPath = service.getLogoPath();
        expect(logoPath).toBe('assets/test-logo.png');
    });

    it('should return title', () => {
        const title = service.getTitle();
        expect(title).toBe('Test Game');
    });

    it('should set isLoaded to true after config is loaded', () => {
        expect(service.isLoaded).toBe(true);
    });

    it('should return player avatars array', () => {
        const avatars = service.getPlayerAvatars();
        expect(avatars).toBeDefined();
        expect(avatars.length).toBe(NUMBER_OF_AVATARS);
        expect(avatars[0].avatarName).toBe(AvatarName.Barbie);
        expect(avatars[1].avatarName).toBe(AvatarName.Blissa);
    });

    it('should return configured limits and tool descriptions', () => {
        expect(service.getGameDescriptionLimit()).toBe(GAME_DESCRIPTION_LIMIT);
        expect(service.getGameNameLimit()).toBe(GAME_NAME_LIMIT);
        expect(service.getToolDescription(TileId.Base)).toBe('');
    });
});
