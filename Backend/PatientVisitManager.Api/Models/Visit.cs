namespace PatientVisitManager.Api.Models;
public class Visit
{
    public int VisitID { get; set; }
    public string VisitType { get; set; } = string.Empty;
    public int? VisitTypeID { get; set; }
    public int VisitDuration { get; set; }
    public DateTime VisitDate { get; set; }
    public decimal VisitFee { get; set; }
}
