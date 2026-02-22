import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunicationService } from '@app/services/communication.service';
import { ConfigService } from '@app/services/config.service';
import { Message } from '@common/message';
import { BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
    selector: 'app-main-page',
    standalone: true,
    templateUrl: './main-page.component.html',
    styleUrls: ['./main-page.component.scss'],
    imports: [RouterLink],
})
export class MainPageComponent {
    readonly title: string = 'LOG2995';
    readonly config = inject(ConfigService);
    private readonly communicationService = inject(CommunicationService);
    message: BehaviorSubject<string> = new BehaviorSubject<string>('');

    sendTimeToServer(): void {
        const newTimeMessage: Message = {
            title: 'Hello from the client',
            body: 'Time is : ' + new Date().toString(),
        };
        this.communicationService.basicPost(newTimeMessage).subscribe({
            next: (response) => {
                const responseString = `Le serveur a reçu la requête a retourné un code ${response.status} : ${response.statusText}`;
                this.message.next(responseString);
            },
            error: (err: HttpErrorResponse) => {
                const responseString = `Le serveur ne répond pas et a retourné : ${err.message}`;
                this.message.next(responseString);
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
            .subscribe((value) => this.message.next(value));
    }
}
