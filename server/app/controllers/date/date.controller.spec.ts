import { DateController } from '@app/controllers/date/date.controller';
import { DateService } from '@app/services/date/date.service';
import { Message } from '@common/message';
import { Test, TestingModule } from '@nestjs/testing';
import { SinonStubbedInstance, createStubInstance } from 'sinon';

/**
 * Strategie :
 * - verifier que DateController delegue entierement la production de l'heure a DateService
 * - verifier la forme de la reponse exposee par la route
 *
 * Cas limites cibles :
 * - aucun calcul supplementaire dans le controleur
 * - reutilisation directe de la valeur retournee par le service
 *
 * Ce test reste simple car le controleur n'a qu'une responsabilite de delegation.
 */
describe('DateController', () => {
    let controller: DateController;
    let dateService: SinonStubbedInstance<DateService>;

    beforeEach(async () => {
        dateService = createStubInstance(DateService);
        const module: TestingModule = await Test.createTestingModule({
            controllers: [DateController],
            providers: [
                {
                    provide: DateService,
                    useValue: dateService,
                },
            ],
        }).compile();

        controller = module.get<DateController>(DateController);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    it('dateInfo() should return current time', async () => {
        const fakeDateInfo: Message = {
            title: 'temps',
            body: new Date().toString(),
        };
        dateService.currentTime.returns(fakeDateInfo.body);

        const dateInfo = controller.dateInfo();
        expect(dateService.currentTime.calledOnce).toBe(true);
        expect(dateInfo).toEqual(fakeDateInfo);
    });
});
