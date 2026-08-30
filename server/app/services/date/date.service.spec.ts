import { DateService } from '@app/services/date/date.service';

/**
 * Strategie :
 * - verifier que DateService retourne une representation texte de la date courante
 * - isoler le service du temps reel en figeant Date temporairement
 *
 * Cas limites cibles :
 * - format retourne sous forme de chaine
 * - reutilisation directe de Date.prototype.toString
 *
 * Ce test reste simple car le service n'a qu'une responsabilite tres petite mais il
 * permet d'eviter un trou artificiel de couverture sur un service expose par le serveur.
 */
describe('DateService', () => {
    const isoDate = '2026-03-12T12:34:56.000Z';
    let service: DateService;

    beforeEach(() => {
        service = new DateService();
        jest.useFakeTimers().setSystemTime(new Date(isoDate));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('currentTime should return the current time as a string', () => {
        expect(service.currentTime()).toBe(new Date(isoDate).toString());
    });
});
