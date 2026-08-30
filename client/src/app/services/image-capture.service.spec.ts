import { TestBed } from '@angular/core/testing';
import { of, throwError, firstValueFrom } from 'rxjs';
import { NgxCaptureService } from 'ngx-capture';
import { ImageCaptureService } from './image-capture.service';

type ImageCaptureServiceWithPrivate = {
    compressDataUrl: (dataUrl: string, maxWidth?: number, quality?: number) => Promise<string>;
};

/**
 * Strategie :
 * - tester ImageCaptureService comme adaptateur autour de NgxCaptureService
 * - verifier la capture nominale et la compression appliquee avant la sauvegarde
 *
 * Cas limites cibles :
 * - erreur de capture provenant de la dependance externe
 * - erreurs de compression qui doivent etre propagees
 */
describe('ImageCaptureService', () => {
    let service: ImageCaptureService;
    let ngxCaptureServiceMock: jasmine.SpyObj<NgxCaptureService>;

    beforeEach(() => {
        ngxCaptureServiceMock = jasmine.createSpyObj('NgxCaptureService', ['getImage']);

        TestBed.configureTestingModule({
            providers: [ImageCaptureService, { provide: NgxCaptureService, useValue: ngxCaptureServiceMock }],
        });

        service = TestBed.inject(ImageCaptureService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('captureImage calls getImage with (element, true)', async () => {
        const element = document.createElement('div');

        ngxCaptureServiceMock.getImage.and.returnValue(of('data:image/png;base64,AAA'));

        const servicePriv = service as unknown as ImageCaptureServiceWithPrivate;

        spyOn(servicePriv, 'compressDataUrl').and.callFake(() => {
            return Promise.resolve('data:image/jpeg;base64,COMPRESSED');
        });

        await firstValueFrom(service.captureImage(element));

        expect(ngxCaptureServiceMock.getImage).toHaveBeenCalledWith(element, true);
    });

    it('captureImage propagates an error when getImage fails', async () => {
        const element = document.createElement('div');
        ngxCaptureServiceMock.getImage.and.returnValue(throwError(() => new Error('getImage failed')));

        await expectAsync(firstValueFrom(service.captureImage(element))).toBeRejected();
    });
});
