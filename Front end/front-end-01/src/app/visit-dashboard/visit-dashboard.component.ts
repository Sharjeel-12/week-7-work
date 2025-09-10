import { Component, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators, ValidatorFn, AbstractControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, switchMap, finalize } from 'rxjs/operators';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit, CreateVisitDto, UpdateVisitDto } from '../models/visit';
import { Patient } from '../models/patient';
import { Doctor } from '../models/doctor';
import { PatientDataService } from '../Services/patient-data.service';
import { DoctorDataService } from '../Services/doctor-data.service';
import { BusinessHoursDirective } from '../directives/business-hours.directive';
import { PatientNamePipe } from '../pipes/patient-name.pipe';
import { DoctorNamePipe } from '../pipes/doctor-name.pipe';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';

type SortableKey = 'visitID' | 'visitDate' | 'visitDuration' | 'doctorID' | 'patientID' | 'visitType';

interface ConflictCandidate {
  visit: Visit;
  score: number;       // 0..1
  reasons: string[];   // human-friendly reasons
}

@Component({
  selector: 'app-visit-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, BusinessHoursDirective, PatientNamePipe, DoctorNamePipe, CurrencyPipe, DatePipe,DecimalPipe],
  templateUrl: './visit-dashboard.component.html',
  styleUrls: ['./visit-dashboard.component.scss']
})
export class VisitDashboardComponent implements OnInit {
  AllVisits: Visit[] = [];
  AllPatients: Patient[] = [];
  AllDoctors: Doctor[] = [];

  // UI state
  AddBtnPressed = false;
  EditBtnPressed = false;
  private editingId: number | null = null;
  math = Math;

  // Config
  readonly durationOptions = [15, 30, 60];
  // Match your directive attributes (09:00–21:00)
  readonly businessHours = { startHour: 9, endHour: 21 };

  // visit type -> id mapping (if your API needs it)
  private readonly visitTypeMap: Record<string, number> = {
    'Consultation': 1,
    'Follow-Up': 2,
    'Emergency': 3
  };

  // Forms
  addVisitForm!: FormGroup;
  editVisitForm!: FormGroup;
  get AddForm()  { return this.addVisitForm.controls; }
  get EditForm() { return this.editVisitForm.controls; }

  // Search / sort / pagination
  searchFC = new FormControl<string>('', { nonNullable: true });
  sortBy: SortableKey = 'visitDate';
  sortDir: 'asc' | 'desc' = 'asc';

  page = 1;
  pageSize = 5;
  pageSizeOptions = [5, 10, 20, 50, 100];
  total = 0;

  filteredVisits: Visit[] = [];
  visibleVisits: Visit[] = [];

  // Conflict panel
  showConflictPanel = false;
  conflictCandidates: ConflictCandidate[] = [];
  hardConflict = false;
  private pendingAdd?: { dto: CreateVisitDto; visit: Visit };
  private pendingEdit?: { id: number; dto: UpdateVisitDto; visit: Visit };

  constructor(
    private visitService: VisitDataService,
    private patient_data: PatientDataService,
    private doctor_data: DoctorDataService
  ) {}

