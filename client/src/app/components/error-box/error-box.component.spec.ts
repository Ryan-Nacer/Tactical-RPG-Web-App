import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ErrorBoxComponent } from './error-box.component';

const FIRST_INDEX = 0;
const SECOND_INDEX = 1;
const THIRD_INDEX = 2;

describe('ErrorBoxComponent', () => {
    let component: ErrorBoxComponent;
    let fixture: ComponentFixture<ErrorBoxComponent>;

    const mockErrors = ['Error 1', 'Error 2', 'Error 3'];

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ErrorBoxComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ErrorBoxComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should not display error box when errors array is empty', () => {
        component.errors = [];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const errorBox = compiled.querySelector('.error-box');
        expect(errorBox).toBeNull();
    });

    it('should display error box when errors exist', () => {
        component.errors = [mockErrors[FIRST_INDEX]];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const errorBox = compiled.querySelector('.error-box');
        expect(errorBox).toBeTruthy();
    });

    it('should display the title "Erreurs"', () => {
        component.errors = [mockErrors[FIRST_INDEX]];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const title = compiled.querySelector('.title');
        expect(title).toBeTruthy();
        expect(title?.textContent).toContain('Erreurs');
    });

    it('should display all error messages in correct order \
        with the correct error message content', () => {
        component.errors = mockErrors;
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const listItems = compiled.querySelectorAll('li');
        expect(listItems.length).toBe(component.errors.length);
        expect(listItems[FIRST_INDEX].textContent).toContain('Error 1');
        expect(listItems[SECOND_INDEX].textContent).toContain('Error 2');
        expect(listItems[THIRD_INDEX].textContent).toContain('Error 3');
    });

    it('should have role="alert" for accessibility', () => {
        component.errors = [mockErrors[FIRST_INDEX]];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const errorBox = compiled.querySelector('.error-box');
        expect(errorBox?.getAttribute('role')).toBe('alert');
    });

    it('should update display when errors are added', () => {
        component.errors = [];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const errorBox = compiled.querySelector('.error-box');
        expect(errorBox).toBeNull();

        const newFixture = TestBed.createComponent(ErrorBoxComponent);
        const newComponent = newFixture.componentInstance;
        newComponent.errors = [mockErrors[FIRST_INDEX]];
        newFixture.detectChanges();

        const newCompiled = newFixture.nativeElement as HTMLElement;
        const newErrorBox = newCompiled.querySelector('.error-box');
        expect(newErrorBox).toBeTruthy();
    });

    it('should have ul element when errors exist', () => {
        component.errors = [mockErrors[FIRST_INDEX]];
        fixture.detectChanges();

        const compiled = fixture.nativeElement as HTMLElement;
        const ul = compiled.querySelector('ul');
        expect(ul).toBeTruthy();
    });
});
