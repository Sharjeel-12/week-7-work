import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse
} from '@angular/common/http';
import { Router } from '@angular/router';
import { throwError, defer } from 'rxjs';
import { catchError } from 'rxjs/operators';

export const authInterceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn) => {
  const router = inject(Router);
  const token = sessionStorage.getItem('access_token');

  // If token exists, validate it
  if (token) {
    if (isTokenExpired(token)) {
      sessionStorage.clear();
      return defer(() => {
        router.navigate(['/login'], { queryParams: { sessionExpired: 'true' } });
        return throwError(() => new Error('Session expired'));
      });
    }

    const cloned = req.clone({
      headers: req.headers.set('Authorization', `Bearer ${token}`)
    });

    return next(cloned).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          sessionStorage.clear();
          return defer(() => {
            router.navigate(['/login'], { queryParams: { sessionExpired: 'true' } });
            return throwError(() => error);
          });
        }
        return throwError(() => error);
      })
    );
  }

  // No token — proceed without modifying the request
  return next(req);
};

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiry = payload.exp;
    const now = Math.floor(Date.now() / 1000);
    return expiry < now;
  } catch (_) {
    return true;
  }
}
