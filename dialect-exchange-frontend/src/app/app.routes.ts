import { Routes } from '@angular/router';
import { LoginComponent } from './features/login/login.component';
import { Register } from './features/register/register';
import { ForgotPasswordComponent } from './features/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './features/reset-password/reset-password.component';
import { VerifyEmailComponent } from './features/verify-email/verify-email.component';
import { LandingComponent } from './features/landing/landing.component';
import { HomeComponent } from './features/home/home.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Public landing page — default route
  { path: '', component: LandingComponent },

  // Auth pages
  { path: 'login', component: LoginComponent },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'verify-email', component: VerifyEmailComponent },

  // Protected app pages
  {
    path: 'home',
    component: HomeComponent,
    canActivate: [authGuard]
  },
  {
    path: 'explore',
    loadComponent: () =>
      import('./features/explore/explore.component').then(m => m.ExploreComponent),
    canActivate: [authGuard]
  },
  {
    path: 'dialect/:id',
    loadComponent: () =>
      import('./features/dialect-detail/dialect-detail.component').then(m => m.DialectDetailComponent),
    canActivate: [authGuard]
  },
  {
    path: 'my-bridges',
    loadComponent: () =>
      import('./features/my-bridges/my-bridges.component').then(m => m.MyBridgesComponent),
    canActivate: [authGuard]
  },
  { path: 'bridges', redirectTo: 'my-bridges' },
  {
    path: 'community',
    loadComponent: () =>
      import('./features/community/community.component').then(m => m.CommunityComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [authGuard]
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then(m => m.SettingsComponent),
    canActivate: [authGuard]
  },
  {
    path: 'messages',
    loadComponent: () =>
      import('./features/messages/messages.component').then(m => m.MessagesComponent),
    canActivate: [authGuard]
  },

  // Fallback
  { path: '**', redirectTo: '' }
];