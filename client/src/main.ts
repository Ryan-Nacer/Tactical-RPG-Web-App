import { provideHttpClient } from '@angular/common/http';
import { enableProdMode, enableProfiling, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { Routes, provideRouter, withHashLocation } from '@angular/router';
import { AvatarListComponent } from '@app/components/avatar-list/avatar-list.component';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { EditGamePageComponent } from '@app/pages/edit-game-page/edit-game-page.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { environment } from './environments/environment';
import { MatchCreationPageComponent } from '@app/pages/match-creation-page/match-creation-page.component';
import { CharacterCreationComponent } from '@app/components/character-creation/character-creation.component';
import { WaitPageComponent } from '@app/pages/wait-page/wait-page.component';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', component: MainPageComponent },
    //{ path: 'create-session', redirectTo: '/home' },
    { path: 'admin-page', component: AdminPageComponent },
    //{ path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'edit-game-page/:id', component: EditGamePageComponent },
    { path: 'edit-game-page', component: EditGamePageComponent },
    { path: 'avatar-list', component: AvatarListComponent },
    { path: 'match-creation-page', component: MatchCreationPageComponent },
    { path: 'character-creation', component: CharacterCreationComponent },
    { path: 'wait', component: WaitPageComponent },
    { path: '**', redirectTo: '' },
];

enableProfiling();
bootstrapApplication(AppComponent, {
    providers: [provideZoneChangeDetection(), provideHttpClient(), provideRouter(routes, withHashLocation())],
});
