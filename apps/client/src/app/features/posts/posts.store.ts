import { Injectable, computed, inject, signal } from '@angular/core';
import type { Post } from '@meanstack/shared';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import { PostsApi } from './posts.api';

export const PAGE_SIZE_OPTIONS = [1, 2, 5, 10];

@Injectable({ providedIn: 'root' })
export class PostsStore {
  private readonly api = inject(PostsApi);
  private readonly reload$ = new Subject<void>();

  readonly posts = signal<Post[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  readonly isEmpty = computed(() => !this.loading() && this.posts().length === 0);

  constructor() {
    // switchMap drops the response of a superseded request, so quick paging can't show stale data.
    this.reload$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.api.list(this.pageSize(), this.pageIndex() + 1).pipe(
            catchError(() => {
              this.loading.set(false);
              return EMPTY;
            }),
          ),
        ),
      )
      .subscribe((page) => {
        this.posts.set(page.posts);
        this.total.set(page.maxPosts);
        this.loading.set(false);
      });
  }

  load(): void {
    this.reload$.next();
  }

  setPage(pageIndex: number, pageSize: number): void {
    this.pageIndex.set(pageIndex);
    this.pageSize.set(pageSize);
    this.load();
  }

  remove(id: string): void {
    this.loading.set(true);
    this.api.remove(id).subscribe({
      next: () => {
        // Deleting the last post on a page would otherwise leave an empty page behind.
        if (this.posts().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.load();
      },
      error: () => this.loading.set(false),
    });
  }
}
