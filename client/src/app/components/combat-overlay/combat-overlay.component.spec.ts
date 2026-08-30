import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CombatPosture } from '@common/combat';
import { CombatOverlayComponent } from './combat-overlay.component';

const ATTACKER_DAMAGE = 6;
const DEFENDER_DAMAGE = 3;
const SHARED_COUNTDOWN_SECONDS = 7;
const DANGER_COUNTDOWN_SECONDS = 5;
const NEXT_TURN_NUMBER = 2;
const PREVIOUS_TURN_NUMBER = 1;
const ATTACKER_HEALTH = 6;
const ATTACKER_MAX_HEALTH = 6;
const DEFENDER_HEALTH = 4;
const DEFENDER_MAX_HEALTH = 6;
const ATTACKER_ATTACK_BASE = 4;
const ATTACKER_ATTACK_PENALTY = 0;
const ATTACKER_DEFENSE_BASE = 4;
const ATTACKER_DEFENSE_PENALTY = 0;
const ATTACKER_DICE_RESULT = 4;
const ATTACKER_DEFENSE_DICE_RESULT = 1;
const DEFENDER_ATTACK_BASE = 4;
const DEFENDER_ATTACK_PENALTY = 0;
const DEFENDER_DEFENSE_BASE = 4;
const DEFENDER_DEFENSE_PENALTY = 0;
const DEFENDER_DICE_RESULT = 2;
const DEFENDER_DEFENSE_DICE_RESULT = 3;
const ATTACKER_ATTACK_POSTURE_BONUS = 2;
const ATTACKER_DEFENSE_POSTURE_BONUS = 0;
const DEFENDER_ATTACK_POSTURE_BONUS = 0;
const DEFENDER_DEFENSE_POSTURE_BONUS = 2;
const ATTACKER_ATTACK_TOTAL = 8;
const ATTACKER_DEFENSE_TOTAL = 5;
const DEFENDER_ATTACK_TOTAL = 6;
const DEFENDER_DEFENSE_TOTAL = 7;
const UPDATED_ATTACKER_ATTACK_TOTAL = 10;
const UPDATED_ATTACKER_DEFENSE_TOTAL = 6;
const UPDATED_DEFENDER_ATTACK_TOTAL = 5;
const UPDATED_DEFENDER_DEFENSE_TOTAL = 8;
const AVATAR_COUNT = 2;
const DAMAGE_LABEL_COUNT = 2;
const MIN_ZERO_BONUS_COUNT = 4;
const MIN_BONUS_COUNT = 2;
const BONUS_VALUE = '2';
const ZERO_VALUE = '0';
const ICE_PENALTY_VALUE = 2;
const NEGATIVE_ICE_PENALTY_LABEL = '-2';
const EXPECTED_ATTACKER_VALUES = ['6/6', '4', '4', '4', '1', '2', '0', '0', '0', '8', '5', '1'];
const EXPECTED_DEFENDER_VALUES = ['4/6', '4', '4', '2', '3', '0', '2', '0', '0', '6', '7', '1'];

/**
 * Strategie :
 * - tester CombatOverlayComponent sur ses comportements observables critiques
 * - couvrir les cas nominaux, erreurs et limites qui peuvent casser le flux
 * - garder des scenarios lisibles centres sur l effet attendu cote utilisateur
 */
