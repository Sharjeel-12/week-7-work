import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { switchMap, finalize } from 'rxjs/operators';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit, CreateVisitDto, UpdateVisitDto } from '../models/visit';
import { Patient } from '../models/patient';
import { Doctor } from '../models/doctor';
import { PatientDataService } from '../Services/patient-data.service';
import { DoctorDataService } from '../Services/doctor-data.service';
import { BusinessHoursDirective } from '../directives/business-hours.directive';
// INSIDE class VisitDashboardComponent

// onSubmit(): void {
//   const v = this.addVisitForm.getRawValue();

//   // Try client-side guard ONLY if a doctor is already linked to this visitID (rare for create)
//   const newVisitId = Number(v.visitID ?? 0);
//   const visitDoctorMap = buildVisitDoctorMap(this.AllDoctors);
//   const providerId = visitDoctorMap.get(newVisitId); // may be undefined if doctor row isn't created yet

//   if (v.visitDate && v.visitDuration && providerId) {
//     const { start, end } = intervalFromLocalInput(v.visitDate, Number(v.visitDuration));
//     const { conflictingVisit } = this.findOverlapForProvider(providerId, start, end);
//     if (conflictingVisit) {
//       alert(
//         `Time conflict with visit #${conflictingVisit.visitID} ` +
//         `(${this.displayDate(conflictingVisit.visitDate)} - ` +
//         `${new Date(new Date(conflictingVisit.visitDate).getTime() + Number(conflictingVisit.visitDuration)*60000).toLocaleTimeString()}).`
//       );
//       return;
//     }
//   }

//   const dto: CreateVisitDto = {
//     visitID: v.visitID ?? undefined,
//     visitType: v.visitType ?? '',
//     visitTypeID: Number(v.visitTypeID ?? 1),
//     visitDuration: Number(v.visitDuration ?? 0),
//     visitDate: toIsoString(v.visitDate),
//     visitFee: Number(v.visitFee ?? 0)
//   };

//   this.visitService.addVisit(dto).pipe(
//     switchMap(() => this.visitService.getAllVisits()),
//     finalize(() => this.AddBtnPressed = false)
//   ).subscribe({
//     next: (res) => { this.AllVisits = res ?? []; this.resetAddFormToNextId(); },
//     error: (err) => {
//       // If backend returns 409 with details, surface it
//       if (err?.status === 409 && err?.error?.message) alert(err.error.message);
//       else alert(err);
//     }
//   });
// }

// onEdit(): void {
//   if (this.editingId == null) return;

//   const v = this.editVisitForm.getRawValue();

//   // infer provider (doctor) for this visitID from AllDoctors
//   const visitDoctorMap = buildVisitDoctorMap(this.AllDoctors);
//   const providerId = visitDoctorMap.get(this.editingId);

//   if (providerId && v.visitDate && v.visitDuration) {
//     const { start, end } = intervalFromLocalInput(v.visitDate, Number(v.visitDuration));
//     const { conflictingVisit } = this.findOverlapForProvider(providerId, start, end, this.editingId);
//     if (conflictingVisit) {
//       alert(
//         `Time conflict with visit #${conflictingVisit.visitID} ` +
//         `(${this.displayDate(conflictingVisit.visitDate)} - ` +
//         `${new Date(new Date(conflictingVisit.visitDate).getTime() + Number(conflictingVisit.visitDuration)*60000).toLocaleTimeString()}).`
//       );
//       return;
//     }
//   }

//   const dto: UpdateVisitDto = {
//     visitID: Number(v.visitID),
//     visitType: v.visitType ?? '',
//     visitTypeID: Number(v.visitTypeID ?? 1),
//     visitDuration: Number(v.visitDuration ?? 0),
//     visitDate: toIsoString(v.visitDate),
//     visitFee: Number(v.visitFee ?? 0)
//   };

//   this.visitService.updateVisit(this.editingId, dto).pipe(
//     switchMap(() => this.visitService.getAllVisits()),
//     finalize(() => this.deactivateEditForm())
//   ).subscribe({
//     next: (res) => this.AllVisits = res ?? [],
//     error: (err) => {
//       if (err?.status === 409 && err?.error?.message) alert(err.error.message);
//       else alert(err);
//     }
//   });
// }


