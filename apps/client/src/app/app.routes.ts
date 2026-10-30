import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Posts',
    loadComponent: () => import('./features/posts/post-list').then((m) => m.PostList),
  },
  {
    path: 'create',
    title: 'New post',
    canActivate: [authGuard],
    loadComponent: () => import('./features/posts/post-edit').then((m) => m.PostEdit),
  },
  {
    path: 'edit/:postId',
    title: 'Edit post',
    canActivate: [authGuard],
    loadComponent: () => import('./features/posts/post-edit').then((m) => m.PostEdit),
  },
  {
    path: 'login',
    title: 'Login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    title: 'Sign up',
    loadComponent: () => import('./features/auth/signup').then((m) => m.Signup),
  },
  { path: '**', redirectTo: '' },
];
