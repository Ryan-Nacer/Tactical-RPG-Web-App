import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunicationService } from '@app/services/communication.service';
import { ConfigService } from '@app/services/config.service';
import { NotificationService } from '@app/services/notifications/notification.service';
import { Message } from '@common/message';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

const WAIT_ROOM_NOTICE_KEY = 'wait-room-notice';
const HOME_REDIRECT_NOTICE_KEY = 'home-redirect-notice';
const HOME_REDIRECT_NOTICE_LEVEL_KEY = 'home-redirect-notice-level';

@Component({
    selector: 'app-main-page',
    standalone: true,
    templateUrl: './main-page.component.html',
    styleUrls: ['./main-page.component.scss'],
    imports: [RouterLink],
})
export class MainPageComponent implements OnInit {
    readonly title: string = 'LOG2995';
    readonly config = inject(ConfigService);
    private readonly communicationService = inject(CommunicationService);
    private readonly notificationService = inject(NotificationService);
    message: BehaviorSubject<string> = new BehaviorSubject<string>('');
    waitRoomNotice = '';

    ngOnInit(): void {
        const homeRedirectNotice = sessionStorage.getItem(HOME_REDIRECT_NOTICE_KEY);
        const homeRedirectNoticeLevel = sessionStorage.getItem(HOME_REDIRECT_NOTICE_LEVEL_KEY);
        if (homeRedirectNotice) {
            sessionStorage.removeItem(HOME_REDIRECT_NOTICE_KEY);
            sessionStorage.removeItem(HOME_REDIRECT_NOTICE_LEVEL_KEY);
            this.showHomeRedirectNotice(homeRedirectNotice, homeRedirectNoticeLevel);
        }

        const waitRoomNotice = sessionStorage.getItem(WAIT_ROOM_NOTICE_KEY);
        if (!waitRoomNotice) {
            return;
        }

        sessionStorage.removeItem(WAIT_ROOM_NOTICE_KEY);
        this.notificationService.warning(waitRoomNotice);
        this.waitRoomNotice = waitRoomNotice;
    }

    sendTimeToServer(): void {
        const newTimeMessage: Message = {
            title: 'Hello from the client',
            body: 'Time is : ' + new Date().toString(),
        };
        this.communicationService.basicPost(newTimeMessage).subscribe({
            next: (response) => {
                const responseString = `Le serveur a recu la requete a retourne un code ${response.status} : ${response.statusText}`;
                this.message.next(responseString);
                this.notificationService.success(responseString);
            },
            error: (err: HttpErrorResponse) => {
                const responseString = `Le serveur ne repond pas et a retourne : ${err.message}`;
                this.message.next(responseString);
                this.notificationService.error(responseString);
            },
        });
    }

    getMessagesFromServer(): void {
        this.communicationService
            .basicGet()
            .pipe(
                map((message: Message) => {
                    return `${message.title} ${message.body}`;
                }),
            )
            .subscribe((value) => {
                this.message.next(value);
                this.notificationService.info(value);
            });
    }

    private showHomeRedirectNotice(message: string, level: string | null): void {
        switch (level) {
            case 'success':
                this.notificationService.success(message);
                break;
            case 'warning':
                this.notificationService.warning(message);
                break;
            case 'error':
                this.notificationService.error(message);
                break;
            default:
                this.notificationService.info(message);
                break;
        }
    }
}
