import { Injectable } from '@angular/core';
import { NgxCaptureService } from 'ngx-capture';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root',
})
export class ImageCaptureService {
    private static readonly maxWidth = 300;
    private static readonly jpegQuality = 0.8;

    private static readonly defaultWidth = 500;
    private static readonly defaultQuality = 0.75;
    constructor(private readonly ngxCaptureService: NgxCaptureService) {}

    captureImage(element: HTMLElement): Observable<string> {
        return this.ngxCaptureService
            .getImage(element, true)
            .pipe(switchMap((image) => from(this.compressDataUrl(image, ImageCaptureService.maxWidth, ImageCaptureService.jpegQuality))));
    }

    // Implémentée avec l’aide de ChatGPT
    // Fonction utilitaire pour compresser une image capturée côté client
    private compressDataUrl(
        dataUrl: string,
        maxWidth = ImageCaptureService.defaultWidth,
        quality = ImageCaptureService.defaultQuality,
    ): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = () => {
                const originalWidth = img.width;
                const originalHeight = img.height;

                const targetWidth = Math.min(maxWidth, originalWidth);
                const ratio = targetWidth / originalWidth;
                const targetHeight = Math.round(originalHeight * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Impossible de créer le contexte canvas'));
                    return;
                }

                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

                const jpegDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(jpegDataUrl);
            };

            img.onerror = () => reject(new Error('Impossible de charger l’image à compresser'));
            img.src = dataUrl;
        });
    }
}
