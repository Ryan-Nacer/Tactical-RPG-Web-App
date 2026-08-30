import { UNKNOWN_ERROR } from '@app/controllers/controller.constants';

export function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }

    return UNKNOWN_ERROR;
}
