import { Component, OnInit } from '@angular/core';
import { PatientDataService } from '../Services/patient-data.service';
import { Patient } from '../models/patient';
import { CreatePatientDto } from '../models/create-patient-dto';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { VisitDataService } from '../Services/visits-data.service';
import { Visit } from '../models/visit';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { DecimalPipe } from '@angular/common';

type SortableKey = 'patientID' | 'patientName' | 'patientEmail' | 'patientPhone' | 'patientDescription';

interface DuplicateCandidate {
  patient: Patient;
  score: number;        // 0..1
  reasons: string[];
}

@Component({
  selector: 'app-patient-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule,DecimalPipe],
  providers: [PatientDataService],
  templateUrl: './patient-dashboard.component.html',
  styleUrl: './patient-dashboard.component.scss'
})
export class PatientDashboardComponent implements OnInit {

  constructor(private dataService: PatientDataService, private visit_data: VisitDataService) {}

  AllVisits!: Visit[];
  math=Math;
  addPatientForm!: FormGroup;
  editPatientForm!: FormGroup;
  get AddForm(){ return this.addPatientForm.controls; }
  get EditForm(){ return this.editPatientForm.controls; }

  AllPatients: Patient[] = [];
  filteredPatients: Patient[] = [];
  visiblePatients: Patient[] = [];

  AddBtnPressed = false;
  EditBtnPressed = false;

  last_id!: number | null | undefined;

  // ---- client-side search/sort/pagination ----
  searchFC = new FormControl<string>('', { nonNullable: true });

  sortBy: SortableKey = 'patientID';
  sortDir: 'asc' | 'desc' = 'asc';

  page = 1;
  pageSize = 10;
  pageSizeOptions = [5, 10, 20, 50, 100];
  total = 0;

  // ---- duplicate panel state ----
  showDuplicatePanel = false;
  duplicateCandidates: DuplicateCandidate[] = [];
  hardDuplicate = false; // true if same ID/email/phone found
  private pendingAdd?: { dto: CreatePatientDto; patient: Patient };

  // ---------- UI actions ----------
  activateForm(): void { this.AddBtnPressed = true; }
  deactivateForm(): void { this.AddBtnPressed = false; }
  deactivateEditForm(): void { this.EditBtnPressed = false; }

  // ---------- Add ----------
  onSubmit(): void {
    const dto: CreatePatientDto = {
      patientID: this.addPatientForm.value.patientID,
      patientName: this.addPatientForm.value.patientName,
      patientEmail: this.addPatientForm.value.patientEmail,
      patientPhone: this.addPatientForm.value.patientPhone,
      patientDescription: this.addPatientForm.value.patientDescription,
    };

    const patient: Patient = {
      patientID: this.addPatientForm.value.patientID,
      visitID: null,
      patientName: this.addPatientForm.value.patientName,
      patientEmail: this.addPatientForm.value.patientEmail,
      patientPhone: this.addPatientForm.value.patientPhone,
      patientDescription: this.addPatientForm.value.patientDescription,
    };

    // PRE-SUBMIT duplicate scan
    const { candidates, hard } = this.detectDuplicates(patient, this.AllPatients);
    if (candidates.length > 0) {
      this.duplicateCandidates = candidates;
      this.hardDuplicate = hard;
      this.showDuplicatePanel = true;
      this.pendingAdd = { dto, patient };
      return; // stop here; user must choose
    }

    // no duplicates -> create
    this.performAdd(dto, patient);
  }

