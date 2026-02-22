import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
    let component: FooterComponent;
    let fixture: ComponentFixture<FooterComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FooterComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(FooterComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('should have app-footer class', () => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        const footer = compiled.querySelector('.app-footer');
        expect(footer).toBeTruthy();
    });

    it('should display footer text', () => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        const footerText = compiled.querySelector('footer span');
        expect(footerText).toBeTruthy();
        expect(footerText?.textContent).toContain('2026 Projet LOG2995');
    });

    it('should render footer element', () => {
        fixture.detectChanges();
        const compiled = fixture.nativeElement as HTMLElement;
        const footerElement = compiled.querySelector('footer');
        expect(footerElement).toBeTruthy();
    });
});
