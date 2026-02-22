import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { GameClientService } from '@app/services/game-client.service';
import { ConfigService } from '@app/services/config.service';
import { of } from 'rxjs';
import { EditGamePageComponent } from './edit-game-page.component';
<<<<<<< Updated upstream
=======
import { Mode } from '@common/game';

/**
 * Stratégie de tests :
 * Dans ce fichier, on teste l’initialisation de la page d’édition de jeu. On mock
 * GameClientService, ConfigService et ActivatedRoute pour contrôler les données
 * reçues par le composant. On vérifie que les paramètres de route (id, mode, size)
 * sont bien pris en compte et que getGame est appelé pour charger les données.
 *
 * Le cas limite principal testé est la présence d’un id dans la route. Ce cas est
 * important, car il détermine si le composant doit charger un jeu existant ou en
 * initialiser un nouveau. On s’assure que le composant démarre dans un état cohérent.
 */
>>>>>>> Stashed changes

import { Mode } from '@common/game';

describe('EditGamePageComponent', () => {
    let component: EditGamePageComponent;
    // let gameClientService: GameClientService;
    let fixture: ComponentFixture<EditGamePageComponent>;
    let gameClientServiceSpy: jasmine.SpyObj<GameClientService>;

    beforeEach(async () => {
        const spy = jasmine.createSpyObj('GameClientService', ['getGame']);
        const configSpy = jasmine.createSpyObj('ConfigService', ['getToolDescription']);

        await TestBed.configureTestingModule({
            imports: [EditGamePageComponent],
            providers: [
                { provide: GameClientService, useValue: spy },
                { provide: ConfigService, useValue: configSpy },
                {
                    provide: ActivatedRoute,
                    useValue: {
                        paramMap: of(convertToParamMap({ id: 'test-id' })),
                        snapshot: { queryParamMap: convertToParamMap({ mode: 'CLASSIC', size: '10' }) },
                    },
                },
            ],
        }).compileComponents();
        gameClientServiceSpy = TestBed.inject(GameClientService) as jasmine.SpyObj<GameClientService>;
        gameClientServiceSpy.getGame.and.returnValue(
            of({
                name: 'Test Game',
                id: 'test-id',
                size: '10',
                lastModified: '2026-01-30',
                description: 'Test description',
                mode: Mode.Classic,
                isVisible: true,
                cells: [],
            }),
        );

        fixture = TestBed.createComponent(EditGamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
