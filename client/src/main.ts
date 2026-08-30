import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AvatarListComponent } from '@app/components/avatar-list/avatar-list.component';
import { CharacterCreationComponent } from '@app/components/character-creation/character-creation.component';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { EditGamePageComponent } from '@app/pages/edit-game-page/edit-game-page.component';
import { GamePageComponent } from '@app/pages/game-page/game-page.component';
import { JoinMatchPageComponent } from '@app/pages/join-match-page/join-match-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { MatchCreationPageComponent } from '@app/pages/match-creation-page/match-creation-page.component';
import { WaitPageComponent } from '@app/pages/wait-page/wait-page.component';
import { environment } from './environments/environment';
import { EndGamePageComponent } from '@app/pages/end-game-page/end-game-page.component';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', component: MainPageComponent },
    { path: 'admin-page', component: AdminPageComponent },
    { path: 'edit-game-page/:id', component: EditGamePageComponent },
    { path: 'edit-game-page', component: EditGamePageComponent },
    { path: 'avatar-list', component: AvatarListComponent },
    { path: 'match-creation-page', component: MatchCreationPageComponent },
    { path: 'character-creation', component: CharacterCreationComponent },
    { path: 'wait', component: WaitPageComponent },
    { path: 'join-match', component: JoinMatchPageComponent },
    { path: 'game', component: GamePageComponent },
    { path: 'end-game', component: EndGamePageComponent },
    { path: '**', redirectTo: '' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [
        provideZoneChangeDetection(),
        provideHttpClient(),
        provideAnimations(),
        provideRouter(routes, withHashLocation()),
        importProvidersFrom(MatSnackBarModule),
    ],
});
