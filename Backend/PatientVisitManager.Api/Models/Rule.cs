namespace PatientVisitManager.Api.Models
{
    public class Rule
    {
        public int Id { get; set; }  // identity primary key
        public string RuleName { get; set; } = null!;
        public decimal RulePrice { get; set; }

        public ICollection<VisitNote>? VisitNotes { get; set; }
    }
    public class VisitNote
    {
        public int NotesID { get; set; }  // identity primary key
        public int VisitID { get; set; }  // unique FK to Visit
        public string VisitNotes { get; set; } = null!;
        public int RuleID { get; set; }
        public int Finalized { get; set; } = 0;

        public Visit Visit { get; set; } = null!;
        public Rule Rule { get; set; } = null!;
        public Billing? Billing { get; set; }
    }
    public class Billing
    {
        public int BillingID { get; set; }  // identity primary key
        public int NotesID { get; set; }
        public decimal TotalBill { get; set; }

        public VisitNote VisitNote { get; set; } = null!;
    }
}
