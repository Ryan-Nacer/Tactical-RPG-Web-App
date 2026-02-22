import { TestBed } from '@angular/core/testing';
import { AppComponent } from '@app/pages/app/app.component';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

describe('AppComponent', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [provideRouter([{ path: '**', component: AppComponent }])],
        }).compileComponents();

        const harness = await RouterTestingHarness.create();
        await harness.navigateByUrl('/', AppComponent);
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(AppComponent);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });
});
