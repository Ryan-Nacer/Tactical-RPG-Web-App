import { Controller, Get } from '@nestjs/common';
import { RoomService } from '@app/services/room/room.service';
import { JoinableRoomSummary } from '@common/wait-room';

@Controller('rooms')
export class RoomController {
    constructor(private readonly roomService: RoomService) {}

    @Get('joinable')
    getJoinableRooms(): JoinableRoomSummary[] {
        return this.roomService.getJoinableRooms();
    }
}