// should i replace my onSubmit with this one?
@Component({
  selector: 'app-visit-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, BusinessHoursDirective],
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

  constructor(private visitService: VisitDataService, private patient_data: PatientDataService, private doctor_data: DoctorDataService) { }
  AllPatients!: Patient[];
  AllDoctors!: Doctor[];

  ngOnInit(): void {
    this.patient_data.getAllPatients().subscribe(
      {
        next: (res) => {
          this.AllPatients = res;
        },
        error: (err) => {
          alert("error in loading patient data");
        }
      }
    )
    this.doctor_data.getAllDoctors().subscribe(
      {
        next: (res) => {
          this.AllDoctors = res;
        },
        error: (err) => {
          alert("error in loading doctor data");
        }
      }
    )

    this.addVisitForm = new FormGroup({
      visitID: new FormControl<number | null>(null, [Validators.required]),
      visitType: new FormControl<string>('', [Validators.required]),
      visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required]),
      visitDate: new FormControl<string | null>(null), // bound to datetime-local
      visitFee: new FormControl<number | null>(null)
    });

    this.editVisitForm = new FormGroup({
      visitID: new FormControl<number | null>(null, [Validators.required]),
      visitType: new FormControl<string>(''),
      visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required]),
      visitDate: new FormControl<string | null>(null),
      visitFee: new FormControl<number | null>(null)
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
      visitType: row.visitType ?? '',
      visitTypeID: row.visitTypeID ?? 1,
      visitDuration: row.visitDuration ?? null,
      visitDate: toLocalInputValue(row.visitDate),
      visitFee: row.visitFee ?? null
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
      visitID: v.visitID ?? undefined,
      visitType: v.visitType ?? '',
      visitTypeID: Number(v.visitTypeID ?? 1),
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate: toIsoString(v.visitDate),
      visitFee: Number(v.visitFee ?? 0)
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
      visitID: Number(v.visitID),
      visitType: v.visitType ?? '',
      visitTypeID: Number(v.visitTypeID ?? 1),
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate: toIsoString(v.visitDate),
      visitFee: Number(v.visitFee ?? 0)
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
      const d = parseServerDate(iso);   // <-- use the normalizer
      return isNaN(+d) ? iso : d.toLocaleString();
    } catch {
      return iso;
    }
  }
  // INSIDE class VisitDashboardComponent
private findOverlapForProvider(
  providerId: number,
  candidateStart: Date,
  candidateEnd: Date,
  excludeVisitId?: number
): { conflictingVisit: Visit | null } {
  if (!providerId || !this.AllVisits?.length || !this.AllDoctors?.length) {
    return { conflictingVisit: null };
  }

  const visitDoctorMap = buildVisitDoctorMap(this.AllDoctors);

  for (const v of this.AllVisits) {
    const vId = Number(v.visitID);
    if (excludeVisitId && vId === excludeVisitId) continue; // don't compare against itself

    const vProvider = visitDoctorMap.get(vId);
    if (vProvider !== providerId) continue;

    const { start, end } = intervalFromServer(v.visitDate!, Number(v.visitDuration ?? 0));
    if (intervalsOverlap(candidateStart, candidateEnd, start, end)) {
      return { conflictingVisit: v };
    }
  }
  return { conflictingVisit: null };
}




}

// Helper functions
function parseServerDate(value: string): Date {
  if (!value) return new Date(NaN);
  const hasZone = /Z|[+-]\d{2}:\d{2}$/.test(value);
  const normalized = hasZone ? value : value + 'Z';
  return new Date(normalized);
}

function toIsoString(localValue: string | null): string {
  if (!localValue) return new Date().toISOString();
  return new Date(localValue).toISOString(); // local -> UTC
}

function toLocalInputValue(iso: string | null): string | null {
  if (!iso) return null;
  const d = parseServerDate(iso);
  if (isNaN(+d)) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// ===== Overlap helpers =====

// Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd)
function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// Build a doctor map: visitID -> doctorID
function buildVisitDoctorMap(allDoctors: any[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const d of allDoctors ?? []) {
    // assumes your Doctor model has doctorID and visitID
    if (d?.visitID != null && d?.doctorID != null) {
      m.set(Number(d.visitID), Number(d.doctorID));
    }
  }
  return m;
}

// Compute [start,end) for a visit from a local input string and minutes
function intervalFromLocalInput(localStr: string, durationMin: number): { start: Date; end: Date } {
  const start = new Date(localStr);             // local
  const end   = new Date(start.getTime() + durationMin * 60_000);
  return { start, end };
}

// Compute [start,end) for a visit already stored (server value may be UTC or naive)
function intervalFromServer(isoOrNaive: string, durationMin: number): { start: Date; end: Date } {
  const start = parseServerDate(isoOrNaive);    // you already added this in the previous step
  const end   = new Date(start.getTime() + durationMin * 60_000);
  return { start, end };
}
