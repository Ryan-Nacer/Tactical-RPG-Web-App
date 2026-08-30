import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GameSetupData } from '@app/interfaces/game';
import { GridSize, Mode } from '@common/game';
import { GameSetupFormComponent } from './game-setup-form.component';

const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const SIZE_OPTION_COUNT = 3;

/**
 * Strategie :
 * - tester GameSetupFormComponent comme formulaire Sprint 1 minimal qui capture
 *   les choix de mode et de taille avant la creation d'un jeu
 * - verifier surtout les valeurs par defaut, les interactions formulaire et la
 *   forme exacte de l'evenement emis au parent
 *
 * Cas limites cibles :
 * - le formulaire doit partir sur les valeurs par defaut attendues pour eviter
 *   une creation de jeu partiellement configuree
 * - changer seulement un des deux champs ne doit pas ecraser l'autre
 * - des soumissions successives doivent emettre l'etat courant complet a chaque fois
 */
describe('GameSetupFormComponent', () => {
    let component: GameSetupFormComponent;
    let fixture: ComponentFixture<GameSetupFormComponent>;

    const createComponent = async () => {
        fixture = TestBed.createComponent(GameSetupFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameSetupFormComponent],
        }).compileComponents();

        await createComponent();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should expose the Sprint 1 defaults for mode and size', () => {
        expect(component.mode).toBe(Mode.Classic);
        expect(component.size).toBe(GridSize.Small);
    });

    it('should render the available game setup choices', () => {
        const modeInputs = fixture.debugElement.queryAll(By.css('input[name="mode"]'));
        const sizeInputs = fixture.debugElement.queryAll(By.css('input[name="size"]'));
        const submitButton = fixture.debugElement.query(By.css('.primaryBtn'));

        expect(modeInputs.length).toBe(2);
        expect(sizeInputs.length).toBe(SIZE_OPTION_COUNT);
        expect(submitButton.nativeElement.textContent.trim()).toBe('Cr\u00E9er le jeu');
    });

    it('should emit the default setup when submitted without changes', () => {
        const emitSpy = spyOn(component.formSubmitted, 'emit');

        component.submit();

        expect(emitSpy).toHaveBeenCalledWith({ mode: Mode.Classic, size: GridSize.Small });
    });

    it('should keep the selected size when only the mode changes', () => {
        const emitSpy = spyOn(component.formSubmitted, 'emit');
        const ctfInput: HTMLInputElement = fixture.debugElement.queryAll(By.css('input[name="mode"]'))[SECOND_INDEX].nativeElement;

        ctfInput.click();
        fixture.detectChanges();
        component.submit();

        expect(component.mode).toBe(Mode.CTF);
        expect(component.size).toBe(GridSize.Small);
        expect(emitSpy).toHaveBeenCalledWith({ mode: Mode.CTF, size: GridSize.Small });
    });

    it('should keep the selected mode when only the size changes', () => {
        const emitSpy = spyOn(component.formSubmitted, 'emit');
        const largeInput: HTMLInputElement = fixture.debugElement.queryAll(By.css('input[name="size"]'))[SECOND_INDEX].nativeElement;

        component.mode = Mode.CTF;
        fixture.detectChanges();
        largeInput.click();
        fixture.detectChanges();
        component.submit();

        expect(component.mode).toBe(Mode.CTF);
        expect(component.size).toBe(GridSize.Medium);
        expect(emitSpy).toHaveBeenCalledWith({ mode: Mode.CTF, size: GridSize.Medium });
    });

    it('should emit each complete setup in order across multiple submissions', () => {
        const emittedData: GameSetupData[] = [];

        component.formSubmitted.subscribe((data) => emittedData.push(data));

        component.submit();
        component.mode = Mode.CTF;
        component.size = GridSize.Large;
        component.submit();

        expect(emittedData).toEqual([
            { mode: Mode.Classic, size: GridSize.Small },
            { mode: Mode.CTF, size: GridSize.Large },
        ]);
        expect(emittedData[FIRST_INDEX].mode).toBe(Mode.Classic);
        expect(emittedData[SECOND_INDEX].size).toBe(GridSize.Large);
    });
});
