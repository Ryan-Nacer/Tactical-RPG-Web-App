import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, TextOnlySnackBar } from '@angular/material/snack-bar';

type NotificationLevel = 'info' | 'success' | 'warning' | 'error';

type NotificationOptions = Omit<MatSnackBarConfig, 'panelClass'> & {
    action?: string;
    panelClass?: string[];
};

const DEFAULT_DURATION_MS: Record<NotificationLevel, number> = {
    info: 4000,
    success: 4000,
    warning: 6000,
    error: 7000,
};

@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    private readonly snackBar = inject(MatSnackBar);

    show(message: string, level: NotificationLevel = 'info', options: NotificationOptions = {}): MatSnackBarRef<TextOnlySnackBar> {
        const {
            action = '',
            duration = DEFAULT_DURATION_MS[level],
            panelClass = [],
            horizontalPosition = 'center',
            verticalPosition = 'top',
            ...config
        } = options;

        return this.snackBar.open(message, action, {
            ...config,
            duration,
            horizontalPosition,
            verticalPosition,
            panelClass: ['snack-notification', `snack-${level}`, ...panelClass],
        });
    }

    info(message: string, options?: NotificationOptions): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, 'info', options);
    }

    success(message: string, options?: NotificationOptions): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, 'success', options);
    }

    warning(message: string, options?: NotificationOptions): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, 'warning', options);
    }

    error(message: string, options?: NotificationOptions): MatSnackBarRef<TextOnlySnackBar> {
        return this.show(message, 'error', options);
    }
}
