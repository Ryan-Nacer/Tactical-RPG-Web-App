import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatResultMessageComponent } from './combat-result-message.component';

/**
 * Strategie :
 * - tester CombatResultMessageComponent sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('CombatResultMessageComponent', () => {
    let component: CombatResultMessageComponent;
    let fixture: ComponentFixture<CombatResultMessageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CombatResultMessageComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CombatResultMessageComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('shows the current player victory message when current player won the combat', () => {
        component.currentPlayerId = 'player-1';
        component.winnerPlayerId = 'player-1';
        component.winnerPlayerName = 'Hote';
        component.isGameWinner = false;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const message = element.querySelector('.message');

        expect(message?.textContent).toContain('Vous avez remporte le combat.');
        expect(message?.classList.contains('winner')).toBeTrue();
        expect(message?.classList.contains('loser')).toBeFalse();
    });

    it('shows the opponent victory message when current player lost the combat', () => {
        component.currentPlayerId = 'player-1';
        component.winnerPlayerId = 'player-2';
        component.winnerPlayerName = 'Invite';
        component.isGameWinner = false;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const message = element.querySelector('.message');

        expect(message?.textContent).toContain('Invite a remporte le combat.');
        expect(message?.classList.contains('loser')).toBeTrue();
        expect(message?.classList.contains('winner')).toBeFalse();
    });

    it('shows the game victory message when the current player wins the match', () => {
        component.currentPlayerId = 'player-1';
        component.winnerPlayerId = 'player-1';
        component.winnerPlayerName = 'Hote';
        component.isGameWinner = true;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const message = element.querySelector('.message');

        expect(message?.textContent).toContain('Vous avez gagne la partie.');
        expect(message?.classList.contains('winner')).toBeTrue();
        expect(message?.classList.contains('loser')).toBeFalse();
    });

    it('uses the winner name when the opponent wins the match', () => {
        component.currentPlayerId = 'player-1';
        component.winnerPlayerId = 'player-2';
        component.winnerPlayerName = 'Invite';
        component.isGameWinner = true;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const message = element.querySelector('.message');

        expect(message?.textContent).toContain('Invite a gagne la partie.');
        expect(message?.classList.contains('loser')).toBeTrue();
        expect(message?.classList.contains('winner')).toBeFalse();
    });

    it('shows a neutral message when the combat ends in a tie', () => {
        component.currentPlayerId = 'player-1';
        component.isTie = true;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const message = element.querySelector('.message');

        expect(message?.textContent).toContain('Le combat se termine par une egalite.');
        expect(message?.classList.contains('neutral')).toBeTrue();
        expect(message?.classList.contains('winner')).toBeFalse();
        expect(message?.classList.contains('loser')).toBeFalse();
    });
});