  private performAdd(dto: CreatePatientDto, patient: Patient) {
    this.dataService.AddNewPatient(dto).subscribe({
      next: () => {
        this.AllPatients = [...this.AllPatients, patient];
        this.rebuildAfterDataChange();
        alert('Patient Added Successfully');
        this.AddBtnPressed = false;

        // bump the next suggested id
        this.last_id = Math.max(...this.AllPatients.map(p => p.patientID ?? 0));
        const idCtrl = this.addPatientForm.get('patientID');
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)]);
        idCtrl?.updateValueAndValidity();
      },
      error: (err) => { alert(err); }
    });
  }

  // Duplicate panel actions
  proceedAddAnyway() {
    if (!this.pendingAdd) return;
    if (this.hardDuplicate) return; // safety
    const { dto, patient } = this.pendingAdd;
    this.showDuplicatePanel = false;
    this.duplicateCandidates = [];
    this.pendingAdd = undefined;
    this.performAdd(dto, patient);
  }

  cancelDuplicatePanel() {
    this.showDuplicatePanel = false;
    this.duplicateCandidates = [];
    this.hardDuplicate = false;
    this.pendingAdd = undefined;
  }

  useExisting(p: Patient) {
    this.activateEditForm(p);
    this.cancelDuplicatePanel();
  }

  // ---------- Edit ----------
  activateEditForm(p: Patient): void {
    this.editPatientForm.patchValue({
      patientID: p.patientID,
      visitID: p.visitID ?? null,
      patientName: p.patientName,
      patientEmail: p.patientEmail,
      patientPhone: p.patientPhone,
      patientDescription: p.patientDescription ?? ''
    });
    this.EditBtnPressed = true;
  }

  onEdit(): void {
    const patient: Patient = {
      patientID: this.editPatientForm.value.patientID,
      visitID: this.editPatientForm.value.visitID,
      patientName: this.editPatientForm.value.patientName,
      patientEmail: this.editPatientForm.value.patientEmail,
      patientPhone: this.editPatientForm.value.patientPhone,
      patientDescription: this.editPatientForm.value.patientDescription,
    };

    // keep current id, compare against others for email/phone conflicts
    const others = this.AllPatients.filter(p => p.patientID !== patient.patientID);
    const { candidates, hard } = this.detectDuplicates(patient, others);
    if (hard) {
      // block edit if hard conflict with someone else
      alert('Edit would conflict with an existing record (same email or phone).');
      return;
    }

    this.dataService.UpdatePatient(patient.patientID, patient).subscribe({
      next: () => {
        const idx = this.AllPatients.findIndex(p => p.patientID === patient.patientID);
        if (idx >= 0) {
          const clone = [...this.AllPatients];
          clone[idx] = patient;
          this.AllPatients = clone;
          this.rebuildAfterDataChange();
        }
        alert('The record of the patient has been updated');
        this.EditBtnPressed = false;
      }
    });
  }

  // ---------- Delete ----------
  deleteAction(id: number): void {
    if (this.AllVisits?.some(v => v.patientID == id)) {
      alert('Sorry this patient record cannot be deleted as this patient has a scheduled appointment');
      return;
    }

    this.dataService.deletePatientByID(id).subscribe({
      next: () => {
        this.AllPatients = this.AllPatients.filter(p => p.patientID !== id);
        const maxPage = Math.max(1, Math.ceil((this.total - 1) / this.pageSize));
        if (this.page > maxPage) this.page = maxPage;
        this.rebuildAfterDataChange();
        alert('Deleted patient record successfully');
      }
    });
  }

  // ---------- Duplicate detection ----------
  private detectDuplicates(candidate: Patient, pool: Patient[]): { candidates: DuplicateCandidate[]; hard: boolean } {
    const out: DuplicateCandidate[] = [];
    let hard = false;

    const norm = (s: any) => (s ?? '').toString().trim().toLowerCase();
    const normPhone = (s: any) => (s ?? '').toString().replace(/\D+/g, '');
    const name0 = norm(candidate.patientName);
    const email0 = norm(candidate.patientEmail);
    const phone0 = normPhone(candidate.patientPhone);
    const id0 = candidate.patientID ?? null;

    for (const p of pool) {
      const reasons: string[] = [];
      let score = 0;

      const name  = norm(p.patientName);
      const email = norm(p.patientEmail);
      const phone = normPhone(p.patientPhone);

      // Hard conflicts
      if (id0 != null && p.patientID === id0) { reasons.push('Same patient ID'); score += 1.0; hard = true; }
      if (email0 && email && email0 === email) { reasons.push('Same email'); score += 0.9; hard = true; }
      if (phone0 && phone && phone0 === phone) { reasons.push('Same phone'); score += 0.9; hard = true; }

      // Soft similarity
      const nameSim = this.diceCoefficient(name0, name); // 0..1
      if (name0 && name && nameSim >= 0.84) {
        reasons.push(`Similar name (${Math.round(nameSim * 100)}%)`);
        score += 0.5 * nameSim;
      }

      // Phone tail match
      if (phone0 && phone && phone0.length >= 7 && phone.length >= 7) {
        if (phone0.slice(-7) === phone.slice(-7)) { reasons.push('Phone tail matches'); score += 0.35; }
        else if (phone0.slice(-5) === phone.slice(-5)) { reasons.push('Phone last 5 match'); score += 0.2; }
      }

      // Email local-part similarity
      if (email0 && email) {
        const lp0 = email0.split('@')[0];
        const lp  = email.split('@')[0];
        const lpSim = this.diceCoefficient(lp0, lp);
        if (lp0 === lp) { reasons.push('Email local-part identical'); score += 0.25; }
        else if (lpSim >= 0.8) { reasons.push(`Email local-part similar (${Math.round(lpSim * 100)}%)`); score += 0.15; }
      }

      if (reasons.length > 0) {
        // Include if hard conflict or total score >= 0.5
        if (hard || score >= 0.5) {
          out.push({ patient: p, score: Math.min(1, score), reasons });
        }
      }
    }

    out.sort((a, b) => b.score - a.score);
    return { candidates: out, hard };
  }

  private diceCoefficient(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const bigrams = (s: string) => {
      const arr: string[] = [];
      for (let i = 0; i < s.length - 1; i++) arr.push(s.substring(i, i + 2));
      return arr;
    };
    const a2 = bigrams(a);
    const b2 = bigrams(b);
    if (a2.length === 0 || b2.length === 0) return 0;
    const map = new Map<string, number>();
    for (const g of a2) map.set(g, (map.get(g) ?? 0) + 1);
    let overlap = 0;
    for (const g of b2) {
      const c = map.get(g);
      if (c && c > 0) { overlap++; map.set(g, c - 1); }
    }
    return (2 * overlap) / (a2.length + b2.length);
  }

  // ---------- Filtering (search) ----------
  private filterRows(): Patient[] {
    const q = (this.searchFC.value ?? '').trim().toLowerCase();
    if (!q) return this.AllPatients;

    const isNumeric = /^[0-9]+$/.test(q);
    const looksEmail = q.includes('@');

    return this.AllPatients.filter(p => {
      const name  = (p.patientName ?? '').toLowerCase();
      const email = (p.patientEmail ?? '').toLowerCase();
      const phone = (p.patientPhone ?? '').toLowerCase();
      const desc  = (p.patientDescription ?? '').toLowerCase();

      if (isNumeric) {
        if (p.patientID === Number(q)) return true;
        if (phone.includes(q)) return true;
        return false;
      }
      if (looksEmail) return email.includes(q);

      return name.includes(q) || email.includes(q) || phone.includes(q) || desc.includes(q);
    });
  }

  // ---------- Sorting ----------
  onSort(col: SortableKey): void {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.page = 1;
    this.applyFilters();
  }

  private sortRows(rows: Patient[]): Patient[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortBy;

    return [...rows].sort((a: any, b: any) => {
      if (key === 'patientID') {
        return (a.patientID - b.patientID) * dir;
      }
      const va = (a?.[key] ?? '').toString().toLowerCase();
      const vb = (b?.[key] ?? '').toString().toLowerCase();
      return va < vb ? -1 * dir : va > vb ? 1 * dir : 0;
    });
  }

  sortArrow(col: SortableKey) {
    return this.sortBy === col ? (this.sortDir === 'asc' ? '▲' : '▼') : '';
    }

  // ---------- Pagination ----------
  changePageSize(size: number | string) {
    this.pageSize = Number(size) || 10;
    this.page = 1;
    this.applyFilters();
  }

  nextPage() {
    const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
    if (this.page < maxPage) {
      this.page++;
      this.applyFilters();
    }
  }
  prevPage() {
    if (this.page > 1) {
      this.page--;
      this.applyFilters();
    }
  }
  goToPage(p: number) {
    const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
    this.page = Math.min(Math.max(1, p), maxPage);
    this.applyFilters();
  }

  // ---------- Pipeline ----------
  private applyFilters(): void {
    const filtered = this.filterRows();
    const sorted   = this.sortRows(filtered);

    this.total = sorted.length;

    const start = (this.page - 1) * this.pageSize;
    const end   = start + this.pageSize;

    this.filteredPatients = sorted;
    this.visiblePatients  = sorted.slice(start, end);
  }

  private rebuildAfterDataChange(): void {
    this.applyFilters();
  }

  // ---------- lifecycle ----------
  ngOnInit(): void {
    // Load visits (for delete guard)
    this.visit_data.getAllVisits().subscribe({
      next: (res) => { this.AllVisits = res; },
      error: () => { alert('visit data Loading Failed'); }
    });

    // Forms
    this.editPatientForm = new FormGroup({
      patientID:         new FormControl<number | null>(null, [Validators.required]),
      patientName:       new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
      visitID:           new FormControl<number | null>(null),
      patientEmail:      new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
      patientPhone:      new FormControl<string | null>('', [Validators.required]),
      patientDescription:new FormControl<string | null>('')
    });

    this.addPatientForm = new FormGroup({
      patientID:         new FormControl<number | null>(null, [Validators.required]),
      patientName:       new FormControl<string | null>('', [Validators.required, Validators.minLength(10)]),
      patientEmail:      new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(10)]),
      patientPhone:      new FormControl<string | null>('', [Validators.required]),
      patientDescription:new FormControl<string | null>('')
    });

    // Load patients
    this.dataService.getAllPatients().subscribe({
      next: (res) => {
        this.AllPatients = res ?? [];
        // init last_id + suggest next
        this.last_id = this.AllPatients.length ? Math.max(...this.AllPatients.map(p => p.patientID ?? 0)) : 0;
        const idCtrl = this.addPatientForm.get('patientID');
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)]);
        idCtrl?.updateValueAndValidity();

        // initial build
        this.applyFilters();
      },
      error: (err) => { alert(err); }
    });

    // Live search
    this.searchFC.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.applyFilters();
      });
  }
}
