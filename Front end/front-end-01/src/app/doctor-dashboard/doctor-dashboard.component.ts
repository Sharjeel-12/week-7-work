import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { DoctorDataService } from '../Services/doctor-data.service';
import { VisitDataService } from '../Services/visits-data.service';
import { Doctor } from '../models/doctor';
import { CreateDoctorDto } from '../models/create-doctor-dto';
import { Visit } from '../models/visit';

type SortKey = 'doctorID' | 'doctorName' | 'doctorEmail' | 'doctorPhone' | 'specialization';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule],
  providers: [DoctorDataService],
  templateUrl: './doctor-dashboard.component.html',
  styleUrl: './doctor-dashboard.component.scss'
})
export class DoctorDashboardComponent implements OnInit {

  constructor(private dataService: DoctorDataService, private visit_data: VisitDataService) {}

  // math helper for template (Angular can't use global Math)
  math = Math;

  AllVisits!: Visit[];

  addDoctorForm!: FormGroup;
  editDoctorForm!: FormGroup;
  get AddForm() { return this.addDoctorForm.controls; }
  get EditForm() { return this.editDoctorForm.controls; }

  // data
  AllDoctors: Doctor[] = [];
  filteredDoctors: Doctor[] = [];
  visibleDoctors: Doctor[] = []; // current page rows

  AddBtnPressed = false;
  EditBtnPressed = false;

  last_id!: number | null | undefined;

  // search/sort/pagination
  searchFC = new FormControl<string>('', { nonNullable: true });

  sortBy: SortKey = 'doctorName';
  sortDir: 'asc' | 'desc' = 'asc';

  page = 1;
  pageSize = 5;
  pageSizeOptions = [5, 10, 20, 50, 100];
  total = 0;

  // ---------- UI ----------
  activateForm(): void { this.AddBtnPressed = true; this.EditBtnPressed = false; }
  deactivateForm(): void { this.AddBtnPressed = false; }
  deactivateEditForm(): void { this.EditBtnPressed = false; }

