import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

interface signUpBody{
  email:string,
  password:string,
  role:string
}
@Injectable({
  providedIn: 'root'
})
export class SignUpService {
base_url:string="http://localhost:49428/api/Auth/register";
  constructor(private http:HttpClient) { }
  registerUser(body:signUpBody):Observable<any>{
    return this.http.post<any>(this.base_url,body,{headers:{'Authorization':"Bearer "+sessionStorage.getItem('access_token')}})
  }

}
