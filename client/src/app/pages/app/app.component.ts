import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PageNavigationComponent } from '@app/components/page-navigation/page-navigation.component';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet, PageNavigationComponent],
})
export class AppComponent {}
