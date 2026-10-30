import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { PAGE_SIZE_OPTIONS, PostsStore } from './posts.store';

@Component({
  selector: 'app-post-list',
  imports: [
    RouterLink,
    MatButtonModule,
    MatExpansionModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-list.html',
  styleUrl: './post-list.css',
})
export class PostList {
  protected readonly store = inject(PostsStore);
  protected readonly auth = inject(AuthService);
  protected readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  constructor() {
    this.store.load();
  }

  protected onPage(event: PageEvent): void {
    this.store.setPage(event.pageIndex, event.pageSize);
  }

  protected canEdit(creator: string): boolean {
    return this.auth.userId() === creator;
  }
}
