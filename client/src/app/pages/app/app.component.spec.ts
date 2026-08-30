import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { AppComponent } from '@app/pages/app/app.component';

/**
 * Strategie :
 * - tester AppComponent comme conteneur racine de l'application Angular
 * - verifier sa creation et la presence du routeur dans le template
 *
 * Cas limites cibles :
 * - aucun cas limite metier, le composant doit surtout rester montable avec le routeur
 */
describe('AppComponent', () => {
    let fixture: ComponentFixture<AppComponent>;
    let component: AppComponent;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([])],
        }).compileComponents();

        fixture = TestBed.createComponent(AppComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create the app', () => {
        expect(component).toBeTruthy();
    });

    it('should render the app content container', () => {
        const content = fixture.debugElement.query(By.css('.app-content'));
        expect(content).toBeTruthy();
    });

    it('should render the router outlet', () => {
        const routerOutlet = fixture.debugElement.query(By.css('router-outlet'));
        expect(routerOutlet).toBeTruthy();
    });
});
