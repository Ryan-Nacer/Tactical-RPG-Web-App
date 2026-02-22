import { TestBed } from '@angular/core/testing';
import { of, throwError, firstValueFrom } from 'rxjs';
import { NgxCaptureService } from 'ngx-capture';
import { ImageCaptureService } from './image-capture.service';

type ImageCaptureServiceWithPrivate = {
    compressDataUrl: (dataUrl: string, maxWidth?: number, quality?: number) => Promise<string>;
};

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

    it('devrait être créé', () => {
        expect(service).toBeTruthy();
    });

    it('captureImage appelle getImage avec (element, true)', async () => {
        const element = document.createElement('div');

        ngxCaptureServiceMock.getImage.and.returnValue(of('data:image/png;base64,AAA'));

        const servicePriv = service as unknown as ImageCaptureServiceWithPrivate;

        spyOn(servicePriv, 'compressDataUrl').and.callFake(() => {
            return Promise.resolve('data:image/jpeg;base64,COMPRESSED');
        });

        await firstValueFrom(service.captureImage(element));

        expect(ngxCaptureServiceMock.getImage).toHaveBeenCalledWith(element, true);
    });

    it('captureImage propage une erreur si getImage échoue', async () => {
        const element = document.createElement('div');
        ngxCaptureServiceMock.getImage.and.returnValue(throwError(() => new Error('getImage failed')));

        await expectAsync(firstValueFrom(service.captureImage(element))).toBeRejected();
    });
});
