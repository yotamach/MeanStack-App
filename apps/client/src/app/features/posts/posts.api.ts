import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Post, PostsPage } from '@meanstack/shared';
import { Observable } from 'rxjs';
import { API_URL } from '../../core/api';

export interface PostInput {
  title: string;
  content: string;
  /** A new file to upload, or the URL of the image the post already has. */
  image: File | string;
}

const toFormData = ({ title, content, image }: PostInput): FormData => {
  const data = new FormData();
  data.append('title', title);
  data.append('content', content);
  if (typeof image === 'string') {
    data.append('imagePath', image);
  } else {
    data.append('image', image, image.name);
  }
  return data;
};

/** HTTP only: no state lives here (see PostsStore). */
@Injectable({ providedIn: 'root' })
export class PostsApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/posts`;

  list(pageSize: number, page: number): Observable<PostsPage> {
    return this.http.get<PostsPage>(this.url, { params: { pagesize: pageSize, page } });
  }

  get(id: string): Observable<Post> {
    return this.http.get<Post>(`${this.url}/${id}`);
  }

  create(input: PostInput): Observable<unknown> {
    return this.http.post(this.url, toFormData(input));
  }

  update(id: string, input: PostInput): Observable<unknown> {
    return this.http.put(`${this.url}/${id}`, toFormData(input));
  }

  remove(id: string): Observable<unknown> {
    return this.http.delete(`${this.url}/${id}`);
  }
}
