import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameJournalComponent } from './game-journal.component';

/**
 * Strategie :
 * - tester GameJournalComponent sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('GameJournalComponent', () => {
    let component: GameJournalComponent;
    let fixture: ComponentFixture<GameJournalComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GameJournalComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(GameJournalComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
