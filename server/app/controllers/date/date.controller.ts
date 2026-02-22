import { Message } from '@app/model/schema/message.schema';
import { DateService } from '@app/services/date/date.service';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';

const TIME_TITLE = 'temps';
const TIME_DESCRIPTION = 'Retourne le temps actuel';

@Controller('date')
export class DateController {
    constructor(private readonly dateService: DateService) {}

    @Get('/')
    @ApiOkResponse({
        description: TIME_DESCRIPTION,
        type: Message,
    })
    dateInfo(): Message {
        return {
            title: TIME_TITLE,
            body: this.dateService.currentTime(),
        };
    }
}
