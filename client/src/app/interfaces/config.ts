import { PlayerAvatar } from '@common/player';
import { Tool } from '@common/game';

export interface Config {
    title: string;
    logo: string;
    teamNames: [string];
    toolDescriptionMap: Record<Tool, string>;
    playerAvatars: PlayerAvatar[];
}