describe('CombatOverlayComponent', () => {
    let component: CombatOverlayComponent;
    let fixture: ComponentFixture<CombatOverlayComponent>;

    const getCombatantValues = (element: HTMLElement, index: number): string[] => {
        const combatantColumns = Array.from(element.querySelectorAll('.combatant-column'));
        const combatant = combatantColumns[index];
        if (!combatant) {
            return [];
        }

        return Array.from(combatant.querySelectorAll('dd')).map((item) => item.textContent?.trim() ?? '');
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CombatOverlayComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(CombatOverlayComponent);
        component = fixture.componentInstance;
    });

    it('should create', () => {
        fixture.detectChanges();
        expect(component).toBeTruthy();
    });

    it('renders combat participants label', () => {
        component.attackerName = 'Hote';
        component.defenderName = 'Invite';
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const paragraph = element.querySelector('.combat-modal p');
        expect(paragraph?.textContent).toContain('Hote vs Invite');
    });

    it('uses fallback names when no participants are provided', () => {
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const paragraph = element.querySelector('.combat-modal p');
        expect(paragraph?.textContent).toContain('Attaquant vs Defenseur');
    });

    it('displays the shared countdown value from input', () => {
        component.remainingSeconds = SHARED_COUNTDOWN_SECONDS;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const timerValue = element.querySelector('.overlay-timer-value');
        expect(timerValue?.textContent).toContain('00:07');
    });

    it('shows danger timer state when remaining time is 5 seconds or less', () => {
        component.remainingSeconds = DANGER_COUNTDOWN_SECONDS;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const timer = element.querySelector('.overlay-timer');
        expect(timer?.classList.contains('danger')).toBeTrue();
    });

    it('emits selected posture while timer is active', () => {
        const postureSelectedSpy = jasmine.createSpy('postureSelectedSpy');
        component.postureSelected.subscribe(postureSelectedSpy);
        fixture.detectChanges();

        component.choosePosture(CombatPosture.Offensive);

        expect(postureSelectedSpy).toHaveBeenCalledWith(CombatPosture.Offensive);
        expect(component.selectedPosture).toBe(CombatPosture.Offensive);
    });

    it('does not emit posture after timer expires', () => {
        const postureSelectedSpy = jasmine.createSpy('postureSelectedSpy');
        component.postureSelected.subscribe(postureSelectedSpy);
        component.remainingSeconds = 0;
        fixture.detectChanges();
        component.choosePosture(CombatPosture.Defensive);

        expect(postureSelectedSpy).not.toHaveBeenCalled();
        expect(component.selectedPosture).toBeNull();
    });

    it('clears selected posture on new combat turn', () => {
        fixture.detectChanges();
        component.choosePosture(CombatPosture.Offensive);

        component.currentTurnNumber = NEXT_TURN_NUMBER;
        component.ngOnChanges({
            currentTurnNumber: {
                currentValue: NEXT_TURN_NUMBER,
                previousValue: PREVIOUS_TURN_NUMBER,
                firstChange: false,
                isFirstChange: () => false,
            },
        });

        expect(component.selectedPosture).toBeNull();
    });

    it('renders attacker and defender stats in combined view', () => {
        component.attackerName = 'Hote';
        component.defenderName = 'Invite';
        component.attackerAvatarUrl = 'assets/characters/barbie.png';
        component.defenderAvatarUrl = 'assets/characters/barbie.png';
        component.attackerHealth = ATTACKER_HEALTH;
        component.attackerMaxHealth = ATTACKER_MAX_HEALTH;
        component.defenderHealth = DEFENDER_HEALTH;
        component.defenderMaxHealth = DEFENDER_MAX_HEALTH;
        component.attackerAttackBase = ATTACKER_ATTACK_BASE;
        component.attackerAttackPenalty = ATTACKER_ATTACK_PENALTY;
        component.attackerDefenseBase = ATTACKER_DEFENSE_BASE;
        component.attackerDefensePenalty = ATTACKER_DEFENSE_PENALTY;
        component.attackerDiceResult = ATTACKER_DICE_RESULT;
        component.attackerDefenseDiceResult = ATTACKER_DEFENSE_DICE_RESULT;
        component.defenderAttackBase = DEFENDER_ATTACK_BASE;
        component.defenderAttackPenalty = DEFENDER_ATTACK_PENALTY;
        component.defenderDefenseBase = DEFENDER_DEFENSE_BASE;
        component.defenderDefensePenalty = DEFENDER_DEFENSE_PENALTY;
        component.defenderDiceResult = DEFENDER_DICE_RESULT;
        component.defenderDefenseDiceResult = DEFENDER_DEFENSE_DICE_RESULT;
        component.attackerAttackPostureBonus = ATTACKER_ATTACK_POSTURE_BONUS;
        component.attackerDefensePostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        component.defenderAttackPostureBonus = DEFENDER_ATTACK_POSTURE_BONUS;
        component.defenderDefensePostureBonus = DEFENDER_DEFENSE_POSTURE_BONUS;
        component.attackerAttackTotal = ATTACKER_ATTACK_TOTAL;
        component.attackerDefenseTotal = ATTACKER_DEFENSE_TOTAL;
        component.defenderAttackTotal = DEFENDER_ATTACK_TOTAL;
        component.defenderDefenseTotal = DEFENDER_DEFENSE_TOTAL;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const avatars = element.querySelectorAll('.combatant-avatar');
        const attackerValues = getCombatantValues(element, 0);
        const defenderValues = getCombatantValues(element, 1);

        expect(avatars.length).toBe(AVATAR_COUNT);
        expect(attackerValues).toEqual(EXPECTED_ATTACKER_VALUES);
        expect(defenderValues).toEqual(EXPECTED_DEFENDER_VALUES);
    });

    it('shows duel data and posture controls at the same time', () => {
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelector('.combat-duel-view')).toBeTruthy();
        expect(element.querySelector('.posture-actions')).toBeTruthy();
    });

    it('updates totals when combat values change on a new turn', () => {
        fixture.componentRef.setInput('attackerName', 'Hote');
        fixture.componentRef.setInput('defenderName', 'Invite');
        fixture.componentRef.setInput('attackerAttackTotal', ATTACKER_ATTACK_TOTAL);
        fixture.componentRef.setInput('attackerDefenseTotal', ATTACKER_DEFENSE_TOTAL);
        fixture.componentRef.setInput('defenderAttackTotal', DEFENDER_ATTACK_TOTAL);
        fixture.componentRef.setInput('defenderDefenseTotal', DEFENDER_DEFENSE_TOTAL);
        fixture.detectChanges();

        let element = fixture.nativeElement as HTMLElement;
        let attackerValues = getCombatantValues(element, 0);
        let defenderValues = getCombatantValues(element, 1);
        expect(attackerValues[9]).toBe('8');
        expect(attackerValues[10]).toBe('5');
        expect(attackerValues[11]).toBe('1');
        expect(defenderValues[9]).toBe('6');
        expect(defenderValues[10]).toBe('7');
        expect(defenderValues[11]).toBe('1');

        fixture.componentRef.setInput('attackerAttackTotal', UPDATED_ATTACKER_ATTACK_TOTAL);
        fixture.componentRef.setInput('attackerDefenseTotal', UPDATED_ATTACKER_DEFENSE_TOTAL);
        fixture.componentRef.setInput('defenderAttackTotal', UPDATED_DEFENDER_ATTACK_TOTAL);
        fixture.componentRef.setInput('defenderDefenseTotal', UPDATED_DEFENDER_DEFENSE_TOTAL);
        fixture.detectChanges();

        element = fixture.nativeElement as HTMLElement;
        attackerValues = getCombatantValues(element, 0);
        defenderValues = getCombatantValues(element, 1);
        expect(attackerValues[9]).toBe('10');
        expect(attackerValues[10]).toBe('6');
        expect(attackerValues[11]).toBe('2');
        expect(defenderValues[9]).toBe('5');
        expect(defenderValues[10]).toBe('8');
        expect(defenderValues[11]).toBe('0');
    });

    it('shows damage labels near health values when damage is greater than zero', () => {
        fixture.componentRef.setInput('attackerDamageTaken', ATTACKER_DAMAGE);
        fixture.componentRef.setInput('defenderDamageTaken', DEFENDER_DAMAGE);
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelectorAll('.damage-pop').length).toBe(DAMAGE_LABEL_COUNT);
    });

    it('renders attack and defense posture bonuses independently for both players', () => {
        component.attackerAttackPostureBonus = ATTACKER_ATTACK_POSTURE_BONUS;
        component.attackerDefensePostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        component.defenderAttackPostureBonus = DEFENDER_ATTACK_POSTURE_BONUS;
        component.defenderDefensePostureBonus = DEFENDER_DEFENSE_POSTURE_BONUS;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const values = Array.from(element.querySelectorAll('.combatant-column dd')).map((item) => item.textContent?.trim());

        expect(values).toContain(BONUS_VALUE);
        expect(values.filter((value) => value === BONUS_VALUE).length).toBeGreaterThanOrEqual(MIN_BONUS_COUNT);
        expect(values.filter((value) => value === ZERO_VALUE).length).toBeGreaterThanOrEqual(MIN_BONUS_COUNT);
    });

    it('shows zero posture bonuses when no posture bonus is applied', () => {
        component.attackerAttackPostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        component.attackerDefensePostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        component.defenderAttackPostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        component.defenderDefensePostureBonus = ATTACKER_DEFENSE_POSTURE_BONUS;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const values = Array.from(element.querySelectorAll('.combatant-column dd')).map((item) => item.textContent?.trim());

        expect(values.filter((value) => value === ZERO_VALUE).length).toBeGreaterThanOrEqual(MIN_ZERO_BONUS_COUNT);
    });

    it('renders terrain combat penalties as negative values', () => {
        component.attackerAttackPenalty = ICE_PENALTY_VALUE;
        component.attackerDefensePenalty = ICE_PENALTY_VALUE;
        component.defenderAttackPenalty = ICE_PENALTY_VALUE;
        component.defenderDefensePenalty = ICE_PENALTY_VALUE;
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const attackerValues = getCombatantValues(element, 0);
        const defenderValues = getCombatantValues(element, 1);

        expect(attackerValues[7]).toBe(NEGATIVE_ICE_PENALTY_LABEL);
        expect(attackerValues[8]).toBe(NEGATIVE_ICE_PENALTY_LABEL);
        expect(defenderValues[7]).toBe(NEGATIVE_ICE_PENALTY_LABEL);
        expect(defenderValues[8]).toBe(NEGATIVE_ICE_PENALTY_LABEL);
    });

    it('does not render combat profile layout when combat is not active', () => {
        fixture.componentRef.setInput('isCombatActive', false);
        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        expect(element.querySelector('.combat-duel-view')).toBeNull();
        expect(element.querySelector('.combat-player-choice')).toBeNull();
        expect(element.querySelector('.combat-modal h2')).toBeNull();
    });
});
