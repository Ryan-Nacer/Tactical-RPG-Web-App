import { TestBed } from '@angular/core/testing';
import { ConfigService } from './config.service';

/**
 * Stratégie de tests :
 * Ce fichier teste la création du ConfigService. Comme ce service ne dépend d’aucune
 * ressource externe, on vérifie simplement qu’il s’instancie correctement.
 *
 * Aucun cas limite n’est testé ici, car le service ne contient pas de logique interne
 * nécessitant une validation particulière. Le test garantit simplement que le service
 * peut être injecté sans erreur.
 */

describe('ConfigService', () => {
    let service: ConfigService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ConfigService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
