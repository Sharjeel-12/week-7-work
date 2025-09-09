import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { switchMap, finalize } from 'rxjs/operators';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit, CreateVisitDto, UpdateVisitDto } from '../models/visit';
import { Patient } from '../models/patient';
import { Doctor } from '../models/doctor';
import { PatientDataService } from '../Services/patient-data.service';
import { DoctorDataService } from '../Services/doctor-data.service';
import { BusinessHoursDirective } from '../directives/business-hours.directive';
import { PatientNamePipe } from '../pipes/patient-name.pipe';
import { DoctorNamePipe } from '../pipes/doctor-name.pipe';
import { CurrencyPipe, DatePipe } from '@angular/common';

@Component({
  selector: 'app-visit-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, BusinessHoursDirective,PatientNamePipe,DoctorNamePipe,CurrencyPipe,DatePipe],
  templateUrl: './visit-dashboard.component.html',
  styleUrls: ['./visit-dashboard.component.scss']
})
export class VisitDashboardComponent implements OnInit {
  AllVisits: Visit[] = [];
  AllPatients: Patient[] = [];
  AllDoctors: Doctor[] = [];

  AddBtnPressed = false;
  EditBtnPressed = false;

  addVisitForm!: FormGroup;
  editVisitForm!: FormGroup;
  private editingId: number | null = null;

  // Config
  readonly durationOptions = [15, 30, 60];
  readonly businessHours = { startHour: 9, endHour: 17 }; // 09:00–17:00 (can be moved to settings)
  private readonly visitTypeMap: Record<string, number> = {
  'Consultation': 1,
  'Follow-Up': 2,
  'Emergency': 3
};
  constructor(
    private visitService: VisitDataService,
    private patient_data: PatientDataService,
    private doctor_data: DoctorDataService
  ) {}

  ngOnInit(): void {
    // Load lookups
    this.patient_data.getAllPatients().subscribe({
      next: (res) => (this.AllPatients = res ?? []),
      error: () => alert('Error loading patient data')
    });

    this.doctor_data.getAllDoctors().subscribe({
      next: (res) => (this.AllDoctors = res ?? []),
      error: () => alert('Error loading doctor data')
    });

    // Forms
    this.addVisitForm = new FormGroup({
      visitID: new FormControl<number | null>(null, [Validators.required]),
      visitType: new FormControl<string>('', [Validators.required]),
      // visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required, allowedDurations(this.durationOptions)]),
      visitDate: new FormControl<string | null>(null, [Validators.required]),
      visitFee: new FormControl<number | null>(null),
      patientID: new FormControl<number | null>(null, [Validators.required]),
      doctorID: new FormControl<number | null>(null, [Validators.required]),
    });

    this.editVisitForm = new FormGroup({
      visitID: new FormControl<number | null>(null, [Validators.required]),
      visitType: new FormControl<string>('', [Validators.required]),
      // visitTypeID: new FormControl<number | null>(1, [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required, allowedDurations(this.durationOptions)]),
      visitDate: new FormControl<string | null>(null, [Validators.required]),
      visitFee: new FormControl<number | null>(null),

      // NEW
      patientID: new FormControl<number | null>(null, [Validators.required]),
      doctorID: new FormControl<number | null>(null, [Validators.required]),
    });

    this.reloadVisitsAndSetNextId();
  }

  // ===== UI actions =====
  activateForm(): void { this.AddBtnPressed = true; }
  deactivateForm(): void { this.AddBtnPressed = false; this.resetAddFormToNextId(); }

