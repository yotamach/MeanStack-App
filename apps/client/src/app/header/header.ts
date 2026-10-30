import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-toolbar color="primary">
      <a class="brand" routerLink="/">MyMessages</a>
      <span class="spacer"></span>
      <nav aria-label="Main">
        @if (auth.isAuthenticated()) {
          <a matButton routerLink="/create" routerLinkActive="active">New post</a>
          <button matButton type="button" (click)="auth.logout()">Logout</button>
        } @else {
          <a matButton routerLink="/login" routerLinkActive="active">Login</a>
          <a matButton routerLink="/signup" routerLinkActive="active">Signup</a>
        }
      </nav>
    </mat-toolbar>
  `,
  styles: `
    .brand {
      color: inherit;
      text-decoration: none;
      font-weight: 500;
    }
    .spacer {
      flex: 1 1 auto;
    }
    .active {
      text-decoration: underline;
    }
  `,
})
export class Header {
  protected readonly auth = inject(AuthService);
}
