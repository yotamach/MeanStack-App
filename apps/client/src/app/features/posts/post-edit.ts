import { ChangeDetectionStrategy, Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { mimeType } from '../../shared/mime-type.validator';
import { PostsApi } from './posts.api';

@Component({
  selector: 'app-post-edit',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './post-edit.html',
  styleUrl: './post-edit.css',
})
export class PostEdit {
  private readonly api = inject(PostsApi);
  private readonly router = inject(Router);

  /** Bound from the `:postId` route param (withComponentInputBinding); absent when creating. */
  readonly postId = input<string>();

  protected readonly saving = signal(false);
  protected readonly preview = signal<string | null>(null);

  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(3)]],
    content: ['', Validators.required],
    image: this.fb.control<File | string | null>(null, {
      validators: Validators.required,
      asyncValidators: mimeType,
    }),
  });

  private readonly post = rxResource({
    params: () => this.postId(),
    stream: ({ params }) => this.api.get(params),
  });
  protected readonly loading = this.post.isLoading;

  constructor() {
    effect(() => {
      const post = this.post.value();
      if (post) {
        this.form.setValue({ title: post.title, content: post.content, image: post.imagePath });
        this.preview.set(post.imagePath);
      }
    });
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected onImagePicked(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.form.controls.image.setValue(file);
    this.form.controls.image.markAsTouched();
    this.revokePreview();
    this.preview.set(URL.createObjectURL(file));
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { title, content, image } = this.form.getRawValue();
    const input = { title, content, image: image as File | string };
    const id = this.postId();
    this.saving.set(true);
    (id ? this.api.update(id, input) : this.api.create(input))
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({ next: () => void this.router.navigate(['/']), error: () => undefined });
  }

  private revokePreview(): void {
    const url = this.preview();
    if (url?.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  }
}
