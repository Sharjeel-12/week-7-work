import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Visit, CreateVisitDto, UpdateVisitDto } from '../models/visit';

@Injectable({ providedIn: 'root' })
export class VisitDataService {
  // Keep this base URL consistent with your project
  private apiUrl = 'http://localhost:49428/api/Visits';

  constructor(private http: HttpClient) {}

  

  getAllVisits(): Observable<Visit[]> {
    return this.http.get<Visit[]>(this.apiUrl, { headers: {'Authorization':'Bearer '+sessionStorage.getItem('access_token')} });
  }

  getVisitById(id: number): Observable<Visit> {
    return this.http.get<Visit>(`${this.apiUrl}/${id}`, { headers: {'Authorization':'Bearer '+sessionStorage.getItem('access_token')} });
  }

  addVisit(body: CreateVisitDto): Observable<Visit | void> {
    return this.http.post<Visit | void>(this.apiUrl, body, { headers: {'Authorization':'Bearer '+sessionStorage.getItem('access_token')} });
  }

  updateVisit(id: number, body: UpdateVisitDto): Observable<Visit | void> {
    return this.http.put<Visit | void>(`${this.apiUrl}/${id}`, body, { headers: {'Authorization':'Bearer '+sessionStorage.getItem('access_token')} });
  }

  deleteVisit(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, { headers: {'Authorization':'Bearer '+sessionStorage.getItem('access_token')} });
  }
}
