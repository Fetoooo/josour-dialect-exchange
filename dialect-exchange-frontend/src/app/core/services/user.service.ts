import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl + 'Users';

  getMyProfile(): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile`);
  }

  updateProfile(data: { displayName?: string; bioAr?: string; country?: string; nativeDialectId?: string | null; learningDialectIds?: string[] }): Observable<any> {
    return this.http.put(`${this.apiUrl}/profile`, data);
  }

  uploadProfileImage(file: File): Observable<{ profileImage: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ profileImage: string }>(`${this.apiUrl}/profile/image`, formData);
  }

  deleteProfileImage(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/profile/image`);
  }

  uploadCoverImage(file: File): Observable<{ coverImage: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ coverImage: string }>(`${this.apiUrl}/profile/cover`, formData);
  }

  deleteCoverImage(): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/profile/cover`);
  }

  deleteAccount(): Observable<void> {
    return this.http.delete<void>(this.apiUrl);
  }
}