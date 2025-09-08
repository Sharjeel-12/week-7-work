import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SignUpService } from '../Services/sign-up.service';
import { Route, Router } from '@angular/router';
interface signUpBody {
  email: string,
  password: string,
  role: string
}
@Component({
  selector: 'app-sign-up',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './sign-up.component.html',
  styleUrl:'./sign-up.component.scss'
})
export class SignUpComponent implements OnInit {

  constructor(private signUp: SignUpService, private router: Router) { }
  signupForm!: FormGroup;
  get f() {
    return this.signupForm.controls;
  }
  ngOnInit(): void {
    this.signupForm = new FormGroup(
      {
        email: new FormControl<string>('', [Validators.required, Validators.email]),
        password: new FormControl<string | null>(null, [Validators.required, Validators.minLength(3)]),
        role: new FormControl<"Admin" | "Receptionist"|"Clinician">("Admin", [Validators.required])
      }
    )
  }

  registerUser(): void {
    const body = {
      email: this.signupForm.value.email,
      password: this.signupForm.value.password,
      role: this.signupForm.value.role
    }
    this.signUp.registerUser(body).subscribe({
      next: (res) => {
        if (res?.role) {
          alert(`You have successfuly signed up as ${res.role}`);
        }
      },
      error: () => { alert("Sign up failed") }
    })
  }

  navigateToLogin() {
    this.router.navigate(['/login']);
  }
}
