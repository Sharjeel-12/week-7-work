import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { switchMap, finalize } from 'rxjs/operators';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit, CreateVisitDto, UpdateVisitDto } from '../models/visit';
import { Patient } from '../models/patient';
import { Doctor } from '../models/doctor';
import { PatientDataService } from '../Services/patient-data.service';
import { DoctorDataService } from '../Services/doctor-data.service';

@Component({
  selector: 'app-visit-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './visit-dashboard.component.html',
  styleUrl: './visit-dashboard.component.scss'
})
export class VisitDashboardComponent implements OnInit {
  AllVisits: Visit[] = [];
  AddBtnPressed = false;
  EditBtnPressed = false;

  addVisitForm!: FormGroup;
  editVisitForm!: FormGroup;
  private editingId: number | null = null;

  constructor(private visitService: VisitDataService, private patient_data:PatientDataService,private doctor_data:DoctorDataService) {}
  AllPatients!:Patient[];
  AllDoctors!:Doctor[];

  ngOnInit(): void {
this.patient_data.getAllPatients().subscribe(
  {
    next:(res)=>{
      this.AllPatients=res;
    },
    error:(err)=>{
      alert("error in loading patient data");
    }
  }
)
this.doctor_data.getAllDoctors().subscribe(
  {
    next:(res)=>{
      this.AllDoctors=res;
    },
    error:(err)=>{
      alert("error in loading doctor data");
    }
  }
)

    this.addVisitForm = new FormGroup({
      visitID:   new FormControl<number | null>(null, [Validators.required]),
      visitType:     new FormControl<string>(''),
      visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required]),
      visitDate:     new FormControl<string | null>(null), // bound to datetime-local
      visitFee:  new FormControl<number | null>(null)
    });

    this.editVisitForm = new FormGroup({
      visitID:   new FormControl<number | null>(null, [Validators.required]),
      visitType:     new FormControl<string>(''),
      visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required]),
      visitDate:   new FormControl<string | null>(null),
      visitFee:  new FormControl<number | null>(null)
    });


    this.reloadVisitsAndSetNextId();
  }

  // ===== UI actions =====
  activateForm(): void { this.AddBtnPressed = true; }
  deactivateForm(): void {
    this.AddBtnPressed = false;
    this.resetAddFormToNextId();
  }

  activateEditForm(row: Visit): void {
    this.editingId = Number(row.visitID);
    this.EditBtnPressed = true;

    this.editVisitForm.patchValue({
      visitID: row.visitID ?? null,
      visitType:  row.visitType ?? '',
      visitTypeID:   row.visitTypeID ?? 1,
      visitDuration: row.visitDuration ?? null,
      visitDate:  toLocalInputValue(row.visitDate),
      visitFee:   row.visitFee ?? null
    });
  }
  deactivateEditForm(): void {
    this.EditBtnPressed = false;
    this.editVisitForm.reset();
    this.editingId = null;
  }

  // ===== CRUD =====
  onSubmit(): void {
    const v = this.addVisitForm.getRawValue();
    const dto: CreateVisitDto = {
      visitID:   v.visitID ?? undefined,
      visitType:   v.visitType ?? '',
      visitTypeID:   Number(v.visitTypeID ?? 1),
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate:  toIsoString(v.visitDate),
      visitFee:   Number(v.visitFee ?? 0)
    };

    this.visitService.addVisit(dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => this.AddBtnPressed = false)
    ).subscribe({
      next: (res) => {
        this.AllVisits = res ?? [];
        this.resetAddFormToNextId();
      },
      error: (err) => alert(err)
    });
  }

  onEdit(): void {
    if (this.editingId == null) return;

    const v = this.editVisitForm.getRawValue();
    const dto: UpdateVisitDto = {
      visitID:    Number(v.visitID),
      visitType:     v.visitType ?? '',
      visitTypeID: Number(v.visitTypeID ?? 1),
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate:  toIsoString(v.visitDate),
      visitFee:  Number(v.visitFee ?? 0)
    };

    this.visitService.updateVisit(this.editingId, dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => this.deactivateEditForm())
    ).subscribe({
      next: (res) => this.AllVisits = res ?? [],
      error: (err) => alert(err)
    });
  }

  deleteAction(id: number | null): void {
    if (id == null) return;
    this.visitService.deleteVisit(id).pipe(
      switchMap(() => this.visitService.getAllVisits())
    ).subscribe({
      next: (res) => this.AllVisits = res ?? [],
      error: (err) => alert(err)
    });
  }

  // ===== Helpers =====
  private reloadVisitsAndSetNextId(): void {
    this.visitService.getAllVisits().subscribe({
      next: (res) => {
        this.AllVisits = res ?? [];
        this.resetAddFormToNextId();
      },
      error: (err) => alert(err)
    });
  }

  private computeNextId(): number {
    if (!this.AllVisits?.length) return 1;
    // get max id 
    return this.AllVisits.reduce((max, v) => Math.max(max, Number(v.visitID) || 0), 0) + 1;
  }

  private resetAddFormToNextId(): void {
    const next = this.computeNextId();
    const idCtrl = this.addVisitForm.get('visitID');
    idCtrl?.setValue(next);
    idCtrl?.setValidators([Validators.required, Validators.min(next)]);
    idCtrl?.updateValueAndValidity({ emitEvent: false });

    this.addVisitForm.patchValue({
      visitType: '',
      visitTypeID: 1,
      visitDuration: null,
      visitDate: null,
      visitFee: null
    });
    this.addVisitForm.markAsPristine();
  }

  displayDate(iso: string | null): string {
    if (!iso) return '—';
    try { 
      return new Date(iso).toLocaleString(); 
    } 
    catch { 
      return iso;
    }
  }
}

// Turn "yyyy-MM-ddTHH:mm" (from <input type="datetime-local">) into ISO string
function toIsoString(localValue: string | null): string {
  if (!localValue) return new Date().toISOString();
  return new Date(localValue).toISOString();
}
// Turn ISO string into "yyyy-MM-ddTHH:mm" 
function toLocalInputValue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
