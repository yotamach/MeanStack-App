import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { Post } from '@meanstack/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { PostsStore } from './posts.store';

const post = (id: string): Post => ({
  _id: id,
  title: id,
  content: 'c',
  imagePath: 'i',
  creator: 'u',
});

describe('PostsStore', () => {
  let store: PostsStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PostsStore);
    http = TestBed.inject(HttpTestingController);
  });

  const flushList = (posts: Post[], max: number) =>
    http.expectOne((r) => r.url === '/api/posts').flush({ message: 'ok', posts, maxPosts: max });

  it('loads the first page with the configured page size', () => {
    store.load();
    const req = http.expectOne((r) => r.url === '/api/posts');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('pagesize')).toBe('5');
    expect(store.loading()).toBe(true);
    req.flush({ message: 'ok', posts: [post('a')], maxPosts: 1 });
    expect(store.posts()).toEqual([post('a')]);
    expect(store.total()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('flags an empty list only once loaded', () => {
    store.load();
    expect(store.isEmpty()).toBe(false);
    flushList([], 0);
    expect(store.isEmpty()).toBe(true);
  });

  it('ignores a superseded response (no stale data after fast paging)', () => {
    store.setPage(0, 5);
    const first = http.expectOne((r) => r.url === '/api/posts');
    store.setPage(1, 5);
    const second = http.expectOne((r) => r.url === '/api/posts' && r.params.get('page') === '2');
    second.flush({ message: 'ok', posts: [post('page2')], maxPosts: 6 });
    expect(first.cancelled).toBe(true);
    expect(store.posts()).toEqual([post('page2')]);
  });

  it('steps back a page after deleting the last post of a later page', () => {
    store.setPage(1, 5);
    flushList([post('only')], 6);

    store.remove('only');
    http.expectOne('/api/posts/only').flush({ message: 'Deletion successful!' });
    expect(store.pageIndex()).toBe(0);
    const reload = http.expectOne((r) => r.url === '/api/posts');
    expect(reload.request.params.get('page')).toBe('1');
    reload.flush({ message: 'ok', posts: [post('a')], maxPosts: 5 });
  });

  it('clears the loading state when a request fails', () => {
    store.load();
    http
      .expectOne((r) => r.url === '/api/posts')
      .flush('boom', { status: 500, statusText: 'Server Error' });
    expect(store.loading()).toBe(false);
  });
});
