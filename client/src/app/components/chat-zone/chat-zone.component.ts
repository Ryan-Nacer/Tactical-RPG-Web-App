import { AsyncPipe } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, Input, OnChanges, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChatSocketService } from '@app/services/chat/chat-socket.service';
import { ChatMessage } from '@common/chat-message';

const MAX_MESSAGE_LENGTH = 200;

@Component({
    selector: 'app-chat-zone',
    standalone: true,
    imports: [AsyncPipe, FormsModule],
    templateUrl: './chat-zone.component.html',
    styleUrls: ['./chat-zone.component.scss'],
})
export class ChatZoneComponent implements AfterViewChecked, OnInit, OnChanges {
    private static readonly autoScrollThresholdPx = 56;

    @Input() roomId: string;
    @Input() currentUser: string;
    @Input() isAbandoned: boolean = false;
    @Input() playerId: string;
    @ViewChild('scrollContainer') private scrollContainer: ElementRef;

    messageText: string = '';
    shouldAutoScroll: boolean = true;

    constructor(public chatService: ChatSocketService) {}

    ngOnInit(): void {
        if (this.roomId) {
            this.chatService.joinRoom(this.roomId);
        }
    }

    ngOnChanges(): void {
        if (this.roomId) {
            this.chatService.joinRoom(this.roomId);
        }
    }

    ngAfterViewChecked() {
        if (this.shouldAutoScroll) {
            this.scrollToBottom();
        }
    }

    onMessagesScroll(): void {
        if (!this.scrollContainer?.nativeElement) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = this.scrollContainer.nativeElement;
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
        this.shouldAutoScroll = distanceFromBottom <= ChatZoneComponent.autoScrollThresholdPx;
    }

    scrollToBottom(): void {
        if (!this.scrollContainer?.nativeElement) {
            return;
        }

        this.scrollContainer.nativeElement.scrollTop = this.scrollContainer.nativeElement.scrollHeight;
    }

    send() {
        if (this.messageText.trim() && this.messageText.length <= MAX_MESSAGE_LENGTH) {
            this.chatService.sendMessage(this.roomId, this.currentUser, this.messageText, this.playerId);
            this.messageText = '';
        }
    }

    isOwnMessage(message: ChatMessage): boolean {
        if (this.playerId && message.playerId === this.playerId) {
            return true;
        }

        return Boolean(this.currentUser) && message.sender === this.currentUser;
    }
}
