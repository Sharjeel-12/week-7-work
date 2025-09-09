import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DoctorDataService } from '../Services/doctor-data.service';
import { Doctor } from '../models/doctor';
import { CreateDoctorDto } from '../models/create-doctor-dto';
import { SearchFilterDirective } from '../directives/search-filter.directive';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit } from '../models/visit';
@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule,SearchFilterDirective],
  providers: [DoctorDataService],
  templateUrl: './doctor-dashboard.component.html',
  styleUrl: './doctor-dashboard.component.scss'
})
export class DoctorDashboardComponent {
  constructor(private dataService: DoctorDataService,private visit_data:VisitDataService) { }
  AllVisits!:Visit[];
  addDoctorForm!: FormGroup;
  editDoctorForm!: FormGroup;

  AllDoctors!: Doctor[];
  visibleDoctors!:Doctor[];
  AddBtnPressed: boolean = false;

  EditBtnPressed: boolean = false;

  last_id!: number | null | undefined;

  get AddForm() {
    return this.addDoctorForm.controls;
  }
  get EditForm() {
    return this.editDoctorForm.controls;
  }


  // activates the Add Doctor Form
  activateForm(): void {
    this.AddBtnPressed = true;
  }
  // de-activates the Add Doctor Form
  deactivateForm(): void {
    this.AddBtnPressed = false;
  }

  // onSubmit for the add doctor form
  onSubmit(): void {
    const doctorDto = {
      doctorID: this.addDoctorForm.value.doctorID,
      doctorName: this.addDoctorForm.value.doctorName,
      doctorEmail: this.addDoctorForm.value.doctorEmail,
      doctorPhone: this.addDoctorForm.value.doctorPhone,
      specialization: this.addDoctorForm.value.specialization
    };
    const doctor = {
      doctorID: this.addDoctorForm.value.doctorID,
      visitID: null,
      doctorName: this.addDoctorForm.value.doctorName,
      doctorEmail: this.addDoctorForm.value.doctorEmail,
      doctorPhone: this.addDoctorForm.value.doctorPhone,
      specialization: this.addDoctorForm.value.specialization
    };
    if (this.AllDoctors.some(d => d.doctorID === doctor.doctorID) && doctor.doctorID !== null) {
      alert("The doctor ID you just entered already exists. Please  try a unique value for each doctor");
    }
    else if (this.AllDoctors.some(d => d.doctorEmail === doctor.doctorEmail) && doctor.doctorEmail !== null) {
      alert("The doctor email you just entered already exists. Please  try a unique email for each doctor");

    }
    else {
      this.dataService.AddNewDoctor(doctorDto).subscribe({
        next: (res) => {
          this.AllDoctors.push(doctor);
          alert("Doctor Added Successfully");
          console.log("Doctor Added successfully")
        },
        error: (err) => { alert(err) }
      })
      this.AddBtnPressed = false;

    }


  }


  //Activation and de activation
  activateEditForm(p: Doctor): void {
    const pidCtrl = this.editDoctorForm.get('doctorID');
    const vidCtrl = this.editDoctorForm.get('visitID');
    const name = this.editDoctorForm.get('doctorName');
    const email = this.editDoctorForm.get('doctorEmail');
    const phone = this.editDoctorForm.get('doctorPhone');
    const desc = this.editDoctorForm.get('specialization');
    pidCtrl?.setValue(p.doctorID);
    vidCtrl?.setValue(p.visitID);
    name?.setValue(p.doctorName);
    email?.setValue(p.doctorEmail);
    phone?.setValue(p.doctorPhone);
    desc?.setValue(p.specialization);

    this.EditBtnPressed = true;
  }
  deactivateEditForm(): void {
    this.EditBtnPressed = false;
  }

  // on Edit form submission
  onEdit(): void {
    const doctor = {
      doctorID: this.editDoctorForm.value.doctorID,
      visitID: this.editDoctorForm.value.visitID,
      doctorName: this.editDoctorForm.value.doctorName,
      doctorEmail: this.editDoctorForm.value.doctorEmail,
      doctorPhone: this.editDoctorForm.value.doctorPhone,
      specialization: this.editDoctorForm.value.specialization,
    };
    const filtered=this.AllDoctors.filter(d=>d.doctorID !== doctor.doctorID);
    if (filtered.some(d => d.doctorID === doctor.doctorID) && doctor.doctorID !== null) {
      alert("The doctor ID you just entered already exists. Please  try a unique value for each doctor");
    }
    else if (filtered.some(d => d.doctorEmail === doctor.doctorEmail) && doctor.doctorEmail !== null) {
      alert("The doctor email you just entered already exists. Please  try a unique email for each doctor");

    }
    else if (filtered.some(d => d.visitID === doctor.visitID) && doctor.visitID !== null) {
      alert("The doctor email you just entered already exists. Please  try a unique email for each doctor");

    }
    else {
      console.log("doctor ID: ", doctor.doctorID);
      this.dataService.UpdateDoctor(doctor.doctorID, doctor).subscribe({
        next: (res) => {
          const fetched = this.AllDoctors.filter(p => p.doctorID == doctor.doctorID)[0];
          fetched.doctorID = doctor.doctorID;
          fetched.visitID = doctor.visitID;
          fetched.doctorName = doctor.doctorName;
          fetched.doctorEmail = doctor.doctorEmail;
          fetched.doctorPhone = doctor.doctorPhone;
          fetched.specialization = doctor.specialization;
          alert("The record of the doctor has been updated");
        }
      })
      console.log("Hello world");
      this.EditBtnPressed = false;

    }

  }

  // deletes the doctor record 
  deleteAction(id: number): void {
     this.dataService.getDoctorByID(id).subscribe(
{
  next:(d_delete)=>{
    if(this.AllVisits.some(v=>v.visitID==d_delete.visitID)){
      alert("Sorry this doctor record cannot be deleted as this doctor has a scheduled appointment");
    }
    else{
      this.dataService.deleteDoctorByID(id).subscribe(
        {
          next: (res) => {
            alert("deleted doctor record successfully");
            this.AllDoctors.splice(this.AllDoctors.findIndex(d => d.doctorID === id), 1);
          }
        }
      )
      
    }
  }
}
)
  }



  // implements the ngOninit hook
  ngOnInit(): void {

    // preparing the edit patient form on instantiation
    this.editDoctorForm = new FormGroup(
      {
        doctorID: new FormControl<number | null>(null, [Validators.required]),
        doctorName: new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
        visitID: new FormControl<number | null>(null),
        doctorEmail: new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
        doctorPhone: new FormControl<string | null>('', [Validators.required]),
        specialization: new FormControl<string | null>('')
      }
    )

    // preparing the new add patient form on instantiation
    this.addDoctorForm = new FormGroup(
      {
        doctorID: new FormControl<number | null>(null, [Validators.required]),
        doctorName: new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
        doctorEmail: new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
        doctorPhone: new FormControl<string | null>('', [Validators.required]),
        specialization: new FormControl<string | null>('')
      }
    )
    this.dataService.getAllDoctors().subscribe({
      next: (res) => {
        this.AllDoctors = res;
        this.visibleDoctors=this.AllDoctors;
        this.last_id = this.AllDoctors[this.AllDoctors.length - 1].doctorID;
        const idCtrl = this.addDoctorForm.get('doctorID');
        console.log("Hello");
        console.log(this.last_id);
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)])
      },
      error: (err) => { alert("Failed to load doctor data") }

    }
    )


  }
}