  activateEditForm(row: Visit): void {
    this.editingId = Number(row.visitID);
    this.EditBtnPressed = true;

    this.editVisitForm.patchValue({
      visitID: row.visitID ?? null,
      visitType: row.visitType ?? '',
      visitTypeID: row.visitTypeID ?? 1,
      visitDuration: row.visitDuration ?? null,
      visitDate: toLocalInputValue(row.visitDate),
      visitFee: row.visitFee ?? null,
      patientID: row.patientID ?? null,
      doctorID: row.doctorID ?? null,
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

    // Guards: business hours + overlap
    if (!withinBusinessHours(v.visitDate, Number(v.visitDuration), this.businessHours)) {
      alert(`Visit must be within business hours (${this.businessHours.startHour}:00–${this.businessHours.endHour}:00).`);
      return;
    }
    const conflict = this.findOverlapForProvider(Number(v.doctorID), toDateLocal(v.visitDate!), Number(v.visitDuration ?? 0));
    if (conflict) {
      alert(`Time conflict with visit #${conflict.visitID} (${this.displayDate(conflict.visitDate)} – ${this.displayDate(addMinutes(conflict.visitDate!, Number(conflict.visitDuration ?? 0)).toISOString())}).`);
      return;
    }

    const dto: CreateVisitDto = {
      visitID: v.visitID ?? undefined,
      visitType: v.visitType ?? '',
      visitTypeID:this.visitTypeMap[v.visitType ?? 'Consultation'],
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate: toIsoString(v.visitDate),
      visitFee: Number(v.visitFee ?? 0),

      // NEW
      patientID: Number(v.patientID),
      doctorID: Number(v.doctorID),
    };

    this.visitService.addVisit(dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => (this.AddBtnPressed = false))
    ).subscribe({
      next: (res) => { this.AllVisits = res ?? []; this.resetAddFormToNextId(); },
      error: (err) => {
        if (err?.status === 409 && err?.error?.message) alert(err.error.message);
        else alert(err);
      }
    });
  }

  onEdit(): void {
    if (this.editingId == null) return;

    const v = this.editVisitForm.getRawValue();

    // Guards: business hours + overlap (exclude the visit being edited)
    if (!withinBusinessHours(v.visitDate, Number(v.visitDuration), this.businessHours)) {
      alert(`Visit must be within business hours (${this.businessHours.startHour}:00–${this.businessHours.endHour}:00).`);
      return;
    }
    const conflict = this.findOverlapForProvider(
      Number(v.doctorID),
      toDateLocal(v.visitDate!),
      Number(v.visitDuration ?? 0),
      this.editingId
    );
    if (conflict) {
      alert(`Time conflict with visit #${conflict.visitID} (${this.displayDate(conflict.visitDate)} – ${this.displayDate(addMinutes(conflict.visitDate!, Number(conflict.visitDuration ?? 0)).toISOString())}).`);
      return;
    }

    const dto: UpdateVisitDto = {
      visitID: Number(v.visitID),
      visitType: v.visitType ?? '',
      visitTypeID: this.visitTypeMap[v.visitType ?? 'Consultation'],
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate: toIsoString(v.visitDate),
      visitFee: Number(v.visitFee ?? 0),
      patientID: Number(v.patientID),
      doctorID: Number(v.doctorID),
    };

    this.visitService.updateVisit(this.editingId, dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => this.deactivateEditForm())
    ).subscribe({
      next: (res) => (this.AllVisits = res ?? []),
      error: (err) => {
        if (err?.status === 409 && err?.error?.message) alert(err.error.message);
        else alert(err);
      }
    });
  }

  deleteAction(id: number | null): void {
    if (id == null) return;
    this.visitService.deleteVisit(id).pipe(
      switchMap(() => this.visitService.getAllVisits())
    ).subscribe({
      next: (res) => (this.AllVisits = res ?? []),
      error: (err) => alert(err)
    });
  }

  // ===== Helpers =====
  private reloadVisitsAndSetNextId(): void {
    this.visitService.getAllVisits().subscribe({
      next: (res) => { this.AllVisits = res ?? []; this.resetAddFormToNextId(); },
      error: (err) => alert(err)
    });
  }

  private computeNextId(): number {
    if (!this.AllVisits?.length) return 1;
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
      visitFee: null,
      patientID: null,
      doctorID: null
    });
    this.addVisitForm.markAsPristine();
  }

  displayDate(iso: string | null): string {
    if (!iso) return '—';
    try {
      const d = parseServerDate(iso);
      return isNaN(+d) ? iso : d.toLocaleString();
    } catch {
      return iso!;
    }
  }

  /**
   * Returns the conflicting Visit (same doctorID) if any, else null.
   */
  private findOverlapForProvider(
    doctorId: number,
    candidateStartLocal: Date,
    durationMin: number,
    excludeVisitId?: number
  ): Visit | null {
    if (!doctorId || !this.AllVisits?.length) return null;

    const candidateEndLocal = new Date(candidateStartLocal.getTime() + durationMin * 60_000);

    for (const v of this.AllVisits) {
      const vId = Number(v.visitID);
      if (excludeVisitId && vId === excludeVisitId) continue;
      if (Number(v.doctorID) !== doctorId) continue;

      const { start, end } = intervalFromServer(v.visitDate!, Number(v.visitDuration ?? 0));
      if (intervalsOverlap(candidateStartLocal, candidateEndLocal, start, end)) {
        return v;
      }
    }
    return null;
  }
}

/* ================= Helper functions ================= */

function allowedDurations(allowed: number[]): ValidatorFn {
  return (ctrl: AbstractControl) => {
    const val = Number(ctrl.value);
    return allowed.includes(val) ? null : { durationNotAllowed: true };
  };
}

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

function toDateLocal(localStr: string): Date {
  return new Date(localStr); // respects local tz from <input type="datetime-local">
}

// Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd)
function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

// Compute [start,end) for a visit already stored (server value may be UTC or naive)
function intervalFromServer(isoOrNaive: string, durationMin: number): { start: Date; end: Date } {
  const start = parseServerDate(isoOrNaive);
  const end   = new Date(start.getTime() + durationMin * 60_000);
  return { start, end };
}

function addMinutes(isoStart: string, durationMin: number): Date {
  const start = parseServerDate(isoStart);
  return new Date(start.getTime() + durationMin * 60_000);
}

function withinBusinessHours(localDateStr: string | null, durationMin: number, hours: { startHour: number; endHour: number }): boolean {
  if (!localDateStr) return false;
  const start = new Date(localDateStr);
  const end = new Date(start.getTime() + durationMin * 60_000);
  const sH = hours.startHour, eH = hours.endHour;

  return start.getHours() >= sH &&
         (end.getHours() < eH || (end.getHours() === eH && end.getMinutes() === 0));
}