  // ---------- Add ----------
  onSubmit(): void {
    const dto: CreateDoctorDto = {
      doctorID: this.addDoctorForm.value.doctorID,
      doctorName: this.addDoctorForm.value.doctorName,
      doctorEmail: this.addDoctorForm.value.doctorEmail,
      doctorPhone: this.addDoctorForm.value.doctorPhone,
      specialization: this.addDoctorForm.value.specialization
    };

    const doctor: Doctor = {
      doctorID: this.addDoctorForm.value.doctorID,
      visitID: null,
      doctorName: this.addDoctorForm.value.doctorName,
      doctorEmail: this.addDoctorForm.value.doctorEmail,
      doctorPhone: this.addDoctorForm.value.doctorPhone,
      specialization: this.addDoctorForm.value.specialization
    };

    if (this.AllDoctors.some(d => d.doctorID === doctor.doctorID) && doctor.doctorID != null) {
      alert('The doctor ID you just entered already exists. Please try a unique value for each doctor');
      return;
    }
    if (this.AllDoctors.some(d => d.doctorEmail === doctor.doctorEmail) && doctor.doctorEmail) {
      alert('The doctor email you just entered already exists. Please try a unique email for each doctor');
      return;
    }

    this.dataService.AddNewDoctor(dto).subscribe({
      next: () => {
        this.AllDoctors.push(doctor);
        this.applyFilters();
        alert('Doctor Added Successfully');
        this.AddBtnPressed = false;

        // set next suggested id
        this.last_id = this.AllDoctors.length ? Math.max(...this.AllDoctors.map(d => d.doctorID ?? 0)) : 0;
        const idCtrl = this.addDoctorForm.get('doctorID');
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)]);
        idCtrl?.updateValueAndValidity();
      },
      error: (err) => { alert(err); }
    });
  }

  // ---------- Edit ----------
  activateEditForm(d: Doctor): void {
    this.editDoctorForm.patchValue({
      doctorID: d.doctorID,
      visitID: d.visitID ?? null,
      doctorName: d.doctorName,
      doctorEmail: d.doctorEmail,
      doctorPhone: d.doctorPhone,
      specialization: d.specialization ?? ''
    });
    this.EditBtnPressed = true;
    this.AddBtnPressed = false;
  }

  onEdit(): void {
    const doctor: Doctor = {
      doctorID: this.editDoctorForm.value.doctorID,
      visitID: this.editDoctorForm.value.visitID,
      doctorName: this.editDoctorForm.value.doctorName,
      doctorEmail: this.editDoctorForm.value.doctorEmail,
      doctorPhone: this.editDoctorForm.value.doctorPhone,
      specialization: this.editDoctorForm.value.specialization
    };

    const others = this.AllDoctors.filter(d => d.doctorID !== doctor.doctorID);
    if (others.some(d => d.doctorEmail === doctor.doctorEmail) && doctor.doctorEmail) {
      alert('The doctor email you just entered already exists. Please try a unique email for each doctor');
      return;
    }

    this.dataService.UpdateDoctor(doctor.doctorID, doctor).subscribe({
      next: () => {
        const idx = this.AllDoctors.findIndex(d => d.doctorID === doctor.doctorID);
        if (idx >= 0) this.AllDoctors[idx] = doctor;
        this.applyFilters();
        alert('The record of the doctor has been updated');
        this.EditBtnPressed = false;
      }
    });
  }

  // ---------- Delete ----------
  deleteAction(id: number): void {
    if (this.AllVisits?.some(v => v.doctorID == id)) {
      alert('Sorry this doctor record cannot be deleted as this doctor has a scheduled appointment');
      return;
    }

    this.dataService.deleteDoctorByID(id).subscribe({
      next: () => {
        this.AllDoctors = this.AllDoctors.filter(d => d.doctorID !== id);
        const maxPage = Math.max(1, Math.ceil((this.total - 1) / this.pageSize));
        if (this.page > maxPage) this.page = maxPage;
        this.applyFilters();
        alert('deleted doctor record successfully');
      }
    });
  }

  // ---------- Search (simple, like patient comp) ----------
  private filterRows(): Doctor[] {
    const q = (this.searchFC.value ?? '').trim().toLowerCase();
    if (!q) return this.AllDoctors;

    const isNumeric = /^[0-9]+$/.test(q);
    const looksEmail = q.includes('@');

    return this.AllDoctors.filter(d => {
      const name  = (d.doctorName ?? '').toLowerCase();
      const email = (d.doctorEmail ?? '').toLowerCase();
      const phone = (d.doctorPhone ?? '').toLowerCase();
      const spec  = (d.specialization ?? '').toLowerCase();

      if (isNumeric) {
        if (d.doctorID === Number(q)) return true; // exact id
        if (phone.includes(q)) return true;        // partial phone
        return false;
      }
      if (looksEmail) return email.includes(q);

      return name.includes(q) || email.includes(q) || phone.includes(q) || spec.includes(q);
    });
  }

  // ---------- Sorting ----------
  onSort(col: SortKey) {
    if (this.sortBy === col) {
      this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = col;
      this.sortDir = 'asc';
    }
    this.page = 1;
    this.applyFilters();
  }

  sortArrow(col: SortKey) {
    if (this.sortBy !== col) return '';
    return this.sortDir === 'asc' ? '▲' : '▼';
  }

  private sortRows(rows: Doctor[]): Doctor[] {
    const dir = this.sortDir === 'asc' ? 1 : -1;
    const key = this.sortBy;

    return [...rows].sort((a: any, b: any) => {
      if (key === 'doctorID') {
        return (a.doctorID - b.doctorID) * dir;
      }
      const av = (a?.[key] ?? '').toString().toLowerCase();
      const bv = (b?.[key] ?? '').toString().toLowerCase();
      if (av < bv) return -1 * dir;
      if (av > bv) return  1 * dir;
      // tie-breaker by ID
      const t = (a.doctorID ?? 0) - (b.doctorID ?? 0);
      return this.sortDir === 'asc' ? t : -t;
    });
  }

  // ---------- Pagination ----------
  changePageSize(size: number | string) {
    this.pageSize = Number(size) || 10;
    this.page = 1;
    this.applyFilters();
  }
  firstPage() { this.page = 1; this.applyFilters(); }
  prevPage()  { if (this.page > 1) { this.page--; this.applyFilters(); } }
  nextPage()  { const m = Math.max(1, Math.ceil(this.total / this.pageSize)); if (this.page < m) { this.page++; this.applyFilters(); } }
  lastPage()  { this.page = Math.max(1, Math.ceil(this.total / this.pageSize)); this.applyFilters(); }

  // ---------- Pipeline ----------
  private applyFilters() {
    const filtered = this.filterRows();
    const sorted   = this.sortRows(filtered);

    this.total = sorted.length;
    const start = (this.page - 1) * this.pageSize;
    const end   = start + this.pageSize;

    this.filteredDoctors = sorted;
    this.visibleDoctors  = sorted.slice(start, end);
  }

  // ---------- Init ----------
  ngOnInit(): void {
    // visits for delete guard
    this.visit_data.getAllVisits().subscribe({
      next: (res) => { this.AllVisits = res; },
      error: () => { alert('visit data Loading Failed'); }
    });

    // forms
    this.editDoctorForm = new FormGroup({
      doctorID:     new FormControl<number | null>(null, [Validators.required]),
      doctorName:   new FormControl<string | null>('', [Validators.required, Validators.minLength(3)]),
      visitID:      new FormControl<number | null>(null),
      doctorEmail:  new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(6)]),
      doctorPhone:  new FormControl<string | null>('', [Validators.required]),
      specialization: new FormControl<string | null>('')
    });

    this.addDoctorForm = new FormGroup({
      doctorID:     new FormControl<number | null>(null, [Validators.required]),
      doctorName:   new FormControl<string | null>('', [Validators.required, Validators.minLength(3)]),
      doctorEmail:  new FormControl<string | null>('', [Validators.required, Validators.email, Validators.minLength(6)]),
      doctorPhone:  new FormControl<string | null>('', [Validators.required]),
      specialization: new FormControl<string | null>('')
    });

    // load doctors
    this.dataService.getAllDoctors().subscribe({
      next: (res) => {
        this.AllDoctors = res ?? [];
        this.last_id = this.AllDoctors.length ? Math.max(...this.AllDoctors.map(d => d.doctorID ?? 0)) : 0;

        const idCtrl = this.addDoctorForm.get('doctorID');
        idCtrl?.setValue(Number(this.last_id) + 1);
        idCtrl?.setValidators([Validators.required, Validators.min(Number(this.last_id) + 1)]);
        idCtrl?.updateValueAndValidity();

        // initial view
        this.applyFilters();

        // live search: keep it simple (no rxjs operators needed)
        this.searchFC.valueChanges.subscribe(() => {
          this.page = 1;
          this.applyFilters();
        });
      },
      error: () => { alert('Failed to load doctor data'); }
    });
  }
}
