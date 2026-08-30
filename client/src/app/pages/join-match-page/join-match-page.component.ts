import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommunicationService } from '@app/services/communication.service';
import { RoomSocketService } from '@app/services/room-socket.service';
import { JoinableRoomSummary } from '@common/wait-room';
import { Subscription } from 'rxjs';

const PERCENTAGE_FACTOR = 100;

@Component({
    selector: 'app-join-match-page',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './join-match-page.component.html',
    styleUrl: './join-match-page.component.scss',
})
export class JoinMatchPageComponent implements OnInit, OnDestroy {
    private readonly communicationService = inject(CommunicationService);
    private readonly roomSocketService = inject(RoomSocketService);

    rooms: JoinableRoomSummary[] = [];
    private subscriptions = new Subscription();

    ngOnInit(): void {
        this.subscriptions.add(
            this.communicationService.getJoinableRooms().subscribe((rooms) => {
                this.rooms = rooms;
            }),
        );

        this.subscriptions.add(
            this.roomSocketService.joinableRooms$.subscribe((rooms) => {
                this.rooms = rooms;
            }),
        );
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    getRemainingPlaces(room: JoinableRoomSummary): number {
        return room.maxPlayers - room.currentPlayers;
    }

    getProgressPercentage(room: JoinableRoomSummary): number {
        return (room.currentPlayers / room.maxPlayers) * PERCENTAGE_FACTOR;
    }
}
