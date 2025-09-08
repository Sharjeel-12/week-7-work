import { Component, OnInit } from '@angular/core';
import { PatientDataService } from '../Services/patient-data.service';
import { Patient } from '../models/patient';
import { CreatePatientDto } from '../models/create-patient-dto';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SearchFilterDirective } from '../directives/search-filter.directive';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit } from '../models/visit';
@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule,SearchFilterDirective],
  providers: [PatientDataService],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss'
})
export class PatientDashboardComponent implements OnInit {

  constructor(private dataService: PatientDataService, private visit_data:VisitDataService) { }
AllVisits!:Visit[];
  addPatientForm!: FormGroup;
  editPatientForm!: FormGroup;
get AddForm(){
  return this.addPatientForm.controls;
}
get EditForm(){
  return this.editPatientForm.controls;
}
  AllPatients!: Patient[];
  visiblePatients: any[] = [];
  AddBtnPressed: boolean = false;

  EditBtnPressed: boolean = false;

  last_id!: number | null | undefined;
  // activates the Add Patient Form
  activateForm(): void {
    this.AddBtnPressed = true;
  }
  // de-activates the Add Patient Form
  deactivateForm(): void {
    this.AddBtnPressed = false;
  }

  // onSubmit for the add patient form
  onSubmit(): void {
    const patientDto = {
      patientID: this.addPatientForm.value.patientID,
      patientName: this.addPatientForm.value.patientName,
      patientEmail: this.addPatientForm.value.patientEmail,
      patientPhone: this.addPatientForm.value.patientPhone,
      patientDescription: this.addPatientForm.value.patientDescription,
    };
    const patient = {
      patientID: this.addPatientForm.value.patientID,
      visitID: null,
      patientName: this.addPatientForm.value.patientName,
      patientEmail: this.addPatientForm.value.patientEmail,
      patientPhone: this.addPatientForm.value.patientPhone,
      patientDescription: this.addPatientForm.value.patientDescription,
    };
    if (this.AllPatients.some(p => p.patientID === patient.patientID) && patient.patientID !== null) {
      alert("The doctor ID you just entered already exists. Please  try a unique value for each patient");
    }
    else if(this.AllPatients.some(p => p.patientEmail === patient.patientEmail)&& patient.patientEmail !== null){
      alert("The doctor email you just entered already exists. Please  try a unique email for each patient");

    }
    else {

      this.dataService.AddNewPatient(patientDto).subscribe({
        next: (res) => {
          this.AllPatients.push(patient);
          alert("Patient Added Successfully");
          console.log("Patient Added successfully")
        },
        error: (err) => { alert(err) }
      })
      this.AddBtnPressed = false;

    }


  }

  //----------------------------
  //Activation and de activation
  activateEditForm(p: Patient): void {
    const pidCtrl = this.editPatientForm.get('patientID');
    const vidCtrl = this.editPatientForm.get('visitID');
    const name = this.editPatientForm.get('patientName');
    const email = this.editPatientForm.get('patientEmail');
    const phone = this.editPatientForm.get('patientPhone');
    const desc = this.editPatientForm.get('patientDescription');
    pidCtrl?.setValue(p.patientID);
    vidCtrl?.setValue(p.visitID);
    name?.setValue(p.patientName);
    email?.setValue(p.patientEmail);
    phone?.setValue(p.patientPhone);
    desc?.setValue(p.patientDescription);

    this.EditBtnPressed = true;
  }
  deactivateEditForm(): void {
    this.EditBtnPressed = false;
  }

  // on Edit form submission
  onEdit() {
    const patient = {
      patientID: this.editPatientForm.value.patientID,
      visitID: this.editPatientForm.value.visitID,
      patientName: this.editPatientForm.value.patientName,
      patientEmail: this.editPatientForm.value.patientEmail,
      patientPhone: this.editPatientForm.value.patientPhone,
      patientDescription: this.editPatientForm.value.patientDescription,
    };
    if (this.AllPatients.some(p => p.patientID === patient.patientID) && patient.patientID !== null) {
      alert("The doctor ID you just entered already exists. Please  try a unique value for each patient");
    }
    else if(this.AllPatients.some(p => p.patientEmail === patient.patientEmail)&& patient.patientEmail !== null){
      alert("The doctor email you just entered already exists. Please  try a unique email for each patient");

    }
    else if(this.AllPatients.some(p => p.visitID === patient.visitID)&& patient.visitID !== null){
      alert("The doctor email you just entered already exists. Please  try a unique email for each patient");

    }
    else {
      console.log("patient ID: ", patient.patientID);
      this.dataService.UpdatePatient(patient.patientID, patient).subscribe({
        next: (res) => {
          const fetched = this.AllPatients.filter(p => p.patientID == patient.patientID)[0];
          fetched.patientID = patient.patientID;
          fetched.visitID = patient.visitID;
          fetched.patientName = patient.patientName;
          fetched.patientEmail = patient.patientEmail;
          fetched.patientPhone = patient.patientPhone;
          fetched.patientDescription = patient.patientDescription;
          alert("The record of the patient has been updated");
        }
      })
      console.log("Hello world");
      this.EditBtnPressed = false;

    }

  }

  // deletes the patient record 
  deleteAction(id: number | null | undefined): void {

    if(this.AllVisits.some(v=>v.visitID==id)){
      alert("Sorry this patient record cannot be deleted as this patient has a scheduled appointment");
    }
    else{
      this.dataService.deletePatientByID(id).subscribe(
        {
          next: (res) => {
            alert("deleted patient record successfully");
            this.AllPatients.splice(this.AllPatients.findIndex(p => p.patientID === id), 1);
          }
        }
      )
      
    }
    


  }



  refreshVisible() {
  this.visiblePatients = this.AllPatients;
  }
  // implements the ngOninit hook
  ngOnInit(): void {
// getting the visits as well for checking
this.visit_data.getAllVisits().subscribe(
  { next:(res)=>{
    this.AllVisits=res;
  },
  error:(err)=>{
    alert("visit data Loading Failed");
  }

  }
)

    // preparing the edit patient form on instantiation
    this.editPatientForm = new FormGroup(
      {
        patientID: new FormControl<number | null>(null, [Validators.required]),
        patientName: new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
        visitID: new FormControl<number | null>(null),
        patientEmail: new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
        patientPhone: new FormControl<string | null>('', [Validators.required]),
        patientDescription: new FormControl<string | null>('')
      }
    )

    // preparing the new add patient form on instantiation
    this.addPatientForm = new FormGroup(
      {
        patientID: new FormControl<number | null>(null, [Validators.required]),
        patientName: new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
        patientEmail: new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
        patientPhone: new FormControl<string | null>('', [Validators.required]),
        patientDescription: new FormControl<string | null>('')
      }
    )
    this.dataService.getAllPatients().subscribe({
      next: (res) => {
        this.AllPatients = res;
        this.last_id = this.AllPatients[this.AllPatients.length - 1].patientID;
        const idCtrl = this.addPatientForm.get('patientID');
        console.log("Hello");
        console.log(this.last_id);
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)])
        this.visiblePatients=this.AllPatients;
      },
      error: (err) => { alert(err) }

    }
    )


  }
}


