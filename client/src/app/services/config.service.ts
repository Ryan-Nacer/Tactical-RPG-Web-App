import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Config } from '@app/interfaces/config';
import { Tool } from '@common/game';
import { PlayerAvatar } from '@common/player';

@Injectable({
    providedIn: 'root',
})
export class ConfigService {
    isLoaded = false;
    private config: Config;

    constructor(private readonly http: HttpClient) {
        this.http.get<Config>('assets/config.json').subscribe((data: Config) => {
            this.config = data;

            this.config.playerAvatars = this.config.playerAvatars.map((avatar) => ({
                ...avatar,
                imageUrl: this.setPlayerImage(avatar),
                avatarName: avatar.avatarName,
            }));

            this.isLoaded = true;
        });
    }

    getTeamNames(): string[] {
        return this.config.teamNames;
    }
    getLogoPath(): string {
        return 'assets/' + this.config.logo;
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

    getGameDescriptionLimit(): number {
        return this.config.gameDescriptionLimit;
    }

    getGameNameLimit(): number {
        return this.config.gameNameLimit;
    }
}
