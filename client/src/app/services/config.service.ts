import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Config } from '@app/interfaces/config';
import { PlayerAvatar } from '@common/player';
import { Tool } from '@common/game';

@Injectable({
    providedIn: 'root',
})
export class ConfigService {
    private http = inject(HttpClient);
    isLoaded = false;
    private config: Config;

    constructor() {
        this.http.get<Config>('../../assets/config.json').subscribe((data: Config) => {
            this.config = data;

            this.config.playerAvatars = this.config.playerAvatars.map((avatar) => ({
                ...avatar,
                imageUrl: this.setPlayerImage(avatar),
                avatarName: avatar.avatarName,
            }));

            this.isLoaded = true;

            this.config.toolDescriptionMap = data.toolDescriptionMap;
        });
    }

    getConfig(): Config {
        return this.config;
    }
    getTeamNames(): [string] {
        return this.config.teamNames;
    }
    getLogoPath(): string {
        return '../../assets/' + this.config.logo;
    }

    getTitle(): string {
        return this.config.title;
    }

    getToolDescription(tool: Tool): string | undefined {
        return this.config.toolDescriptionMap[tool];
    }
    getPlayerAvatars(): PlayerAvatar[] {
        return this.config.playerAvatars;
    }

    private setPlayerImage(playerAvatar: PlayerAvatar): string {
        return 'assets/characters/' + playerAvatar.imageUrl;
    }
}
