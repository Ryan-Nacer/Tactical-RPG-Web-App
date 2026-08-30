import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HeaderComponent } from './header.component';

/**
 * Strategie :
 * - tester HeaderComponent comme composant de navigation minimal
 * - verifier son instanciation avec le routeur fourni par le banc de test
 *
 * Cas limites cibles :
 * - aucun cas limite complexe ici, le composant doit surtout rester montable
 *   dans toutes les pages qui l'importent
 */
describe('HeaderComponent', () => {
    let component: HeaderComponent;
    let fixture: ComponentFixture<HeaderComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HeaderComponent],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(HeaderComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