  /* ================= lifecycle ================= */
  ngOnInit(): void {
    // Lookups
    this.patient_data.getAllPatients().subscribe({
      next: (res) => { this.AllPatients = res ?? []; this.applyFilters(); },
      error: () => alert('Error loading patient data')
    });

    this.doctor_data.getAllDoctors().subscribe({
      next: (res) => { this.AllDoctors = res ?? []; this.applyFilters(); },
      error: () => alert('Error loading doctor data')
    });

    // Forms
    this.addVisitForm = new FormGroup({
      visitID:       new FormControl<number | null>(null, [Validators.required]),
      visitType:     new FormControl<string>('', [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required, allowedDurations(this.durationOptions)]),
      visitDate:     new FormControl<string | null>(null, [Validators.required]),
      visitFee:      new FormControl<number | null>(null),
      patientID:     new FormControl<number | null>(null, [Validators.required]),
      doctorID:     new FormControl<number | null>(null, [Validators.required]),
    });

    this.editVisitForm = new FormGroup({
      visitID:       new FormControl<number | null>(null, [Validators.required]),
      visitType:     new FormControl<string>('', [Validators.required]),
      visitDuration: new FormControl<number | null>(null, [Validators.required, allowedDurations(this.durationOptions)]),
      visitDate:     new FormControl<string | null>(null, [Validators.required]),
      visitFee:      new FormControl<number | null>(null),
      patientID:     new FormControl<number | null>(null, [Validators.required]),
      doctorID:      new FormControl<number | null>(null, [Validators.required]),
    });

    // Data
    this.reloadVisitsAndResetId();

    // Live search
    this.searchFC.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => { this.page = 1; this.applyFilters(); });
  }

  /* ================= UI actions ================= */
  activateForm(): void { this.AddBtnPressed = true; }
  deactivateForm(): void { this.AddBtnPressed = false; this.resetAddFormToNextId(); }

  activateEditForm(row: Visit): void {
    this.editingId = Number(row.visitID);
    this.EditBtnPressed = true; this.AddBtnPressed = false;

    this.editVisitForm.patchValue({
      visitID:       row.visitID ?? null,
      visitType:     row.visitType ?? '',
      visitDuration: row.visitDuration ?? null,
      visitDate:     toLocalInputValue(row.visitDate),
      visitFee:      row.visitFee ?? null,
      patientID:     row.patientID ?? null,
      doctorID:      row.doctorID ?? null,
    });
  }

  deactivateEditForm(): void {
    this.EditBtnPressed = false;
    this.editVisitForm.reset();
    this.editingId = null;
  }

  /* ================= CRUD ================= */
  onSubmit(): void {
    const v = this.addVisitForm.getRawValue();

    // Guards
    if (!withinBusinessHours(v.visitDate, Number(v.visitDuration), this.businessHours)) {
      alert(`Visit must be within business hours (${this.businessHours.startHour}:00–${this.businessHours.endHour}:00).`);
      return;
    }

    const candidateVisit: Visit = {
      visitID:       v.visitID ?? 0,
      visitType:     v.visitType ?? '',
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate:     toIsoString(v.visitDate),
      visitFee:      Number(v.visitFee ?? 0),
      patientID:     Number(v.patientID),
      doctorID:      Number(v.doctorID),
    } as Visit;

    const { candidates, hard } = this.detectVisitConflicts(candidateVisit, this.AllVisits);
    if (candidates.length > 0) {
      this.conflictCandidates = candidates;
      this.hardConflict = hard;
      this.showConflictPanel = true;
      const dto: CreateVisitDto = {
        visitID: candidateVisit.visitID,
        visitType: candidateVisit.visitType,
        visitTypeID: this.visitTypeMap[candidateVisit.visitType ?? 'Consultation'],
        visitDuration: candidateVisit.visitDuration!,
        visitDate: candidateVisit.visitDate!,
        visitFee: candidateVisit.visitFee!,
        patientID: candidateVisit.patientID!,
        doctorID: candidateVisit.doctorID!,
      } as any;
      this.pendingAdd = { dto, visit: candidateVisit };
      return;
    }

    // proceed
    const dto: CreateVisitDto = {
      visitID: v.visitID ?? undefined,
      visitType: v.visitType ?? '',
      visitTypeID: this.visitTypeMap[v.visitType ?? 'Consultation'],
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate: toIsoString(v.visitDate),
      visitFee: Number(v.visitFee ?? 0),
      patientID: Number(v.patientID),
      doctorID: Number(v.doctorID),
    } as any;

    this.visitService.addVisit(dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => (this.AddBtnPressed = false))
    ).subscribe({
      next: (res) => { this.AllVisits = res ?? []; this.rebuildAfterDataChange(); this.resetAddFormToNextId(); },
      error: (err) => { if (err?.status === 409 && err?.error?.message) alert(err.error.message); else alert(err); }
    });
  }

  onEdit(): void {
    if (this.editingId == null) return;
    const v = this.editVisitForm.getRawValue();

    if (!withinBusinessHours(v.visitDate, Number(v.visitDuration), this.businessHours)) {
      alert(`Visit must be within business hours (${this.businessHours.startHour}:00–${this.businessHours.endHour}:00).`);
      return;
    }

    const updatedVisit: Visit = {
      visitID:       Number(v.visitID),
      visitType:     v.visitType ?? '',
      visitDuration: Number(v.visitDuration ?? 0),
      visitDate:     toIsoString(v.visitDate),
      visitFee:      Number(v.visitFee ?? 0),
      patientID:     Number(v.patientID),
      doctorID:      Number(v.doctorID),
    } as Visit;

    const others = this.AllVisits.filter(x => x.visitID !== updatedVisit.visitID);
    const { candidates, hard } = this.detectVisitConflicts(updatedVisit, others);

    if (candidates.length > 0) {
      this.conflictCandidates = candidates;
      this.hardConflict = hard;
      this.showConflictPanel = true;

      const dto: UpdateVisitDto = {
        visitID: updatedVisit.visitID!,
        visitType: updatedVisit.visitType!,
        visitTypeID: this.visitTypeMap[updatedVisit.visitType ?? 'Consultation'],
        visitDuration: updatedVisit.visitDuration!,
        visitDate: updatedVisit.visitDate!,
        visitFee: updatedVisit.visitFee!,
        patientID: updatedVisit.patientID!,
        doctorID: updatedVisit.doctorID!,
      } as any;

      this.pendingEdit = { id: updatedVisit.visitID!, dto, visit: updatedVisit };
      return;
    }

    this.performEdit(this.editingId, {
      visitID: updatedVisit.visitID,
      visitType: updatedVisit.visitType,
      visitTypeID: this.visitTypeMap[updatedVisit.visitType ?? 'Consultation'],
      visitDuration: updatedVisit.visitDuration!,
      visitDate: updatedVisit.visitDate!,
      visitFee: updatedVisit.visitFee!,
      patientID: updatedVisit.patientID!,
      doctorID: updatedVisit.doctorID!,
    } as any, updatedVisit);
  }

  private performEdit(id: number, dto: UpdateVisitDto, updatedVisit: Visit) {
    this.visitService.updateVisit(id, dto).pipe(
      switchMap(() => this.visitService.getAllVisits()),
      finalize(() => this.deactivateEditForm())
    ).subscribe({
      next: (res) => { this.AllVisits = res ?? []; this.rebuildAfterDataChange(); },
      error: (err) => { if (err?.status === 409 && err?.error?.message) alert(err.error.message); else alert(err); }
    });
  }

  deleteAction(id: number | null): void {
    if (id == null) return;
    this.visitService.deleteVisit(id).pipe(
      switchMap(() => this.visitService.getAllVisits())
    ).subscribe({
      next: (res) => { this.AllVisits = res ?? []; 
        const maxPage = Math.max(1, Math.ceil((this.total - 1) / this.pageSize));
        if (this.page > maxPage) this.page = maxPage;
        this.rebuildAfterDataChange();
        alert('Deleted visit successfully');
      },
      error: (err) => alert(err)
    });
  }

  /* ============ Conflict panel actions ============ */
  proceedAnyway() {
    if (this.hardConflict) return; // safety
    if (this.pendingAdd) {
      const { dto, visit } = this.pendingAdd;
      this.resetConflictPanel();
      this.visitService.addVisit(dto).pipe(
        switchMap(() => this.visitService.getAllVisits())
      ).subscribe({
        next: (res) => { this.AllVisits = res ?? []; this.rebuildAfterDataChange(); this.AddBtnPressed = false; this.resetAddFormToNextId(); },
        error: (err) => alert(err)
      });
      return;
    }
    if (this.pendingEdit) {
      const { id, dto, visit } = this.pendingEdit;
      this.resetConflictPanel();
      this.performEdit(id, dto, visit);
    }
  }

  cancelConflictPanel() { this.resetConflictPanel(); }
  private resetConflictPanel() {
    this.showConflictPanel = false;
    this.conflictCandidates = [];
    this.hardConflict = false;
    this.pendingAdd = undefined;
    this.pendingEdit = undefined;
  }

  /* ============ Search / Sort / Pagination ============ */
  onSort(col: SortableKey): void {
    if (this.sortBy === col) this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    else { this.sortBy = col; this.sortDir = 'asc'; }
    this.page = 1; this.applyFilters();
  }
  sortArrow(col: SortableKey) { return this.sortBy === col ? (this.sortDir === 'asc' ? '▲' : '▼') : ''; }

  changePageSize(size: number | string) {
    this.pageSize = Number(size) || 10;
    this.page = 1; this.applyFilters();
  }
  nextPage() {
    const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
    if (this.page < maxPage) { this.page++; this.applyFilters(); }
  }
  prevPage() { if (this.page > 1) { this.page--; this.applyFilters(); } }
  goToPage(p: number) {
    const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
    this.page = Math.min(Math.max(1, p), maxPage);
    this.applyFilters();
  }

  private filterRows(): Visit[] {
    const q = (this.searchFC.value ?? '').trim().toLowerCase();
    if (!q) return this.AllVisits;

    const isNumeric = /^[0-9]+$/.test(q);
    const looksDate = /\d{4}-\d{2}-\d{2}/.test(q); // yyyy-mm-dd

    const nameOfPatient = (id?: number | null) =>
      (this.AllPatients.find(p => p.patientID === id)?.patientName ?? '').toLowerCase();
    const nameOfDoctor = (id?: number | null) =>
      (this.AllDoctors.find(d => d.doctorID === id)?.doctorName ?? '').toLowerCase();

    return this.AllVisits.filter(v => {
      const type = (v.visitType ?? '').toString().toLowerCase();
      const dateStr = (v.visitDate ?? '').toLowerCase();
      const humanDate = new Date(v.visitDate ?? '').toLocaleString().toLowerCase();
      const pat = nameOfPatient(v.patientID);
      const doc = nameOfDoctor(v.doctorID);

      if (isNumeric) {
        if (v.visitID === Number(q)) return true;
        if (v.patientID === Number(q)) return true;
        if (v.doctorID === Number(q)) return true;
        if ((v.visitDuration ?? 0) === Number(q)) return true;
        return false;
      }
      if (looksDate) return dateStr.includes(q) || humanDate.includes(q);

      return type.includes(q) || pat.includes(q) || doc.includes(q) || humanDate.includes(q);
    });
  }

  private sortRows(rows: Visit[]): Visit[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortBy;

    const nameOfPatient = (id?: number | null) =>
      (this.AllPatients.find(p => p.patientID === id)?.patientName ?? '').toLowerCase();
    const nameOfDoctor = (id?: number | null) =>
      (this.AllDoctors.find(d => d.doctorID === id)?.doctorName ?? '').toLowerCase();

    return [...rows].sort((a: any, b: any) => {
      if (key === 'visitID')       return (a.visitID - b.visitID) * dir;
      if (key === 'visitDuration') return ((a.visitDuration ?? 0) - (b.visitDuration ?? 0)) * dir;
      if (key === 'visitDate')     return (new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()) * dir;
      if (key === 'patientID') {
        const pa = nameOfPatient(a.patientID), pb = nameOfPatient(b.patientID);
        return pa < pb ? -1 * dir : pa > pb ? 1 * dir : 0;
      }
      if (key === 'doctorID') {
        const da = nameOfDoctor(a.doctorID), db = nameOfDoctor(b.doctorID);
        return da < db ? -1 * dir : da > db ? 1 * dir : 0;
      }
      // visitType (string)
      const va = (a.visitType ?? '').toString().toLowerCase();
      const vb = (b.visitType ?? '').toString().toLowerCase();
      return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
    });
  }

  private applyFilters(): void {
    const filtered = this.filterRows();
    const sorted = this.sortRows(filtered);

    this.total = sorted.length;

    const start = (this.page - 1) * this.pageSize;
    const end = start + this.pageSize;

    this.filteredVisits = sorted;
    this.visibleVisits = sorted.slice(start, end);
  }

  private rebuildAfterDataChange(): void {
    this.applyFilters();
  }

  /* ================= Data + helpers ================= */
  private reloadVisitsAndResetId(): void {
    this.visitService.getAllVisits().subscribe({
      next: (res) => { this.AllVisits = res ?? []; this.rebuildAfterDataChange(); this.resetAddFormToNextId(); },
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
      return isNaN(+d) ? iso! : d.toLocaleString();
    } catch { return iso!; }
  }

  /* ================= Conflict detection ================= */
  private detectVisitConflicts(candidate: Visit, pool: Visit[]): { candidates: ConflictCandidate[]; hard: boolean } {
    const out: ConflictCandidate[] = [];
    let hard = false;

    const { start: cStart, end: cEnd } = intervalFromServer(candidate.visitDate!, candidate.visitDuration || 0);

    for (const v of pool) {
      const reasons: string[] = [];
      let score = 0;

      const sameDoctor  = Number(v.doctorID)  === Number(candidate.doctorID);
      const samePatient = Number(v.patientID) === Number(candidate.patientID);

      const { start: vStart, end: vEnd } = intervalFromServer(v.visitDate!, v.visitDuration || 0);
      const overlap = intervalsOverlap(cStart, cEnd, vStart, vEnd);

      if (sameDoctor && overlap) { reasons.push('Same doctor overlapping time'); score += 1.0; hard = true; }
      if (samePatient && overlap) { reasons.push('Same patient overlapping time'); score += 0.75; /* hard = true; */ }

      // Soft signals
      if (samePatient && isSameLocalDay(cStart, vStart)) { reasons.push('Same patient on the same day'); score += 0.35; }
      const startDiffMin = Math.abs((cStart.getTime() - vStart.getTime()) / 60000);
      if (sameDoctor && !overlap && startDiffMin <= 15) { reasons.push('Same doctor within ±15 minutes'); score += 0.35; }

      const typeEqual = (candidate.visitType ?? '').toLowerCase() === (v.visitType ?? '').toLowerCase();
      if (typeEqual && Math.abs(cStart.getTime() - vStart.getTime()) <= 120 * 60000) {
        reasons.push('Same visit type within 2 hours'); score += 0.15;
      }

      if (reasons.length && (hard || score >= 0.5)) out.push({ visit: v, score: Math.min(1, score), reasons });
    }

    out.sort((a, b) => b.score - a.score);
    return { candidates: out, hard };
  }
}

/* ================= Helpers ================= */
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

function intervalsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart; // half-open [start,end)
}

function intervalFromServer(iso: string, durationMin: number): { start: Date; end: Date } {
  const start = parseServerDate(iso);
  const end   = new Date(start.getTime() + Math.max(0, durationMin) * 60_000);
  return { start, end };
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
}

function withinBusinessHours(localDateStr: string | null, durationMin: number, hours: { startHour: number; endHour: number }): boolean {
  if (!localDateStr) return false;
  const start = new Date(localDateStr);
  const end = new Date(start.getTime() + Math.max(0, durationMin) * 60_000);
  const sH = hours.startHour, eH = hours.endHour;
  return start.getHours() >= sH &&
         (end.getHours() < eH || (end.getHours() === eH && end.getMinutes() === 0));
}
