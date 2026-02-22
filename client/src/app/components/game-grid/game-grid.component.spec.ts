import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GameGridComponent } from './game-grid.component';

/**
 * Stratégie de tests :
 * Dans ce fichier, on vérifie uniquement que GameGridComponent s’instancie
 * correctement. Comme ce composant est utilisé dans la vue d’édition, il est important
 * de s’assurer qu’il peut être créé sans dépendances externes.
 *
 * Aucun cas limite n’est testé ici, car les tests actuels ne couvrent pas les interactions
 * (clic, drag, shift). Le but est simplement de garantir que le composant peut être
 * chargé et intégré dans les autres vues sans erreur.
 */

describe('GameGridComponent', () => {
    let component: GameGridComponent;
    let fixture: ComponentFixture<GameGridComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameGridComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameGridComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
