import { Location } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-page-navigation',
    standalone: true,
    templateUrl: './page-navigation.component.html',
    styleUrls: ['./page-navigation.component.scss'],
})
export class PageNavigationComponent {
    currentPath = this.normalizePath(this.router.url);
    private readonly returnablePathsToPageTitleMap = new Map<string, string>([
        ['/admin-page', 'Administration des jeux'],
        ['/match-creation-page', 'Creation de partie'],
        ['/join-match', 'Parties disponibles'],
        ['/character-creation', 'Creation de personnage'],
        ['/avatar-list', "Choix d'avatar"],
    ]);
    private readonly returnToMainPagePaths = new Set<string>(['/admin-page', '/match-creation-page', '/join-match']);

    constructor(
        private readonly location: Location,
        private readonly router: Router,
    ) {
        this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
            this.currentPath = this.normalizePath(this.router.url);
        });
    }

    goBack(): void {
        if (this.returnToMainPagePaths.has(this.currentPath)) {
            this.router.navigate(['/']);
            return;
        }

        this.location.back();
    }

    shouldShowBackButton(): boolean {
        return this.returnablePathsToPageTitleMap.has(this.currentPath);
    }

    get pageLabel(): string {
        return this.returnablePathsToPageTitleMap.get(this.currentPath) ?? '';
    }

    private normalizePath(url: string): string {
        const [path] = url.split('?');
        return path || '/';
    }
}
